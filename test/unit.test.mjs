import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

// Format functions
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}

function sanitizeSlug(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateRandomSlug() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

test("formatBytes formats various sizes correctly", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(500), "500 B");
  assert.equal(formatBytes(1024), "1 KB");
  assert.equal(formatBytes(1024 * 1024), "1 MB");
  assert.equal(formatBytes(1024 * 1024 * 1024), "1 GB");
  assert.equal(formatBytes(1572864), "1.5 MB");
});

test("sanitizeSlug produces URL-safe slugs", () => {
  assert.equal(sanitizeSlug("Tax Documents 2026!"), "tax-documents-2026");
  assert.equal(sanitizeSlug("   hello___world---test  "), "hello-world-test");
  assert.equal(sanitizeSlug("My Special #Files$"), "my-special-files");
});

test("generateRandomSlug generates 7-character url-safe string", () => {
  const slug = generateRandomSlug();
  assert.equal(slug.length, 7);
  assert.match(slug, /^[a-z0-9]+$/);
});

test("bcrypt password hashing and verification works accurately", async () => {
  const plainPassword = "SecretPassword123!";
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(plainPassword, salt);

  assert.ok(hash.startsWith("$2"));
  const isMatchValid = await bcrypt.compare(plainPassword, hash);
  assert.equal(isMatchValid, true);

  const isMatchInvalid = await bcrypt.compare("WrongPassword", hash);
  assert.equal(isMatchInvalid, false);
});
