import type { APIRoute } from 'astro';
import { moments } from '../../data/moments';
import type { Moment } from '../../data/moments';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { date, category, text, link, images, githubToken } = body;

    if (!date || !category || !text || !githubToken) {
      return new Response(JSON.stringify({ error: '缺少必要字段' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const newMoment: Moment = {
      date,
      category,
      text,
      ...(link && { link }),
      ...(images && images.length > 0 && { images }),
    };

    const updatedMoments = [newMoment, ...moments];

    const typeDef = `export type MomentCategory = '游戏' | '音乐' | '生活';`;
    const interfaceDef = `
export interface Moment {
  /** 日期，格式 YYYY-MM-DD */
  date: string;
  /** 分类，决定图标与筛选分组 */
  category: MomentCategory;
  /** 一句话碎碎念 */
  text: string;
  /** 可选：相关链接（外链或站内路径），填了文字就会变成链接 */
  link?: string;
  /** 可选：图片 URL 数组 */
  images?: string[];
}`;
    const metaStr = `/** 各分类的图标与展示名，想加新分类就在这里和上面的类型里各加一项 */
export const categoryMeta: Record<MomentCategory, { icon: string; label: string }> = {
  游戏: { icon: '🎮', label: '游戏' },
  音乐: { icon: '🎵', label: '音乐' },
  生活: { icon: '☕', label: '生活' },
};`;
    const orderStr = `/** 筛选条里的分类顺序 */
export const categoryOrder: MomentCategory[] = ['游戏', '音乐', '生活'];`;

    const momentsArray = updatedMoments
      .map((m) => {
        const textEscaped = m.text.replace(/'/g, "\\'");
        const linkStr = m.link ? `, link: '${m.link}'` : '';
        const imgStr =
          m.images && m.images.length > 0
            ? `, images: [${m.images.map((img) => `'${img}'`).join(', ')}]`
            : '';
        return `  { date: '${m.date}', category: '${m.category}', text: '${textEscaped}'${linkStr}${imgStr} }`;
      })
      .join(',\n');

    const fileContent = `${typeDef}
${interfaceDef}
${metaStr}
${orderStr}

/**
 * 碎碎念列表 —— 发新动态只需在数组最前面加一行：
 *   { date: '2026-06-09', category: '游戏', text: '今天在玩……' }
 * 顺序无所谓，页面会自动按日期倒序排列。
 */
export const moments: Moment[] = [
${momentsArray}
];`;

    const owner = 'Lidure';
    const repo = 'lidure.github.io';
    const momentsPath = 'src/data/moments.ts';
    const branch = 'main';

    const getShaRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${momentsPath}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    const shaData = await getShaRes.json();
    const sha = shaData.sha;

    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${momentsPath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          message: `✨ 新增碎碎念: ${text.slice(0, 30)}${text.length > 30 ? '...' : ''}`,
          content: btoa(unescape(encodeURIComponent(fileContent))),
          sha,
          branch,
        }),
      }
    );

    const commitData = await commitRes.json();

    if (!commitRes.ok) {
      return new Response(JSON.stringify({ error: commitData.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, commit: commitData.commit.html_url }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch {
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const githubToken = formData.get('githubToken') as string;

    if (!file || !githubToken) {
      return new Response(JSON.stringify({ error: '缺少文件或 Token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const owner = 'Lidure';
    const repo = 'lidure.github.io';
    const branch = 'main';

    const ext = file.name.split('.').pop() ?? 'png';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${safeName}`;
    const path = `public/moments/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const contentBase64 = btoa(
      [...new Uint8Array(arrayBuffer)]
        .map((b) => String.fromCharCode(b))
        .join('')
    );

    const getShaRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );
    const existingSha = getShaRes.ok ? (await getShaRes.json()).sha : undefined;

    const uploadRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          message: `📷 上传碎碎念图片: ${fileName}`,
          content: contentBase64,
          ...(existingSha && { sha: existingSha }),
          branch,
        }),
      }
    );

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      return new Response(JSON.stringify({ error: uploadData.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const imageUrl = `https://lidure.github.io/moments/${fileName}`;

    return new Response(JSON.stringify({ success: true, url: imageUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: '图片上传失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
