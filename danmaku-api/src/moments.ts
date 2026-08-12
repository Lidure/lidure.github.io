import {
  imageUrlsFromMedia,
  normalizeAbsoluteHttpUrl,
  normalizeMomentMediaInput,
  type MomentMediaItem,
} from "./media";

export const MOMENT_CATEGORIES = ["游戏", "音乐", "生活", "吐槽"] as const;

export type MomentCategory = (typeof MOMENT_CATEGORIES)[number];

export type MomentApiItem = {
  id: string;
  date: string;
  category: MomentCategory;
  text: string;
  link?: string;
  images: string[];
  media: MomentMediaItem[];
};

export type CreateMomentInput = {
  date: string;
  category: MomentCategory;
  text: string;
  link?: string;
  images?: string[];
  media?: MomentMediaItem[];
};

type NormalizedCreateMomentInput = {
  date: string;
  category: MomentCategory;
  text: string;
  link?: string;
  media: MomentMediaItem[];
};

type MomentValidationError = {
  code: string;
  message: string;
};

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: MomentValidationError };

type MomentListRow = {
  id: string;
  date: string;
  category: MomentCategory;
  text: string;
  link: string | null;
  created_at: string;
  updated_at: string;
  media_id: string | null;
  media_kind: MomentMediaItem["kind"] | null;
  media_url: string | null;
  media_sort_order: number | null;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_TEXT_LENGTH = 2000;
const MAX_DATE_LENGTH = 32;
const MAX_LINK_LENGTH = 2048;
const CURSOR_SEPARATOR = "|";

export function normalizeMomentInput(
  input: Partial<CreateMomentInput>,
  options: {
    publicMediaBaseUrl?: string;
  } = {}
): ValidationResult<NormalizedCreateMomentInput> {
  const date = typeof input.date === "string" ? input.date.trim() : "";
  if (!isValidMomentDate(date)) {
    return {
      ok: false,
      error: { code: "INVALID_DATE", message: "Moment date must use YYYY-MM-DD or YYYY-MM-DDTHH:mm" },
    };
  }

  const category = typeof input.category === "string" ? input.category.trim() : "";
  if (!isMomentCategory(category)) {
    return {
      ok: false,
      error: { code: "INVALID_CATEGORY", message: "Moment category is invalid" },
    };
  }

  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text) {
    return {
      ok: false,
      error: { code: "INVALID_TEXT", message: "Moment text is required" },
    };
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      error: {
        code: "TEXT_TOO_LONG",
        message: "Moment text must be 2000 characters or fewer",
      },
    };
  }

  const link = input.link == null ? "" : String(input.link).trim();
  if (link.length > MAX_LINK_LENGTH) {
    return {
      ok: false,
      error: { code: "INVALID_LINK", message: "Moment link must be a valid http(s) URL" },
    };
  }

  const normalizedLink = link ? normalizeAbsoluteHttpUrl(link) : null;
  if (link && !normalizedLink) {
    return {
      ok: false,
      error: { code: "INVALID_LINK", message: "Moment link must be a valid http(s) URL" },
    };
  }

  const legacyImages = Array.isArray(input.images)
    ? input.images.map((url) => ({ kind: "image" as const, url }))
    : [];
  const mediaInput = input.media ?? legacyImages;
  const media = normalizeMomentMediaInput(mediaInput, {
    publicMediaBaseUrl: options.publicMediaBaseUrl,
  });
  if (!media.ok) {
    return media;
  }

  return {
    ok: true,
    value: {
      date,
      category,
      text,
      ...(normalizedLink ? { link: normalizedLink } : {}),
      media: media.value,
    },
  };
}

export async function listMoments(
  db: D1Database,
  limit: number = DEFAULT_LIMIT,
  cursor?: string
): Promise<{ items: MomentApiItem[]; nextCursor: string | null }> {
  const normalizedLimit = normalizeLimit(limit);
  const parsedCursor = parseCursor(cursor);
  const cursorClause = parsedCursor
    ? "WHERE (date < ? OR (date = ? AND id < ?))"
    : "";
  const cursorArgs = parsedCursor ? [parsedCursor.date, parsedCursor.date, parsedCursor.id] : [];
  const sql = `
    WITH selected_moments AS (
      SELECT id, date, category, text, link, created_at, updated_at
      FROM moments
      ${cursorClause}
      ORDER BY date DESC, id DESC
      LIMIT ?
    )
    SELECT m.id, m.date, m.category, m.text, m.link, m.created_at, m.updated_at,
           mm.id AS media_id, mm.kind AS media_kind, mm.url AS media_url, mm.sort_order AS media_sort_order
    FROM selected_moments m
    LEFT JOIN moment_media mm ON mm.moment_id = m.id
    ORDER BY m.date DESC, m.id DESC, mm.sort_order ASC
  `;

  const { results } = await db
    .prepare(sql)
    .bind(...cursorArgs, normalizedLimit + 1)
    .all<MomentListRow>();

  const aggregated = aggregateMomentRows(results ?? []);
  const pageItems = aggregated.slice(0, normalizedLimit);
  const tail = pageItems[pageItems.length - 1];
  const hasMore = aggregated.length > normalizedLimit;

  return {
    items: pageItems,
    nextCursor: hasMore && tail ? formatCursor(tail.date, tail.id) : null,
  };
}

export async function createMoment(
  db: D1Database,
  input: CreateMomentInput,
  options: {
    publicMediaBaseUrl?: string;
    now?: () => string;
    createId?: () => string;
  } = {}
): Promise<MomentApiItem> {
  const normalized = normalizeMomentInput(input, options);
  if (!normalized.ok) {
    const error = new Error(normalized.error.message);
    (error as Error & { code?: string }).code = normalized.error.code;
    throw error;
  }

  const now = options.now?.() ?? new Date().toISOString();
  const createId = options.createId ?? (() => crypto.randomUUID());
  const momentId = createId();

  await db
    .prepare(
      "INSERT INTO moments (id, date, category, text, link, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      momentId,
      normalized.value.date,
      normalized.value.category,
      normalized.value.text,
      normalized.value.link ?? null,
      now,
      now
    )
    .run();

  for (const [index, media] of normalized.value.media.entries()) {
    await db
      .prepare(
        "INSERT INTO moment_media (id, moment_id, kind, url, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(createId(), momentId, media.kind, media.url, index, now)
      .run();
  }

  return getMomentById(db, momentId);
}

export async function deleteMoment(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM moment_media WHERE moment_id = ?").bind(id).run();
  await db.prepare("DELETE FROM moments WHERE id = ?").bind(id).run();
}

export function isMomentCategory(value: string): value is MomentCategory {
  return MOMENT_CATEGORIES.includes(value as MomentCategory);
}

function normalizeLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value) || DEFAULT_LIMIT));
}

function parseCursor(cursor: string | undefined): { date: string; id: string } | null {
  if (!cursor) return null;
  const separatorIndex = cursor.lastIndexOf(CURSOR_SEPARATOR);
  if (separatorIndex < 1) return null;

  const date = cursor.slice(0, separatorIndex).trim();
  const id = cursor.slice(separatorIndex + 1).trim();
  if (!isValidMomentDate(date) || !id) return null;

  return { date, id };
}

function formatCursor(date: string, id: string): string {
  return `${date}${CURSOR_SEPARATOR}${id}`;
}

function aggregateMomentRows(rows: MomentListRow[]): MomentApiItem[] {
  const items = new Map<string, MomentApiItem>();

  for (const row of rows) {
    let item = items.get(row.id);
    if (!item) {
      item = {
        id: row.id,
        date: row.date,
        category: row.category,
        text: row.text,
        images: [],
        media: [],
        ...(row.link ? { link: row.link } : {}),
      };
      items.set(row.id, item);
    }

    if (row.media_kind && row.media_url) {
      item.media.push({ kind: row.media_kind, url: row.media_url });
    }
  }

  for (const item of items.values()) {
    item.images = imageUrlsFromMedia(item.media);
  }

  return Array.from(items.values());
}

async function getMomentById(db: D1Database, id: string): Promise<MomentApiItem> {
  const sql = `
    SELECT m.id, m.date, m.category, m.text, m.link, m.created_at, m.updated_at,
           mm.id AS media_id, mm.kind AS media_kind, mm.url AS media_url, mm.sort_order AS media_sort_order
    FROM moments m
    LEFT JOIN moment_media mm ON mm.moment_id = m.id
    WHERE m.id = ?
    ORDER BY m.date DESC, m.id DESC, mm.sort_order ASC
  `;
  const { results } = await db.prepare(sql).bind(id).all<MomentListRow>();
  const items = aggregateMomentRows(results ?? []);
  if (!items[0]) {
    throw new Error("Moment not found after create");
  }
  return items[0];
}

function isValidMomentDate(value: string): boolean {
  if (!value || value.length > MAX_DATE_LENGTH) return false;
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value)) return false;

  const normalized = value.includes("T") ? `${value}:00Z` : `${value}T00:00:00Z`;
  return Number.isFinite(Date.parse(normalized));
}
