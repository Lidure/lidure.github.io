import { uploadMomentMedia, type MomentMediaKind } from './moments-api';

export type MomentImageUploadOptions = {
  kind?: MomentMediaKind;
  signal?: AbortSignal;
};

/**
 * Backwards-compatible upload helper for the moments page.
 * Uploads now go through the authenticated Worker session; no R2 secrets live in the browser.
 */
export async function uploadToR2(file: File, options: MomentImageUploadOptions = {}): Promise<string> {
  const data = await uploadMomentMedia(file, {
    kind: options.kind ?? 'image',
    signal: options.signal,
  });
  const url = typeof data.url === 'string' ? data.url.trim() : '';
  if (!url) {
    throw new Error('上传成功，但没有返回媒体地址');
  }

  return url;
}
