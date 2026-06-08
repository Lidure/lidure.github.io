import type { APIRoute } from 'astro';
import { moments } from '../../data/moments';
import type { Moment } from '../../data/moments';

const owner = 'Lidure';
const repo = 'lidure.github.io';
const branch = 'main';
const userAgent = 'lidure-blog-moments';

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

function quote(value: string) {
  return JSON.stringify(value);
}

function serializeMoment(moment: Moment) {
  const linkStr = moment.link ? `, link: ${quote(moment.link)}` : '';
  const imgStr =
    moment.images && moment.images.length > 0
      ? `, images: [${moment.images.map((img) => quote(img)).join(', ')}]`
      : '';

  return `  { date: ${quote(moment.date)}, category: ${quote(moment.category)}, text: ${quote(moment.text)}${linkStr}${imgStr} }`;
}

function createMomentsFileContent(updatedMoments: Moment[]) {
  const momentsArray = updatedMoments.map(serializeMoment).join(',\n');

  return `export type MomentCategory = '游戏' | '音乐' | '生活';

export interface Moment {
  /** 日期，格式 YYYY-MM-DD */
  date: string;
  /** 分类，决定图标与筛选分组 */
  category: MomentCategory;
  /** 一句话碎碎念 */
  text: string;
  /** 可选：相关链接 */
  link?: string;
  /** 可选：图片 URL 数组 */
  images?: string[];
}

export const categoryMeta: Record<MomentCategory, { icon: string; label: string }> = {
  游戏: { icon: '🎮', label: '游戏' },
  音乐: { icon: '🎵', label: '音乐' },
  生活: { icon: '☕', label: '生活' },
};

export const categoryOrder: MomentCategory[] = ['游戏', '音乐', '生活'];

export const moments: Moment[] = [
${momentsArray}
];
`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { date, category, text, link, images, githubToken } = body;

    if (!date || !category || !text || !githubToken) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newMoment: Moment = {
      date,
      category,
      text,
      ...(link && { link }),
      ...(Array.isArray(images) && images.length > 0 && { images }),
    };

    const fileContent = createMomentsFileContent([newMoment, ...moments]);
    const momentsPath = 'src/data/moments.ts';

    const getShaRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${momentsPath}?ref=${branch}`,
      { headers: githubHeaders(githubToken) }
    );

    const shaData = await readResponseBody(getShaRes);
    if (!getShaRes.ok) {
      return json(
        { error: responseMessage(shaData, 'Failed to fetch moments file metadata') },
        { status: getShaRes.status }
      );
    }

    if (!hasSha(shaData)) {
      return json({ error: 'GitHub response did not include a file sha' }, { status: 502 });
    }

    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${momentsPath}`,
      {
        method: 'PUT',
        headers: githubHeaders(githubToken, true),
        body: JSON.stringify({
          message: `Add moment: ${String(text).slice(0, 30)}${String(text).length > 30 ? '...' : ''}`,
          content: stringToBase64(fileContent),
          sha: shaData.sha,
          branch,
        }),
      }
    );

    const commitData = await readResponseBody(commitRes);
    if (!commitRes.ok) {
      return json(
        { error: responseMessage(commitData, 'Failed to commit moments file') },
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
    const githubToken = formData.get('githubToken') as string | null;

    if (!file || !githubToken) {
      return json({ error: 'Missing file or GitHub token' }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${safeName}`;
    const path = `public/moments/${fileName}`;
    const contentBase64 = arrayBufferToBase64(await file.arrayBuffer());

    const getShaRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      { headers: githubHeaders(githubToken) }
    );

    const existingData = await readResponseBody(getShaRes);
    if (!getShaRes.ok && getShaRes.status !== 404) {
      return json(
        { error: responseMessage(existingData, 'Failed to check image file metadata') },
        { status: getShaRes.status }
      );
    }

    const existingSha = hasSha(existingData) ? existingData.sha : undefined;
    const uploadRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: githubHeaders(githubToken, true),
        body: JSON.stringify({
          message: `Upload moment image: ${fileName}`,
          content: contentBase64,
          ...(existingSha && { sha: existingSha }),
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

    return json({ success: true, url: `https://lidure.github.io/moments/${fileName}` }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API PUT error]', message);
    return json({ error: 'Image upload failed: ' + message }, { status: 500 });
  }
};
