import { describe, expect, it, vi } from "vitest";

import { createSession, sessionCookie } from "../src/auth";
import worker from "../src/index";
import { normalizeMomentMediaInput, validateUpload } from "../src/media";

type FetchEnv = Parameters<typeof worker.fetch>[1];

type BoundStatement = {
  all: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
};

function makeBoundStatement(overrides: Partial<BoundStatement> = {}): BoundStatement {
  return {
    all: vi.fn().mockResolvedValue({ results: [] }),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function makeDb(): D1Database {
  return {
    prepare() {
      return {
        bind() {
          return makeBoundStatement();
        },
      };
    },
  } as unknown as D1Database;
}

function makeMediaBucket() {
  const put = vi.fn().mockResolvedValue({});
  return {
    bucket: { put } as unknown as R2Bucket,
    put,
  };
}

function makeEnv(overrides: Partial<FetchEnv> = {}): FetchEnv {
  const media = makeMediaBucket();
  return {
    DB: makeDb(),
    MEDIA: media.bucket,
    ALLOWED_ORIGINS: "https://lidure.xyz",
    PUBLIC_MEDIA_BASE_URL: "https://media.lidure.xyz",
    SESSION_SECRET: "test-session-secret",
    ...overrides,
  };
}

async function makeCookie(): Promise<string> {
  const value = await createSession("test-session-secret", Date.now());
  return sessionCookie(value);
}

function uploadRequest(body: BodyInit, headers: HeadersInit = {}): Request {
  return new Request("https://api.lidure.xyz/api/media/upload", {
    method: "POST",
    headers: {
      Origin: "https://lidure.xyz",
      ...headers,
    },
    body,
  });
}

function file(bytes: number, type: string, name = "upload.bin"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("validateUpload", () => {
  it("normalizes allowed image and video MIME types", () => {
    expect(validateUpload({ type: "image/png", size: 10 })).toEqual({
      ok: true,
      kind: "image",
      extension: "png",
      contentType: "image/png",
    });
    expect(validateUpload({ type: "video/webm", size: 10 })).toEqual({
      ok: true,
      kind: "video",
      extension: "webm",
      contentType: "video/webm",
    });
  });

  it("normalizes poster uploads as JPEG poster media", () => {
    expect(validateUpload({ type: "image/jpeg", size: 10 }, { requestedKind: "poster" })).toEqual({
      ok: true,
      kind: "poster",
      extension: "jpg",
      contentType: "image/jpeg",
    });
  });

  it("rejects empty files, unknown MIME types, and oversized payloads with stable codes", () => {
    expect(validateUpload({ type: "image/png", size: 0 })).toEqual({
      ok: false,
      code: "MEDIA_EMPTY",
    });
    expect(validateUpload({ type: "application/x-msdownload", size: 10 })).toEqual({
      ok: false,
      code: "MEDIA_TYPE_NOT_ALLOWED",
    });
    expect(validateUpload({ type: "image/png", size: 8 * 1024 * 1024 + 1 })).toEqual({
      ok: false,
      code: "MEDIA_TOO_LARGE",
      limit: 8 * 1024 * 1024,
    });
    expect(validateUpload({ type: "video/mp4", size: 100 * 1024 * 1024 + 1 })).toEqual({
      ok: false,
      code: "MEDIA_TOO_LARGE",
      limit: 100 * 1024 * 1024,
    });
  });
});

describe("normalizeMomentMediaInput upload key enforcement", () => {
  it("accepts generated R2 keys and converts them to public media URLs in order", () => {
    const result = normalizeMomentMediaInput(
      [
        { kind: "video", key: "moments/2026/08/11111111-1111-4111-8111-111111111111.mp4" },
        { kind: "poster", key: "moments/2026/08/22222222-2222-4222-8222-222222222222.jpg" },
        { kind: "image", url: "https://media.lidure.xyz/moments/2026/08/33333333-3333-4333-8333-333333333333.png" },
      ],
      { publicMediaBaseUrl: "https://media.lidure.xyz" }
    );

    expect(result).toEqual({
      ok: true,
      value: [
        {
          kind: "video",
          url: "https://media.lidure.xyz/moments/2026/08/11111111-1111-4111-8111-111111111111.mp4",
        },
        {
          kind: "poster",
          url: "https://media.lidure.xyz/moments/2026/08/22222222-2222-4222-8222-222222222222.jpg",
        },
        {
          kind: "image",
          url: "https://media.lidure.xyz/moments/2026/08/33333333-3333-4333-8333-333333333333.png",
        },
      ],
    });
  });

  it("rejects arbitrary keys and URLs outside the public media base", () => {
    expect(
      normalizeMomentMediaInput(
        [{ kind: "image", key: "avatars/not-from-upload.png" }],
        { publicMediaBaseUrl: "https://media.lidure.xyz" }
      )
    ).toEqual({
      ok: false,
      error: {
        code: "INVALID_MEDIA_KEY",
        message: "Moment media key must be a generated upload key",
      },
    });

    expect(
      normalizeMomentMediaInput(
        [{ kind: "image", url: "https://example.com/proxy-me.png" }],
        { publicMediaBaseUrl: "https://media.lidure.xyz" }
      )
    ).toEqual({
      ok: false,
      error: {
        code: "INVALID_MEDIA_URL",
        message: "Moment media URL must use the configured public media base URL",
      },
    });
  });

  it("rejects public media URLs that do not contain generated upload keys", () => {
    expect(
      normalizeMomentMediaInput(
        [{ kind: "image", url: "https://media.lidure.xyz/moments/not-generated.png" }],
        { publicMediaBaseUrl: "https://media.lidure.xyz" }
      )
    ).toEqual({
      ok: false,
      error: {
        code: "INVALID_MEDIA_KEY",
        message: "Moment media URL must contain a generated upload key",
      },
    });
  });
});

describe("POST /api/media/upload", () => {
  it("requires a session before accepting multipart uploads", async () => {
    const media = makeMediaBucket();
    const form = new FormData();
    form.set("file", file(10, "image/png", "avatar.png"));

    const response = await worker.fetch(uploadRequest(form), makeEnv({ MEDIA: media.bucket }));

    expect(response.status).toBe(401);
    expect(media.put).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required.",
      code: "AUTH_REQUIRED",
    });
  });

  it("rejects non-multipart upload requests", async () => {
    const response = await worker.fetch(
      uploadRequest("{}", {
        Cookie: await makeCookie(),
        "Content-Type": "application/json",
      }),
      makeEnv()
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      error: "Expected multipart/form-data.",
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
  });

  it("rejects empty uploads with a 400 response", async () => {
    const form = new FormData();
    form.set("file", file(0, "image/png", "empty.png"));

    const response = await worker.fetch(
      uploadRequest(form, { Cookie: await makeCookie() }),
      makeEnv()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Uploaded media file is empty.",
      code: "MEDIA_EMPTY",
    });
  });

  it("rejects unknown MIME types with a 415 response", async () => {
    const form = new FormData();
    form.set("file", file(10, "application/x-msdownload", "bad.exe"));

    const response = await worker.fetch(
      uploadRequest(form, { Cookie: await makeCookie() }),
      makeEnv()
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      error: "Media type is not allowed.",
      code: "MEDIA_TYPE_NOT_ALLOWED",
    });
  });

  it("rejects image and video payloads over their size limits", async () => {
    const imageForm = new FormData();
    imageForm.set("file", file(8 * 1024 * 1024 + 1, "image/jpeg", "large.jpg"));

    const imageResponse = await worker.fetch(
      uploadRequest(imageForm, { Cookie: await makeCookie() }),
      makeEnv()
    );

    expect(imageResponse.status).toBe(413);
    await expect(imageResponse.json()).resolves.toEqual({
      error: "Uploaded media exceeds the size limit.",
      code: "MEDIA_TOO_LARGE",
      limit: 8 * 1024 * 1024,
    });

    const videoForm = new FormData();
    videoForm.set("file", file(100 * 1024 * 1024 + 1, "video/mp4", "large.mp4"));

    const videoResponse = await worker.fetch(
      uploadRequest(videoForm, { Cookie: await makeCookie() }),
      makeEnv()
    );

    expect(videoResponse.status).toBe(413);
    await expect(videoResponse.json()).resolves.toEqual({
      error: "Uploaded media exceeds the size limit.",
      code: "MEDIA_TOO_LARGE",
      limit: 100 * 1024 * 1024,
    });
  });

  it("stores valid image, video, and poster uploads in R2 with metadata", async () => {
    const media = makeMediaBucket();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 7, 12, 1, 2, 3));
    const uuidSpy = vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222")
      .mockReturnValueOnce("33333333-3333-4333-8333-333333333333");

    try {
      const imageForm = new FormData();
      imageForm.set("file", file(10, "image/webp", "image.webp"));

      const imageResponse = await worker.fetch(
        uploadRequest(imageForm, { Cookie: await makeCookie() }),
        makeEnv({ MEDIA: media.bucket })
      );

      expect(imageResponse.status).toBe(201);
      await expect(imageResponse.json()).resolves.toEqual({
        url: "https://media.lidure.xyz/moments/2026/08/11111111-1111-4111-8111-111111111111.webp",
        key: "moments/2026/08/11111111-1111-4111-8111-111111111111.webp",
        kind: "image",
      });

      const videoForm = new FormData();
      videoForm.set("file", file(10, "video/mp4", "video.mp4"));

      const videoResponse = await worker.fetch(
        uploadRequest(videoForm, { Cookie: await makeCookie() }),
        makeEnv({ MEDIA: media.bucket })
      );

      expect(videoResponse.status).toBe(201);
      await expect(videoResponse.json()).resolves.toEqual({
        url: "https://media.lidure.xyz/moments/2026/08/22222222-2222-4222-8222-222222222222.mp4",
        key: "moments/2026/08/22222222-2222-4222-8222-222222222222.mp4",
        kind: "video",
      });

      const posterForm = new FormData();
      posterForm.set("kind", "poster");
      posterForm.set("file", file(10, "image/jpeg", "poster.jpg"));

      const posterResponse = await worker.fetch(
        uploadRequest(posterForm, { Cookie: await makeCookie() }),
        makeEnv({ MEDIA: media.bucket })
      );

      expect(posterResponse.status).toBe(201);
      await expect(posterResponse.json()).resolves.toEqual({
        url: "https://media.lidure.xyz/moments/2026/08/33333333-3333-4333-8333-333333333333.jpg",
        key: "moments/2026/08/33333333-3333-4333-8333-333333333333.jpg",
        kind: "poster",
      });

      expect(media.put).toHaveBeenNthCalledWith(
        1,
        "moments/2026/08/11111111-1111-4111-8111-111111111111.webp",
        expect.any(ArrayBuffer),
        { httpMetadata: { contentType: "image/webp" } }
      );
      expect(media.put).toHaveBeenNthCalledWith(
        2,
        "moments/2026/08/22222222-2222-4222-8222-222222222222.mp4",
        expect.any(ArrayBuffer),
        { httpMetadata: { contentType: "video/mp4" } }
      );
      expect(media.put).toHaveBeenNthCalledWith(
        3,
        "moments/2026/08/33333333-3333-4333-8333-333333333333.jpg",
        expect.any(ArrayBuffer),
        { httpMetadata: { contentType: "image/jpeg" } }
      );
    } finally {
      nowSpy.mockRestore();
      uuidSpy.mockRestore();
    }
  });
});
