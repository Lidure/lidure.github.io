export const MOMENT_MEDIA_KINDS = ["image", "video", "poster"] as const;

export type MomentMediaKind = (typeof MOMENT_MEDIA_KINDS)[number];

export type MomentMediaItem = {
  kind: MomentMediaKind;
  url: string;
};

type MomentValidationError = {
  code: string;
  message: string;
};

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: MomentValidationError };

const DEFAULT_PUBLIC_MEDIA_BASE_URL = "https://media.lidure.xyz";
const MAX_MEDIA_ITEMS = 9;

export function normalizePublicMediaBaseUrl(value: string | undefined): string {
  const normalized = typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
  return normalized || DEFAULT_PUBLIC_MEDIA_BASE_URL;
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

    const normalizedUrl = normalizeAbsoluteHttpUrl((entry as { url?: unknown }).url);
    if (!normalizedUrl) {
      return {
        ok: false,
        error: { code: "INVALID_MEDIA_URL", message: "Moment media URL must be a valid http(s) URL" },
      };
    }

    if (!normalizedUrl.startsWith(`${publicMediaBaseUrl}/`) && normalizedUrl !== publicMediaBaseUrl) {
      return {
        ok: false,
        error: {
          code: "INVALID_MEDIA_URL",
          message: "Moment media URL must use the configured public media base URL",
        },
      };
    }

    const signature = `${kind}:${normalizedUrl}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    value.push({ kind, url: normalizedUrl });
  }

  return { ok: true, value };
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
