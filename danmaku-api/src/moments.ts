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
  pinned?: boolean;
  pinnedAt?: number;
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
  legacy_images: string | null;
  pinned?: number | null;
  pinned_at?: number | null;
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

  if (parsedCursor) {
    const unpinned = await queryMoments(db, {
      where: "pinned = 0 AND (date < ? OR (date = ? AND id < ?))",
      args: [parsedCursor.date, parsedCursor.date, parsedCursor.id],
      orderBy: "date DESC, id DESC",
      limit: normalizedLimit + 1,
    });
    const pageItems = unpinned.slice(0, normalizedLimit);
    const hasMore = unpinned.length > normalizedLimit;
    const tail = pageItems[pageItems.length - 1];
    return {
      items: pageItems,
      nextCursor: hasMore && tail ? formatCursor(tail.date, tail.id) : null,
    };
  }

  const pinnedCandidates = await queryMoments(db, {
    where: "pinned = 1",
    args: [],
    orderBy: "pinned_at DESC, id DESC",
    limit: Math.min(3, normalizedLimit) + 1,
  });
  const pinnedItems = pinnedCandidates
    .filter((item) => item.pinned === true)
    .slice(0, Math.min(3, normalizedLimit));
  const normalLimit = Math.max(0, normalizedLimit - pinnedItems.length);
  if (normalLimit === 0) {
    return { items: pinnedItems, nextCursor: null };
  }

  const unpinned = await queryMoments(db, {
    where: "pinned = 0",
    args: [],
    orderBy: "date DESC, id DESC",
    limit: normalLimit + 1,
  });
  const normalItems = unpinned.slice(0, normalLimit);
  const hasMore = unpinned.length > normalLimit;
  const tail = normalItems[normalItems.length - 1];

  return {
    items: pinnedItems.concat(normalItems),
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

  const statements = [
    db
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
      ),
    ...normalized.value.media.map((media, index) =>
      db
        .prepare(
          "INSERT INTO moment_media (id, moment_id, kind, url, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(createId(), momentId, media.kind, media.url, index, now)
    ),
  ];

  await db.batch(statements);
  return getMomentById(db, momentId);
}

export async function deleteMoment(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM moment_media WHERE moment_id = ?").bind(id).run();
  await db.prepare("DELETE FROM moments WHERE id = ?").bind(id).run();
}

export async function setMomentPinned(
  db: D1Database,
  id: string,
  pinned: boolean,
  options: { now?: () => number } = {}
): Promise<{ item: MomentApiItem; displacedId?: string }> {
  const current = await db
    .prepare("SELECT pinned, pinned_at FROM moments WHERE id = ?")
    .bind(id)
    .first<{ pinned: number; pinned_at: number | null }>();
  if (!current) throw momentError("MOMENT_NOT_FOUND", "Moment not found");

  if (pinned && current.pinned === 1) {
    return { item: await getMomentById(db, id) };
  }
  if (!pinned && current.pinned !== 1) {
    return { item: await getMomentById(db, id) };
  }

  if (!pinned) {
    await db.prepare("UPDATE moments SET pinned = 0, pinned_at = NULL WHERE id = ?").bind(id).run();
    return { item: await getMomentById(db, id) };
  }

  const { results } = await db
    .prepare("SELECT id, pinned_at FROM moments WHERE pinned = 1 ORDER BY pinned_at ASC, id ASC LIMIT 3")
    .bind()
    .all<{ id: string; pinned_at: number | null }>();
  const existingPins = results ?? [];
  const now = options.now?.() ?? Date.now();

  if (existingPins.length < 3) {
    await db.prepare("UPDATE moments SET pinned = 1, pinned_at = ? WHERE id = ?").bind(now, id).run();
    return { item: await getMomentById(db, id) };
  }

  const oldest = existingPins[0];
  await db.batch([
    db.prepare("UPDATE moments SET pinned = 0, pinned_at = NULL WHERE id = ?").bind(oldest.id),
    db.prepare("UPDATE moments SET pinned = 1, pinned_at = ? WHERE id = ?").bind(now, id),
  ]);

  return {
    item: await getMomentById(db, id),
    displacedId: oldest.id,
  };
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

async function queryMoments(
  db: D1Database,
  options: { where: string; args: unknown[]; orderBy: string; limit: number }
): Promise<MomentApiItem[]> {
  const sql = `
    WITH selected_moments AS (
      SELECT id, date, category, text, link, images AS legacy_images, created_at, updated_at, pinned, pinned_at
      FROM moments
      WHERE ${options.where}
      ORDER BY ${options.orderBy}
      LIMIT ?
    )
    SELECT m.id, m.date, m.category, m.text, m.link, m.legacy_images, m.created_at, m.updated_at,
           m.pinned, m.pinned_at,
           mm.id AS media_id, mm.kind AS media_kind, mm.url AS media_url, mm.sort_order AS media_sort_order
    FROM selected_moments m
    LEFT JOIN moment_media mm ON mm.moment_id = m.id
    ORDER BY ${options.orderBy.replace(/\b(date|id|pinned_at)\b/g, "m.$1")}, mm.sort_order ASC
  `;
  const { results } = await db
    .prepare(sql)
    .bind(...options.args, options.limit)
    .all<MomentListRow>();
  return aggregateMomentRows(results ?? []);
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
        ...(row.pinned === 1 ? { pinned: true } : {}),
        ...(row.pinned_at != null ? { pinnedAt: Number(row.pinned_at) } : {}),
      };
      items.set(row.id, item);
      if (row.legacy_images) {
        try {
          const legacy = JSON.parse(row.legacy_images) as unknown;
          if (Array.isArray(legacy)) {
            for (const url of legacy) {
              if (typeof url === "string" && url.trim()) {
                const value = url.trim();
                item.media.push({
                  kind: "image",
                  url: value.startsWith("/")
                    ? `https://pub-6108779417b647c592c51538e44c8bd0.r2.dev${value}`
                    : value,
                });
              }
            }
          }
        } catch {}
      }
    }

    if (row.media_kind && row.media_url) {
      item.media.push({ kind: row.media_kind, url: normalizeLegacyMediaUrl(row.media_url) });
    }
  }

  for (const item of items.values()) {
    item.images = imageUrlsFromMedia(item.media);
  }

  return Array.from(items.values());
}

function normalizeLegacyMediaUrl(value: string): string {
  return value.startsWith("/") ? `https://pub-6108779417b647c592c51538e44c8bd0.r2.dev${value}` : value;
}

async function getMomentById(db: D1Database, id: string): Promise<MomentApiItem> {
  const sql = `
    SELECT m.id, m.date, m.category, m.text, m.link, m.images AS legacy_images, m.created_at, m.updated_at,
           m.pinned, m.pinned_at,
           mm.id AS media_id, mm.kind AS media_kind, mm.url AS media_url, mm.sort_order AS media_sort_order
    FROM moments m
    LEFT JOIN moment_media mm ON mm.moment_id = m.id
    WHERE m.id = ?
    ORDER BY m.date DESC, m.id DESC, mm.sort_order ASC
  `;
  const { results } = await db.prepare(sql).bind(id).all<MomentListRow>();
  const items = aggregateMomentRows(results ?? []);
  if (!items[0]) throw momentError("MOMENT_NOT_FOUND", "Moment not found");
  return items[0];
}

function momentError(code: string, message: string): Error & { code?: string } {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  return error;
}

function isValidMomentDate(value: string): boolean {
  if (!value || value.length > MAX_DATE_LENGTH) return false;
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value)) return false;

  const normalized = value.includes("T") ? `${value}:00Z` : `${value}T00:00:00Z`;
  return Number.isFinite(Date.parse(normalized));
}