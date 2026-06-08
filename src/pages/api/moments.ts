import type { APIRoute } from 'astro';
import { moments as fallbackMoments } from '../../data/moments';
import type { Moment, MomentCategory } from '../../data/moments';

const owner = 'Lidure';
const repo = 'lidure.github.io';
const branch = 'main';
const momentsPath = 'src/data/moments.json';
const imageDir = 'public/moments';
const userAgent = 'lidure-blog-moments';
const maxImages = 9;
const maxImageBytes = 8 * 1024 * 1024;
const categories: MomentCategory[] = ['游戏', '音乐', '生活'];

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function githubHeaders(githubToken: string, withJson = false) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': userAgent,
  };

  if (withJson) headers['Content-Type'] = 'application/json';

  return headers;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text.trim() || text;
  }
}

function responseMessage(payload: unknown, fallback: string) {
  if (typeof payload === 'string') return payload.slice(0, 500);
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function hasSha(payload: unknown): payload is { sha: string } {
  return (
    !!payload &&
    typeof payload === 'object' &&
    'sha' in payload &&
    typeof (payload as { sha?: unknown }).sha === 'string'
  );
}

function hasContent(payload: unknown): payload is { sha: string; content: string; encoding: string } {
  return (
    hasSha(payload) &&
    'content' in payload &&
    typeof (payload as { content?: unknown }).content === 'string' &&
    'encoding' in payload &&
    typeof (payload as { encoding?: unknown }).encoding === 'string'
  );
}

function hasCommitUrl(payload: unknown): payload is { commit: { html_url: string } } {
  const commit = payload && typeof payload === 'object'
    ? (payload as { commit?: unknown }).commit
    : undefined;

  return (
    !!commit &&
    typeof commit === 'object' &&
    'html_url' in commit &&
    typeof (commit as { html_url?: unknown }).html_url === 'string'
  );
}

function hasDownloadUrl(payload: unknown): payload is { content: { download_url: string } } {
  const content = payload && typeof payload === 'object'
    ? (payload as { content?: unknown }).content
    : undefined;

  return (
    !!content &&
    typeof content === 'object' &&
    'download_url' in content &&
    typeof (content as { download_url?: unknown }).download_url === 'string'
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function stringToBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return arrayBufferToBase64(buffer);
}

function base64ToString(value: string) {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new TextDecoder().decode(bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isCategory(value: unknown): value is MomentCategory {
  return typeof value === 'string' && categories.includes(value as MomentCategory);
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanImages(value: unknown) {
  if (!Array.isArray(value)) return undefined;

  const images = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxImages);

  return images.length > 0 ? images : undefined;
}

function parseMoment(value: unknown): Moment | null {
  if (!isRecord(value)) return null;

  const date = cleanText(value.date);
  const text = cleanText(value.text);
  const link = cleanText(value.link);
  const images = cleanImages(value.images);

  if (!date || !text || !isCategory(value.category)) return null;

  return {
    date,
    category: value.category,
    text,
    ...(link && { link }),
    ...(images && { images }),
  };
}

function parseMoments(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map(parseMoment)
    .filter((moment): moment is Moment => moment !== null);
}

function parseNewMoment(value: unknown): Moment | null {
  const moment = parseMoment(value);
  if (!moment) return null;

  return {
    ...moment,
    images: cleanImages(isRecord(value) ? value.images : undefined),
  };
}

function momentsJsonContent(items: Moment[]) {
  return JSON.stringify(items, null, 2) + '\n';
}

function rawImageUrl(fileName: string) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${imageDir}/${encodeURIComponent(fileName)}`;
}

function safeFileName(file: File) {
  const baseName = file.name.trim().replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+/, '');
  return `${Date.now()}-${baseName || 'image.png'}`;
}

async function readCurrentMoments(githubToken: string) {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${momentsPath}?ref=${branch}`,
    { headers: githubHeaders(githubToken) }
  );
  const payload = await readResponseBody(response);

  if (response.status === 404) {
    return { moments: fallbackMoments, sha: undefined };
  }

  if (!response.ok) {
    throw new Response(
      JSON.stringify({ error: responseMessage(payload, 'Failed to fetch current moments') }),
      { status: response.status, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  if (!hasContent(payload)) {
    throw new Response(
      JSON.stringify({ error: 'GitHub response did not include moments.json content' }),
      { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  return { moments: parseMoments(JSON.parse(base64ToString(payload.content))), sha: payload.sha };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const githubToken = isRecord(body) ? cleanText(body.githubToken) : '';
    const newMoment = parseNewMoment(body);

    if (!githubToken || !newMoment) {
      return json({ error: 'Missing or invalid required fields' }, { status: 400 });
    }

    let current;
    try {
      current = await readCurrentMoments(githubToken);
    } catch (err) {
      if (err instanceof Response) return err;
      throw err;
    }

    const updatedMoments = [newMoment, ...current.moments];
    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${momentsPath}`,
      {
        method: 'PUT',
        headers: githubHeaders(githubToken, true),
        body: JSON.stringify({
          message: `Add moment: ${newMoment.text.slice(0, 30)}${newMoment.text.length > 30 ? '...' : ''}`,
          content: stringToBase64(momentsJsonContent(updatedMoments)),
          ...(current.sha && { sha: current.sha }),
          branch,
        }),
      }
    );

    const commitData = await readResponseBody(commitRes);
    if (!commitRes.ok) {
      return json(
        { error: responseMessage(commitData, 'Failed to commit moments.json') },
        { status: commitRes.status }
      );
    }

    return json(
      { success: true, commit: hasCommitUrl(commitData) ? commitData.commit.html_url : undefined },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API POST error]', message);
    return json({ error: 'Server error: ' + message }, { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const githubToken = cleanText(formData.get('githubToken'));

    if (!file || !githubToken) {
      return json({ error: 'Missing file or GitHub token' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return json({ error: 'Only image files can be uploaded' }, { status: 415 });
    }

    if (file.size > maxImageBytes) {
      return json({ error: 'Image is too large. Please keep it under 8 MB.' }, { status: 413 });
    }

    const fileName = safeFileName(file);
    const path = `${imageDir}/${fileName}`;
    const contentBase64 = arrayBufferToBase64(await file.arrayBuffer());

    const uploadRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: githubHeaders(githubToken, true),
        body: JSON.stringify({
          message: `Upload moment image: ${fileName}`,
          content: contentBase64,
          branch,
        }),
      }
    );

    const uploadData = await readResponseBody(uploadRes);
    if (!uploadRes.ok) {
      return json(
        { error: responseMessage(uploadData, 'Failed to upload image to GitHub') },
        { status: uploadRes.status }
      );
    }

    return json(
      {
        success: true,
        url: hasDownloadUrl(uploadData) ? uploadData.content.download_url : rawImageUrl(fileName),
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API PUT error]', message);
    return json({ error: 'Image upload failed: ' + message }, { status: 500 });
  }
};
