import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-admin-password.mjs "password"');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 310000, 32, "sha256");

console.log(`pbkdf2$sha256$310000$${salt.toString("base64url")}$${hash.toString("base64url")}`);
