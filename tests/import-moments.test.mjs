import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const importScript = path.join(repoRoot, "scripts", "import-moments.mjs");
const legacyR2BaseUrl = "https://pub-6108779417b647c592c51538e44c8bd0.r2.dev";
const publicMediaBaseUrl = "https://media.lidure.xyz";

test("importer skips media URLs that the moments API would reject", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "moments-import-"));
  const inputPath = path.join(tempDir, "moments.json");
  const outputPath = path.join(tempDir, "moments.sql");
  const generatedImageUrl = `${publicMediaBaseUrl}/moments/2026/08/123e4567-e89b-12d3-a456-426614174000.png`;
  const generatedLegacyUrl = `${legacyR2BaseUrl}/moments/2026/08/123e4567-e89b-12d3-a456-426614174001.jpg`;
  const unsupportedLegacyUrl = `${legacyR2BaseUrl}/moments/not-generated.png`;
  const untrustedExternalUrl = "https://evil.example/not-trusted.png";

  await writeFile(
    inputPath,
    JSON.stringify(
      [
        {
          date: "2026-08-12",
          category: "生活",
          text: "Import media boundary check",
          images: [untrustedExternalUrl, unsupportedLegacyUrl, generatedImageUrl, generatedLegacyUrl],
        },
      ],
      null,
      2
    ),
    "utf8"
  );

  const { stdout, stderr } = await execFileAsync(process.execPath, [
    importScript,
    "--input",
    inputPath,
    "--output",
    outputPath,
  ]);
  const sql = await readFile(outputPath, "utf8");

  assert.match(stdout, /Wrote 1 moments and 2 media rows/);
  assert.match(stderr, /Skipped 2 unsupported media URLs/);
  assert.match(sql, new RegExp(escapeRegExp(generatedImageUrl)));
  assert.match(
    sql,
    new RegExp(escapeRegExp(`${publicMediaBaseUrl}/moments/2026/08/123e4567-e89b-12d3-a456-426614174001.jpg`))
  );
  assert.doesNotMatch(sql, /evil\.example/);
  assert.doesNotMatch(sql, /moments\/not-generated\.png/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
