// md.test.mjs — guvenli markdown render'i (XSS kacisi + URL beyaz liste).
import { test } from "node:test";
import assert from "node:assert/strict";
import { md } from "../arayuz/src/md.js";

test("md: HTML kacilir (XSS yok)", () => {
  const h = md("<script>alert(1)</script>");
  assert.ok(!h.includes("<script>"), "ham <script> gecmemeli");
  assert.ok(h.includes("&lt;script&gt;"), "escaped olmali");
});

test("md: kalin, italik, baslik, liste", () => {
  assert.ok(md("**x**").includes("<strong>x</strong>"));
  assert.ok(md("# Baslik").includes("<h1"));
  const l = md("- a\n- b");
  assert.ok(l.includes("<ul"), "liste");
  assert.equal((l.match(/<li/g) || []).length, 2, "iki madde");
});

test("md: resim /api/ek koke goreli gecerli", () => {
  const h = md("![ekran](/api/ek/7)");
  assert.ok(h.includes('<img src="/api/ek/7"'), "gomulu gorsel");
});

test("md: tehlikeli URL engellenir", () => {
  assert.ok(md("[t](javascript:alert(1))").includes('href="#"'), "javascript: engellenmeli");
  assert.ok(md("[t](https://x.com)").includes('href="https://x.com"'), "https izinli");
});

test("md: kod blogu", () => {
  const h = md("```\nSELECT * FROM t\n```");
  assert.ok(h.includes("<pre") && h.includes("SELECT * FROM t"));
});
