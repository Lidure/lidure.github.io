# Scripts

## Import legacy moments

Generate repeatable SQL from the checked-in static moments data:

```bash
node scripts/import-moments.mjs --input src/data/moments.json --output .tmp/moments-import.sql
```

Apply the generated SQL to D1 after reviewing it:

```bash
cd danmaku-api
npx wrangler d1 execute lidure-danmaku --remote --file ../.tmp/moments-import.sql
```

The import uses deterministic SHA-256 IDs and `INSERT OR IGNORE`, so running the same SQL repeatedly does not duplicate existing moments or media rows. The script does not read or print credentials, cookies, or API secrets.
