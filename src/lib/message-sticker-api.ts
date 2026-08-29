const DEFAULT_PUBLIC_API_BASE = 'https://api.lidure22.xyz/api';
const MESSAGE_STICKER_API_BASE = (import.meta.env.PUBLIC_MOMENTS_API || DEFAULT_PUBLIC_API_BASE).replace(/\/$/, '');
const STICKER_OWNER_STORAGE_KEY = 'message_sticker_owner_token_v1';
const STICKER_OWNER_HEADER = 'X-Message-Sticker-Owner';

export type MessageSticker = {
  id: string;
  stickerKey: string;
  x: number;
  y: number;
  rotation: number;
  createdAt: number;
  updatedAt: number;
};

export type MessageStickerList = {
  items: MessageSticker[];
  ownedIds: string[];
  ownedCount: number;
  now: number;
};

function randomOwnerToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function getOrCreateStickerOwnerToken() {
  try {
    const current = localStorage.getItem(STICKER_OWNER_STORAGE_KEY)?.trim() || '';
    if (current.length >= 24) return current;
    const created = randomOwnerToken();
    localStorage.setItem(STICKER_OWNER_STORAGE_KEY, created);
    return created;
  } catch {
    return randomOwnerToken();
  }
}

async function readApiJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof data.error === 'string' ? data.error : `API 错误 (${response.status})`) as Error & {
      code?: string;
      status?: number;
    };
    error.code = typeof data.code === 'string' ? data.code : undefined;
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function fetchMessageStickers(signal?: AbortSignal): Promise<MessageStickerList> {
  const ownerToken = getOrCreateStickerOwnerToken();
  const response = await fetch(`${MESSAGE_STICKER_API_BASE}/message-stickers`, {
    cache: 'no-store',
    signal,
    headers: { [STICKER_OWNER_HEADER]: ownerToken },
  });
  const data = await readApiJson(response);
  return {
    items: Array.isArray(data.items) ? data.items as MessageSticker[] : [],
    ownedIds: Array.isArray(data.ownedIds) ? data.ownedIds.filter((value: unknown) => typeof value === 'string') : [],
    ownedCount: Math.max(0, Number(data.ownedCount) || 0),
    now: Number(data.now) || Date.now(),
  };
}

export async function createMessageSticker(stickerKey: string, posX: number, posY: number) {
  const ownerToken = getOrCreateStickerOwnerToken();
  const response = await fetch(`${MESSAGE_STICKER_API_BASE}/message-stickers`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ stickerKey, ownerToken, posX, posY }),
  });
  const data = await readApiJson(response);
  return {
    item: data.item as MessageSticker,
    ownedCount: Math.max(0, Number(data.ownedCount) || 0),
  };
}

export async function updateOwnedMessageSticker(id: string, posX: number, posY: number) {
  const ownerToken = getOrCreateStickerOwnerToken();
  const response = await fetch(`${MESSAGE_STICKER_API_BASE}/message-stickers`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id, ownerToken, posX, posY }),
  });
  const data = await readApiJson(response);
  return data.item as MessageSticker;
}

export async function deleteOwnedMessageSticker(id: string) {
  const ownerToken = getOrCreateStickerOwnerToken();
  const response = await fetch(`${MESSAGE_STICKER_API_BASE}/message-stickers`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id, ownerToken }),
  });
  await readApiJson(response);
}

export async function updateAdminMessageSticker(id: string, posX: number, posY: number) {
  const response = await fetch(`${MESSAGE_STICKER_API_BASE}/message-stickers`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id, posX, posY }),
  });
  const data = await readApiJson(response);
  return data.item as MessageSticker;
}

export async function deleteAdminMessageSticker(id: string) {
  const response = await fetch(`${MESSAGE_STICKER_API_BASE}/message-stickers`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id }),
  });
  await readApiJson(response);
}
