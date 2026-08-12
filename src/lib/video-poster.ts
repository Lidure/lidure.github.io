const MIN_POSTER_TIME_SECONDS = 0.1;
const VIDEO_WAIT_TIMEOUT_MS = 10_000;
const POSTER_MAX_DIMENSION = 1280;
const POSTER_JPEG_QUALITY = 0.86;

export type VideoPosterErrorCode =
  | 'VIDEO_CORS_REQUIRED'
  | 'VIDEO_FRAME_UNAVAILABLE'
  | 'VIDEO_METADATA_TIMEOUT'
  | 'VIDEO_SEEK_TIMEOUT'
  | 'VIDEO_POSTER_FAILED';

export class VideoPosterError extends Error {
  code: VideoPosterErrorCode;

  constructor(code: VideoPosterErrorCode, message: string) {
    super(message);
    this.name = 'VideoPosterError';
    this.code = code;
  }
}

export function choosePosterTime(duration: number, requested = MIN_POSTER_TIME_SECONDS) {
  if (!Number.isFinite(duration) || duration <= 0) return MIN_POSTER_TIME_SECONDS;

  const latest = Math.max(MIN_POSTER_TIME_SECONDS, duration - MIN_POSTER_TIME_SECONDS);
  if (!Number.isFinite(requested)) return Math.min(MIN_POSTER_TIME_SECONDS, latest);
  return Math.min(Math.max(requested, MIN_POSTER_TIME_SECONDS), latest);
}

function toPosterError(error: unknown, fallbackCode: VideoPosterErrorCode): VideoPosterError {
  if (error instanceof VideoPosterError) return error;
  if (error instanceof DOMException && error.name === 'SecurityError') {
    return new VideoPosterError(
      'VIDEO_CORS_REQUIRED',
      'VIDEO_CORS_REQUIRED: 此视频源不允许浏览器取帧，请上传手动 JPEG 封面。',
    );
  }

  const message = error instanceof Error ? error.message : String(error || '');
  return new VideoPosterError(fallbackCode, message || fallbackCode);
}

function waitFor(video: HTMLVideoElement, eventName: 'loadedmetadata' | 'seeked', timeoutMs = VIDEO_WAIT_TIMEOUT_MS) {
  const timeoutCode: VideoPosterErrorCode = eventName === 'loadedmetadata'
    ? 'VIDEO_METADATA_TIMEOUT'
    : 'VIDEO_SEEK_TIMEOUT';

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => finish(new VideoPosterError(timeoutCode, `${eventName} timed out`)), timeoutMs);

    function cleanup() {
      window.clearTimeout(timer);
      video.removeEventListener(eventName, onReady);
      video.removeEventListener('error', onError);
    }

    function finish(error?: unknown) {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    }

    function onReady() {
      finish();
    }

    function onError() {
      finish(new VideoPosterError('VIDEO_POSTER_FAILED', '视频无法加载，不能生成封面。'));
    }

    video.addEventListener(eventName, onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality = POSTER_JPEG_QUALITY) {
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new VideoPosterError('VIDEO_POSTER_FAILED', '浏览器没有生成 JPEG 封面。'));
        }
      }, 'image/jpeg', quality);
    } catch (error) {
      reject(toPosterError(error, 'VIDEO_POSTER_FAILED'));
    }
  });
}

export async function captureVideoPoster(source: string | File, requestedTime = MIN_POSTER_TIME_SECONDS): Promise<Blob> {
  const video = document.createElement('video');
  let objectUrl = '';

  try {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    objectUrl = source instanceof File ? URL.createObjectURL(source) : '';
    video.src = objectUrl || source;
    video.load();

    await waitFor(video, 'loadedmetadata');
    video.currentTime = choosePosterTime(video.duration, requestedTime);
    await waitFor(video, 'seeked');
    await nextAnimationFrame();

    if (!video.videoWidth || !video.videoHeight) {
      throw new VideoPosterError('VIDEO_FRAME_UNAVAILABLE', '视频帧不可用，请重新选择时间或上传手动封面。');
    }

    const scale = Math.min(1, POSTER_MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      throw new VideoPosterError('VIDEO_POSTER_FAILED', '浏览器不支持 Canvas 封面生成。');
    }

    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch (error) {
      throw toPosterError(error, 'VIDEO_POSTER_FAILED');
    }

    return await canvasToJpeg(canvas);
  } catch (error) {
    throw toPosterError(error, 'VIDEO_POSTER_FAILED');
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
