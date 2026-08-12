export const MOMENT_MEDIA_KINDS = ["image", "video", "poster"] as const;

export type MomentMediaKind = (typeof MOMENT_MEDIA_KINDS)[number];

export type MomentMediaItem = {
  kind: MomentMediaKind;
  url: string;
};

type UploadInput = {
  type: string;
  size: number;
};

type UploadOptions = {
  requestedKind?: unknown;
};

export type ValidUpload = {
  kind: MomentMediaKind;
  extension: string;
  contentType: string;
};

export type UploadValidationResult =
  | ({ ok: true } & ValidUpload)
  | { ok: false; code: "MEDIA_EMPTY" | "MEDIA_TYPE_NOT_ALLOWED" | "MEDIA_TOO_LARGE"; limit?: number };

type MomentValidationError = {
  code: string;
  message: string;
};

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: MomentValidationError };

const DEFAULT_PUBLIC_MEDIA_BASE_URL = "https://media.lidure.xyz";
const MAX_MEDIA_ITEMS = 9;
export const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;

const ALLOWED_UPLOAD_TYPES = {
  "image/jpeg": { kind: "image", extension: "jpg", limit: MAX_IMAGE_UPLOAD_BYTES },
  "image/png": { kind: "image", extension: "png", limit: MAX_IMAGE_UPLOAD_BYTES },
  "image/webp": { kind: "image", extension: "webp", limit: MAX_IMAGE_UPLOAD_BYTES },
  "image/gif": { kind: "image", extension: "gif", limit: MAX_IMAGE_UPLOAD_BYTES },
  "video/mp4": { kind: "video", extension: "mp4", limit: MAX_VIDEO_UPLOAD_BYTES },
  "video/webm": { kind: "video", extension: "webm", limit: MAX_VIDEO_UPLOAD_BYTES },
} as const satisfies Record<
  string,
  { kind: Exclude<MomentMediaKind, "poster">; extension: string; limit: number }
>;

const GENERATED_MEDIA_KEY_PATTERN =
  /^moments\/\d{4}\/\d{2}\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(?:jpg|png|webp|gif|mp4|webm)$/;

export function normalizePublicMediaBaseUrl(value: string | undefined): string {
  const normalized = typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
  return normalized || DEFAULT_PUBLIC_MEDIA_BASE_URL;
}

export function validateUpload(input: UploadInput, options: UploadOptions = {}): UploadValidationResult {
  const contentType = normalizeContentType(input.type);
  const allowed = ALLOWED_UPLOAD_TYPES[contentType as keyof typeof ALLOWED_UPLOAD_TYPES];

  if (input.size <= 0) {
    return { ok: false, code: "MEDIA_EMPTY" };
  }

  if (!allowed) {
    return { ok: false, code: "MEDIA_TYPE_NOT_ALLOWED" };
  }

  if (input.size > allowed.limit) {
    return { ok: false, code: "MEDIA_TOO_LARGE", limit: allowed.limit };
  }

  if (options.requestedKind === "poster") {
    if (contentType !== "image/jpeg") {
      return { ok: false, code: "MEDIA_TYPE_NOT_ALLOWED" };
    }

    return {
      ok: true,
      kind: "poster",
      extension: "jpg",
      contentType,
    };
  }

  return {
    ok: true,
    kind: allowed.kind,
    extension: allowed.extension,
    contentType,
  };
}

export function buildMomentMediaKey(now: Date, uuid: string, extension: string): string {
  const year = String(now.getUTCFullYear()).padStart(4, "0");
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `moments/${year}/${month}/${uuid}.${extension}`;
}

export function isGeneratedMomentMediaKey(value: unknown): value is string {
  return typeof value === "string" && GENERATED_MEDIA_KEY_PATTERN.test(value.trim());
}

export function publicMediaUrlForKey(publicMediaBaseUrl: string | undefined, key: string): string {
  return `${normalizePublicMediaBaseUrl(publicMediaBaseUrl)}/${key}`;
}

export function isAllowedMomentMediaKind(value: unknown): value is MomentMediaKind {
  return typeof value === "string" && MOMENT_MEDIA_KINDS.includes(value as MomentMediaKind);
}

export function normalizeMomentMediaInput(
  input: unknown,
  options: {
    publicMediaBaseUrl?: string;
    maxItems?: number;
  } = {}
): ValidationResult<MomentMediaItem[]> {
  if (input == null) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(input)) {
    return {
      ok: false,
      error: { code: "INVALID_MEDIA", message: "Moment media must be an array" },
    };
  }

  const maxItems = options.maxItems ?? MAX_MEDIA_ITEMS;
  if (input.length > maxItems) {
    return {
      ok: false,
      error: { code: "TOO_MANY_MEDIA", message: "Moment media must contain 9 items or fewer" },
    };
  }

  const publicMediaBaseUrl = normalizePublicMediaBaseUrl(options.publicMediaBaseUrl);
  const seen = new Set<string>();
  const value: MomentMediaItem[] = [];

  for (const entry of input) {
    if (!entry || typeof entry !== "object") {
      return {
        ok: false,
        error: { code: "INVALID_MEDIA", message: "Moment media items must be objects" },
      };
    }

    const kind = (entry as { kind?: unknown }).kind;
    if (!isAllowedMomentMediaKind(kind)) {
      return {
        ok: false,
        error: { code: "INVALID_MEDIA_KIND", message: "Moment media kind is invalid" },
      };
    }

    const normalizedUrl = normalizeMomentMediaUrl(entry, publicMediaBaseUrl);
    if (normalizedUrl.error) {
      return {
        ok: false,
        error: normalizedUrl.error,
      };
    }

    const url = normalizedUrl.url;
    if (!url) {
      return {
        ok: false,
        error: { code: "INVALID_MEDIA_URL", message: "Moment media URL must be a valid http(s) URL" },
      };
    }

    const signature = `${kind}:${url}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    value.push({ kind, url });
  }

  return { ok: true, value };
}

function normalizeMomentMediaUrl(
  entry: object,
  publicMediaBaseUrl: string
): { url: string | null; error?: MomentValidationError } {
  const rawKey = (entry as { key?: unknown }).key;
  if (rawKey != null) {
    if (!isGeneratedMomentMediaKey(rawKey)) {
      return {
        url: null,
        error: {
          code: "INVALID_MEDIA_KEY",
          message: "Moment media key must be a generated upload key",
        },
      };
    }

    return { url: publicMediaUrlForKey(publicMediaBaseUrl, rawKey.trim()) };
  }

  const normalizedUrl = normalizeAbsoluteHttpUrl((entry as { url?: unknown }).url);
  if (!normalizedUrl) {
    return {
      url: null,
      error: { code: "INVALID_MEDIA_URL", message: "Moment media URL must be a valid http(s) URL" },
    };
  }

  if (!normalizedUrl.startsWith(`${publicMediaBaseUrl}/`) && normalizedUrl !== publicMediaBaseUrl) {
    return {
      url: null,
      error: {
        code: "INVALID_MEDIA_URL",
        message: "Moment media URL must use the configured public media base URL",
      },
    };
  }

  return { url: normalizedUrl };
}

export function normalizeAbsoluteHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function imageUrlsFromMedia(media: MomentMediaItem[]): string[] {
  return media.filter((item) => item.kind === "image").map((item) => item.url);
}

function normalizeContentType(value: string): string {
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}
