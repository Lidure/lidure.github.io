const DEFAULT_MOMENTS_API_BASE = 'https://api.lidure22.xyz/api';
const REQUEST_TIMEOUT_MS = 8_000;
const READ_RETRY_DELAYS_MS = [250];

export const MOMENTS_API_BASE = (
  import.meta.env.PUBLIC_MOMENTS_API ||
  DEFAULT_MOMENTS_API_BASE
).replace(/\/$/, '');

export type MomentMediaKind = 'image' | 'video' | 'poster';

export type MomentMediaItem = {
  kind: MomentMediaKind;
  url: string;
};

export type MomentApiItem = {
  id: string;
  date: string;
  category: string;
  text: string;
  link?: string;
  images: string[];
  media?: MomentMediaItem[];
  createdAt?: number;
  reactions?: Record<string, number>;
};

export type MomentSession = {
  authenticated: boolean;
  exp?: number;
};

export type CreateMomentRequest = {
  date: string;
  category: string;
  text: string;
  link?: string;
  images?: string[];
  media?: MomentMediaItem[];
};

export type MomentUploadResult = {
  url: string;
  key?: string;
  kind: MomentMediaKind;
};

export type MomentApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'AUTH_EXPIRED'
  | 'AUTH_FORBIDDEN'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'API_ERROR';

export class MomentApiError extends Error {
  code: MomentApiErrorCode;
  status?: number;

  constructor(message: string, code: MomentApiErrorCode, status?: number) {
    super(message);
    this.name = 'MomentApiError';
    this.code = code;
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  body?: BodyInit;
  headers?: HeadersInit;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
  cache?: RequestCache;
};

function endpoint(path: string) {
  return `${MOMENTS_API_BASE}${path}`;
}

function timeoutSignal() {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }

  const controller = new AbortController();
  window.setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), REQUEST_TIMEOUT_MS);
  return controller.signal;
}

function combineSignals(signals: AbortSignal[]) {
  const activeSignals = signals.filter(Boolean);
  if (activeSignals.length === 1) return activeSignals[0];
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
    return AbortSignal.any(activeSignals);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  activeSignals.forEach((signal) => {
    if (signal.aborted) {
      abort();
    } else {
      signal.addEventListener('abort', abort, { once: true });
    }
  });
  return controller.signal;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

function mapStatusToCode(status: number): MomentApiErrorCode {
  if (status === 401) return 'AUTH_REQUIRED';
  if (status === 403) return 'AUTH_FORBIDDEN';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_ERROR';
  return 'API_ERROR';
}

function defaultMessage(code: MomentApiErrorCode, status?: number) {
  switch (code) {
    case 'AUTH_REQUIRED':
      return '请先登录后再操作。';
    case 'AUTH_INVALID':
      return '登录信息无效，请重新登录。';
    case 'AUTH_EXPIRED':
      return '登录已过期，请重新登录。';
    case 'AUTH_FORBIDDEN':
      return '当前登录没有权限执行这个操作。';
    case 'PAYLOAD_TOO_LARGE':
      return '文件太大，请压缩后再试。';
    case 'RATE_LIMITED':
      return '操作太频繁，请稍后再试。';
    case 'SERVER_ERROR':
      return '服务暂时不可用，请稍后重试。';
    case 'NETWORK_ERROR':
      return '网络连接失败，请检查网络后重试。';
    case 'TIMEOUT':
      return '请求超时，请稍后重试。';
    default:
      return `API 错误${status ? ` (${status})` : ''}`;
  }
}

async function readError(res: Response): Promise<MomentApiError> {
  const data = await res.json().catch(() => ({}));
  const statusCode = mapStatusToCode(res.status);
  const workerCode = typeof data.code === 'string' ? data.code : '';
  const code: MomentApiErrorCode =
    workerCode === 'AUTH_REQUIRED' || workerCode === 'AUTH_INVALID' || workerCode === 'AUTH_EXPIRED'
      ? workerCode
      : statusCode;
  const message = typeof data.error === 'string' && data.error.trim()
    ? data.error.trim()
    : defaultMessage(code, res.status);
  return new MomentApiError(message, code, res.status);
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const signal = options.signal
    ? combineSignals([options.signal, timeoutSignal()])
    : timeoutSignal();

  let response: Response;
  try {
    response = await fetch(endpoint(path), {
      ...options,
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new MomentApiError(defaultMessage('TIMEOUT'), 'TIMEOUT');
    }
    throw new MomentApiError(defaultMessage('NETWORK_ERROR'), 'NETWORK_ERROR');
  }

  if (!response.ok) {
    throw await readError(response);
  }

  return response.json().catch(() => ({})) as Promise<T>;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function requestReadJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= READ_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await requestJson<T>(path, { ...options, method: 'GET', cache: 'no-store' });
    } catch (error) {
      lastError = error;
      if (
        options.signal?.aborted ||
        !(error instanceof MomentApiError) ||
        (error.code !== 'NETWORK_ERROR' && error.code !== 'TIMEOUT' && error.code !== 'SERVER_ERROR') ||
        attempt >= READ_RETRY_DELAYS_MS.length
      ) {
        throw error;
      }
      await delay(READ_RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

export async function fetchMoments(options: { limit?: number; cursor?: string; signal?: AbortSignal } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? 200));
  if (options.cursor) params.set('cursor', options.cursor);

  const data = await requestReadJson<{ items?: MomentApiItem[]; nextCursor?: string | null }>(
    `/moments?${params.toString()}`,
    { signal: options.signal },
  );
  return {
    items: Array.isArray(data.items) ? data.items : [],
    nextCursor: data.nextCursor ?? null,
  };
}

export async function login(password: string, options: { signal?: AbortSignal } = {}) {
  const data = await requestJson<MomentSession>('/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ password }),
    signal: options.signal,
  });
  return { authenticated: data.authenticated === true, exp: data.exp };
}

export async function logout(options: { signal?: AbortSignal } = {}) {
  await requestJson<MomentSession>('/auth/logout', {
    method: 'POST',
    credentials: 'include',
    signal: options.signal,
  });
}

export async function getSession(options: { signal?: AbortSignal } = {}) {
  try {
    const data = await requestJson<MomentSession>('/auth/session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal: options.signal,
    });
    return { authenticated: data.authenticated === true, exp: data.exp };
  } catch (error) {
    if (error instanceof MomentApiError && error.code === 'AUTH_REQUIRED') {
      return { authenticated: false };
    }
    throw error;
  }
}

export async function uploadMomentMedia(
  file: File,
  options: { kind?: MomentMediaKind; signal?: AbortSignal } = {},
) {
  const formData = new FormData();
  formData.append('file', file, file.name);
  if (options.kind) formData.append('kind', options.kind);

  return requestJson<MomentUploadResult>('/media/upload', {
    method: 'POST',
    credentials: 'include',
    body: formData,
    signal: options.signal,
  });
}

export async function createMoment(input: CreateMomentRequest, options: { signal?: AbortSignal } = {}) {
  const data = await requestJson<{ item?: MomentApiItem }>('/moments', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(input),
    signal: options.signal,
  });

  if (!data.item) {
    throw new MomentApiError('发布成功，但 API 没有返回新动态。', 'API_ERROR');
  }
  return data.item;
}

export async function deleteMoment(momentId: string, options: { signal?: AbortSignal } = {}) {
  await requestJson<Record<string, never>>(`/moments/${encodeURIComponent(momentId)}`, {
    method: 'DELETE',
    credentials: 'include',
    signal: options.signal,
  });
}
