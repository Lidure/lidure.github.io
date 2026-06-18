export const PUBLIC_API_BASE = 'https://danmaku.lidure22.xyz/api';
export const USER_ID_KEY = 'guest_user_id';

export type CommentTargetType = 'moment' | 'message';

export type PublicComment = {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  userId: string;
  text: string;
  createdAt: number;
};

export type GuestMessage = {
  id: string;
  userId: string;
  text: string;
  createdAt: number;
  commentCount?: number;
};

export function getStoredUserId() {
  try {
    return localStorage.getItem(USER_ID_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredUserId(userId: string) {
  try {
    localStorage.setItem(USER_ID_KEY, userId);
  } catch {}
}

export function normalizeUserId(userId: string) {
  return userId.replace(/\s+/g, ' ').trim().slice(0, 32);
}

export function formatPublicTime(value: number | string) {
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16).replace('T', ' ');
}

async function readApiJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data.error === 'string' ? data.error : `API 错误 (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export async function fetchComments(targetType: CommentTargetType, targetId: string) {
  const url = `${PUBLIC_API_BASE}/comments?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}&limit=100`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await readApiJson(res);
  return (Array.isArray(data.items) ? data.items : []) as PublicComment[];
}

export async function createComment(targetType: CommentTargetType, targetId: string, userId: string, text: string) {
  const res = await fetch(`${PUBLIC_API_BASE}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ targetType, targetId, userId, text }),
  });
  const data = await readApiJson(res);
  return data.item as PublicComment;
}

export async function fetchGuestMessages() {
  const res = await fetch(`${PUBLIC_API_BASE}/messages?limit=80`, { cache: 'no-store' });
  const data = await readApiJson(res);
  return (Array.isArray(data.items) ? data.items : []) as GuestMessage[];
}

export async function createGuestMessage(userId: string, text: string) {
  const res = await fetch(`${PUBLIC_API_BASE}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userId, text }),
  });
  const data = await readApiJson(res);
  return data.item as GuestMessage;
}

export function createCommentsWidget(targetType: CommentTargetType, targetId: string, initialCount?: number) {
  const root = document.createElement('section');
  root.className = 'public-comments';
  root.dataset.targetType = targetType;
  root.dataset.targetId = targetId;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'public-comments-toggle';
  toggle.textContent = initialCount && initialCount > 0 ? `评论 ${initialCount}` : '评论';

  const body = document.createElement('div');
  body.className = 'public-comments-body';
  body.hidden = true;

  const list = document.createElement('div');
  list.className = 'public-comments-list';
  list.textContent = '加载评论中...';

  const form = document.createElement('form');
  form.className = 'public-comment-form';

  const userInput = document.createElement('input');
  userInput.name = 'userId';
  userInput.placeholder = '你的 ID';
  userInput.maxLength = 32;
  userInput.value = getStoredUserId();
  userInput.required = true;

  const textInput = document.createElement('input');
  textInput.name = 'text';
  textInput.placeholder = '写一条评论...';
  textInput.maxLength = 500;
  textInput.required = true;

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = '评论';

  const status = document.createElement('p');
  status.className = 'public-comment-status';

  form.append(userInput, textInput, submit);
  body.append(list, form, status);
  root.append(toggle, body);

  let loaded = false;

  function render(comments: PublicComment[]) {
    list.innerHTML = '';
    if (!comments.length) {
      const empty = document.createElement('p');
      empty.className = 'public-comment-empty';
      empty.textContent = '还没有评论';
      list.appendChild(empty);
      return;
    }

    comments.forEach((comment) => {
      const item = document.createElement('article');
      item.className = 'public-comment-item';
      const meta = document.createElement('div');
      meta.className = 'public-comment-meta';
      const user = document.createElement('strong');
      user.textContent = comment.userId;
      const time = document.createElement('time');
      time.dateTime = new Date(comment.createdAt).toISOString();
      time.textContent = formatPublicTime(comment.createdAt);
      meta.append(user, time);
      const text = document.createElement('p');
      text.textContent = comment.text;
      item.append(meta, text);
      list.appendChild(item);
    });
  }

  async function refresh() {
    try {
      render(await fetchComments(targetType, targetId));
      loaded = true;
    } catch (err) {
      list.textContent = '评论加载失败';
    }
  }

  toggle.addEventListener('click', () => {
    body.hidden = !body.hidden;
    toggle.classList.toggle('open', !body.hidden);
    if (!body.hidden && !loaded) refresh();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const userId = normalizeUserId(userInput.value);
    const text = textInput.value.trim();
    if (!userId || !text) return;
    setStoredUserId(userId);
    submit.disabled = true;
    status.textContent = '';

    try {
      const comment = await createComment(targetType, targetId, userId, text);
      textInput.value = '';
      const existing = await fetchComments(targetType, targetId).catch(() => null);
      render(existing || [comment]);
      loaded = true;
      status.textContent = '已发送';
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : '发送失败';
    } finally {
      submit.disabled = false;
    }
  });

  return root;
}
