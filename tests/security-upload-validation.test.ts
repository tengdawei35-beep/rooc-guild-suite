import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { normalizeOcrImage, normalizeOcrImages } from "../src/lib/security/ocr-image";
import { readBoundedRequestText, readMultipartFormData, RequestBodyTooLargeError } from "../src/lib/security/multipart";
import { hasPermission } from "../src/lib/permissions";

test("multipart reader parses a bounded form upload", async () => {
  const form = new FormData();
  form.set("memberId", "member-1");
  form.set("images", new Blob(["small image payload"], { type: "image/png" }), "sample.png");
  const request = new Request("https://example.test/upload", { method: "POST", body: form });
  const parsed = await readMultipartFormData(request, 4096);
  assert.equal(parsed.get("memberId"), "member-1");
  assert.ok(parsed.get("images") instanceof File);
});

test("multipart reader rejects a body that exceeds its streaming ceiling", async () => {
  const form = new FormData();
  form.set("file", new Blob(["x".repeat(2048)]), "large.bin");
  const request = new Request("https://example.test/upload", { method: "POST", body: form });
  await assert.rejects(
    () => readMultipartFormData(request, 512),
    (error: unknown) => error instanceof RequestBodyTooLargeError,
  );
});

test("OCR image validation normalizes real image bytes to WebP", async () => {
  const png = await sharp({
    create: { width: 32, height: 24, channels: 3, background: { r: 200, g: 100, b: 50 } },
  }).png().toBuffer();
  const normalized = await normalizeOcrImage(png);
  const metadata = await sharp(normalized).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 32);
  assert.equal(metadata.height, 24);
});

test("OCR image validation rejects bytes that are not a supported image", async () => {
  await assert.rejects(() => normalizeOcrImage(Buffer.from("not an image")));
});

test("expired guilds retain only their original role's read permissions", () => {
  assert.equal(hasPermission("READ_ONLY_MEMBER", "members.view"), true);
  assert.equal(hasPermission("READ_ONLY_MEMBER", "events.view"), true);
  assert.equal(hasPermission("READ_ONLY_MEMBER", "rosters.view"), true);
  assert.equal(hasPermission("READ_ONLY_MEMBER", "allocation.view"), false);
  assert.equal(hasPermission("READ_ONLY_MEMBER", "users.view"), false);
  assert.equal(hasPermission("READ_ONLY_MEMBER", "applicants.view"), false);
  assert.equal(hasPermission("READ_ONLY_ADMIN", "allocation.view"), true);
  assert.equal(hasPermission("READ_ONLY_ADMIN", "users.view"), true);
  assert.equal(hasPermission("READ_ONLY_ADMIN", "applicants.view"), true);
  assert.equal(hasPermission("READ_ONLY_ADMIN", "members.edit"), false);
  assert.equal(hasPermission("READ_ONLY_ADMIN", "events.manage"), false);
  assert.equal(hasPermission("READ_ONLY_ADMIN", "leave.manageOwn"), false);
  assert.equal(hasPermission("READ_ONLY_ADMIN", "users.manage"), false);
});


test("bounded request reader accepts small webhook payloads", async () => {
  const request = new Request("https://example.test/webhook", { method: "POST", body: "{\\"type\\":1}" });
  assert.equal(await readBoundedRequestText(request, 64), "{\\"type\\":1}");
});

test("bounded request reader rejects oversized webhook payloads", async () => {
  const request = new Request("https://example.test/webhook", { method: "POST", body: "x".repeat(1024) });
  await assert.rejects(
    () => readBoundedRequestText(request, 128),
    (error: unknown) => error instanceof RequestBodyTooLargeError,
  );
});

test("OCR normalization enforces an aggregate decoded pixel budget", async () => {
  const png = await sharp({
    create: { width: 32, height: 24, channels: 3, background: { r: 10, g: 20, b: 30 } },
  }).png().toBuffer();
  await assert.rejects(
    () => normalizeOcrImages([png, png], 1000),
    /Combined screenshot dimensions exceed/,
  );
});
