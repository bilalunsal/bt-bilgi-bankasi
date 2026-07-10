// server.js — BT Bilgi Bankasi API + statik arayuz servisi. Bagimlilik: express + cors (+ yerlesik sqlite).
import express from "express";
import cors from "cors";
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import {
  veritabaniAc, TIPLER, alanTanimlari,
  ara, kayitEkle, kayitGetir, kayitGuncelle, kayitSil,
  yorumEkle, yorumlar, iliskiEkle, iliskiSil, iliskilerGetir,
  ekEkle, ekler, ekGetir, ekSil, uyarilar,
  gecmisGetir, istatistik,
  musteriListe, musteriEkle, musteriTokenYenile, musteriDurum,
  girisDene, oturumKullanici, oturumKapat, kullaniciBulKadi,
  kullaniciListe, kullaniciEkle, kullaniciDurum, kullaniciRol, parolaDegistir, parolaDogru,
  zimmetAta, zimmetIade, zimmetAktif, zimmetGecmisi, personelZimmetleri,
  ayarlariGetir, ayarlariKaydet,
} from "./db.js";
import { epostaTest } from "./eposta.js";
import { ILISKI_TURLERI, ZIMMETLENEBILIR } from "./tohum-alanlar.js";

// Ayarlarda gizli/parola alanlari — istemciye ASLA duz gonderilmez (yalniz "var mi" bilgisi).
const GIZLI_AYAR = new Set(["smtp_parola"]);

const META_URL = (typeof __dirname !== "undefined") ? pathToFileURL(__dirname + "/").href : import.meta.url;
const BU_KLASOR = dirname(fileURLToPath(META_URL));
const PROJE_KOK = resolve(BU_KLASOR, "..");
const PORT = Number(process.env.PORT) || 8793; // 8787=Strateji Masasi, 8790=BilgiTek CRM (cakisma kacinildi)

const EKLER_DIR = process.env.EKLER_DIR ? resolve(process.env.EKLER_DIR) : join(PROJE_KOK, "ekler");
const MAX_EK = 25 * 1024 * 1024; // 25 MB
if (!existsSync(EKLER_DIR)) mkdirSync(EKLER_DIR, { recursive: true });

const db = veritabaniAc();
const app = express();
app.use(cors());
app.use(express.json({ limit: "30mb" })); // base64 ekler icin (25MB ham → ~34MB base64)
app.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

const sarmala = (fn) => (req, res) => {
  try {
    const r = fn(req, res);
    // async handler'lar icin: promise reddini de yakala (yoksa 500 asilir kalir)
    if (r && typeof r.then === "function") r.catch((e) => { console.error(e); if (!res.headersSent) res.status(500).json({ hata: e.message }); });
  } catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ hata: e.message }); }
};

// ── Kimlik dogrulama (cerez tabanli oturum) ──────────────────────────────────
function cerezToken(req) {
  const c = req.headers.cookie || "";
  const m = c.split(";").map((x) => x.trim()).find((x) => x.startsWith("oturum="));
  return m ? decodeURIComponent(m.slice("oturum=".length)) : null;
}
function cerezYaz(res, token) {
  res.set("Set-Cookie", `oturum=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 86400}`);
}
function cerezSil(res) { res.set("Set-Cookie", "oturum=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"); }

const SERBEST = new Set(["/api/giris", "/api/cikis", "/api/ben", "/api/version"]);
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();     // statik arayuz guard'dan once
  if (SERBEST.has(req.path)) return next();
  const k = oturumKullanici(db, cerezToken(req));
  if (!k) return res.status(401).json({ hata: "Giriş gerekli" });
  req.kullanici = k;
  next();
});
const adminGerek = (req, res) => {
  if (req.kullanici?.rol !== "admin") { res.status(403).json({ hata: "Yönetici yetkisi gerekli" }); return false; }
  return true;
};

app.post("/api/giris", sarmala((req, res) => {
  const { kadi, parola } = req.body || {};
  const s = girisDene(db, kadi, parola);
  if (!s) return res.status(401).json({ hata: "Kullanıcı adı veya parola hatalı" });
  cerezYaz(res, s.token);
  res.json({ kullanici: s.kullanici });
}));
app.post("/api/cikis", sarmala((req, res) => { oturumKapat(db, cerezToken(req)); cerezSil(res); res.json({ ok: true }); }));
app.get("/api/ben", sarmala((req, res) => {
  const k = oturumKullanici(db, cerezToken(req));
  if (!k) return res.status(401).json({ hata: "Oturum yok" });
  res.json({ kullanici: k });
}));
// Kendi parolasini degistir
app.post("/api/parola", sarmala((req, res) => {
  const { eski, yeni } = req.body || {};
  if (!yeni || String(yeni).length < 4) return res.status(400).json({ hata: "Yeni parola en az 4 karakter olmalı" });
  const tam = kullaniciBulKadi(db, req.kullanici.kadi);
  if (!parolaDogru(eski, tam.parola)) return res.status(400).json({ hata: "Mevcut parola hatalı" });
  parolaDegistir(db, req.kullanici.id, yeni, { yenileBayragi: 0 });
  res.json({ ok: true });
}));

// ── Kullanici yonetimi (yalnizca admin) ──────────────────────────────────────
app.get("/api/kullanicilar", sarmala((req, res) => { if (!adminGerek(req, res)) return; res.json(kullaniciListe(db)); }));
app.post("/api/kullanicilar", sarmala((req, res) => {
  if (!adminGerek(req, res)) return;
  const { kadi, ad, rol, parola } = req.body || {};
  try { res.status(201).json({ id: kullaniciEkle(db, { kadi, ad, rol, parola }) }); }
  catch (e) { res.status(400).json({ hata: e.message }); }
}));
app.post("/api/kullanicilar/:id/sifirla", sarmala((req, res) => {
  if (!adminGerek(req, res)) return;
  const { yeni } = req.body || {};
  if (!yeni || String(yeni).length < 4) return res.status(400).json({ hata: "Parola en az 4 karakter" });
  parolaDegistir(db, Number(req.params.id), yeni, { yenileBayragi: 1 }); // ilk giriste degistirsin
  res.json({ ok: true });
}));
app.post("/api/kullanicilar/:id/durum", sarmala((req, res) => {
  if (!adminGerek(req, res)) return;
  if (Number(req.params.id) === req.kullanici.id) return res.status(400).json({ hata: "Kendi hesabınızı pasifleştiremezsiniz" });
  res.json({ ok: kullaniciDurum(db, Number(req.params.id), !!(req.body || {}).aktif) });
}));
app.post("/api/kullanicilar/:id/rol", sarmala((req, res) => {
  if (!adminGerek(req, res)) return;
  res.json({ ok: kullaniciRol(db, Number(req.params.id), (req.body || {}).rol) });
}));

// ── Ayarlar (yalnizca admin) — SMTP / e-posta bildirim ───────────────────────
// GET: parola alanlari MASKELENIR (smtp_parola_var: true/false doner, deger gitmez).
app.get("/api/ayarlar", sarmala((req, res) => {
  if (!adminGerek(req, res)) return;
  const ham = ayarlariGetir(db);
  const cikti = {};
  for (const [k, v] of Object.entries(ham)) { if (!GIZLI_AYAR.has(k)) cikti[k] = v; }
  cikti.smtp_parola_var = !!ham.smtp_parola; // parola tanimli mi (deger gonderilmez)
  res.json(cikti);
}));
// PUT: gonderilen anahtarlari yazar. Parola BOS gelirse mevcut deger KORUNUR (ezilmez).
app.put("/api/ayarlar", sarmala((req, res) => {
  if (!adminGerek(req, res)) return;
  const g = req.body || {};
  const yaz = {};
  const IZIN = ["smtp_host", "smtp_port", "smtp_kullanici", "smtp_gonderen",
    "bildirim_hedef", "bildirim_aktif", "bildirim_yeni_talep"];
  for (const k of IZIN) if (k in g) yaz[k] = g[k] == null ? "" : String(g[k]);
  // Parola: sadece dolu geldiyse guncelle (bos string → dokunma)
  if (typeof g.smtp_parola === "string" && g.smtp_parola.length > 0) yaz.smtp_parola = g.smtp_parola;
  ayarlariKaydet(db, yaz);
  res.json({ ok: true });
}));
// Test maili gonder (ana anahtardan bagimsiz). Opsiyonel { kime }.
app.post("/api/ayarlar/eposta-test", sarmala(async (req, res) => {
  if (!adminGerek(req, res)) return;
  const sonuc = await epostaTest(db, (req.body || {}).kime);
  res.json(sonuc);
}));

// ── Meta ────────────────────────────────────────────────────────────────────
app.get("/api/version", sarmala((_req, res) => {
  const v = JSON.parse(readFileSync(join(PROJE_KOK, "version.json"), "utf8"));
  res.json(v);
}));
app.get("/api/tipler", sarmala((_req, res) => {
  res.json({ tipler: TIPLER, iliskiTurleri: ILISKI_TURLERI, zimmetlenebilir: ZIMMETLENEBILIR });
}));
app.get("/api/alanlar", sarmala((req, res) => {
  res.json(alanTanimlari(db, req.query.tip || null));
}));
app.get("/api/istatistik", sarmala((_req, res) => res.json(istatistik(db))));
app.get("/api/uyarilar", sarmala((req, res) => {
  const gun = Math.max(1, Math.min(Number(req.query.gun) || 45, 365));
  res.json(uyarilar(db, { gun }));
}));

// ── Arama / liste ─────────────────────────────────────────────────────────
app.get("/api/ara", sarmala((req, res) => {
  const { q = "", tip = null, durum = null } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  res.json(ara(db, { q, tip, durum, limit, offset }));
}));

// ── Kayit CRUD ──────────────────────────────────────────────────────────────
app.get("/api/kayit/:id", sarmala((req, res) => {
  const k = kayitGetir(db, Number(req.params.id));
  if (!k) return res.status(404).json({ hata: "Kayit bulunamadi" });
  const cikti = {
    ...k,
    yorumlar: yorumlar(db, k.id),
    iliskiler: iliskilerGetir(db, k.id),
    ekler: ekler(db, k.id),
    gecmis: gecmisGetir(db, k.id),
  };
  if (ZIMMETLENEBILIR.includes(k.tip)) {
    cikti.zimmet = { aktif: zimmetAktif(db, k.id), gecmis: zimmetGecmisi(db, k.id) };
  }
  if (k.tip === "personel") {
    cikti.personelZimmet = personelZimmetleri(db, k.id); // ters sorgu
  }
  res.json(cikti);
}));
app.post("/api/kayit", sarmala((req, res) => {
  const g = req.body || {};
  if (!g.tip || !g.baslik) return res.status(400).json({ hata: "tip ve baslik zorunlu" });
  const id = kayitEkle(db, g);
  res.status(201).json(kayitGetir(db, id));
}));
app.put("/api/kayit/:id", sarmala((req, res) => {
  const ok = kayitGuncelle(db, Number(req.params.id), req.body || {});
  if (!ok) return res.status(404).json({ hata: "Kayit bulunamadi" });
  res.json(kayitGetir(db, Number(req.params.id)));
}));
app.delete("/api/kayit/:id", sarmala((req, res) => {
  res.json({ silindi: kayitSil(db, Number(req.params.id)) });
}));

// ── Yorum / iliski ──────────────────────────────────────────────────────────
app.post("/api/kayit/:id/yorum", sarmala((req, res) => {
  const { metin, yazar } = req.body || {};
  if (!metin) return res.status(400).json({ hata: "metin zorunlu" });
  const id = yorumEkle(db, Number(req.params.id), { metin, yazar });
  res.status(201).json({ id, yorumlar: yorumlar(db, Number(req.params.id)) });
}));
app.post("/api/kayit/:id/iliski", sarmala((req, res) => {
  const { hedef_id, tur } = req.body || {};
  if (!hedef_id || !tur) return res.status(400).json({ hata: "hedef_id ve tur zorunlu" });
  iliskiEkle(db, Number(req.params.id), Number(hedef_id), tur);
  res.status(201).json({ iliskiler: iliskilerGetir(db, Number(req.params.id)) });
}));
app.delete("/api/iliski/:id", sarmala((req, res) => {
  res.json({ silindi: iliskiSil(db, Number(req.params.id)) });
}));

// ── Zimmet (change management) ────────────────────────────────────────────────
app.post("/api/kayit/:id/zimmet", sarmala((req, res) => {
  const { personel_id, not: not_ } = req.body || {};
  if (!personel_id) return res.status(400).json({ hata: "personel_id zorunlu" });
  const atayan = req.kullanici?.ad || req.kullanici?.kadi || null;
  try {
    zimmetAta(db, { kayitId: Number(req.params.id), personelId: Number(personel_id), atayan, not_: not_ || null });
    res.json({ zimmet: { aktif: zimmetAktif(db, Number(req.params.id)), gecmis: zimmetGecmisi(db, Number(req.params.id)) } });
  } catch (e) { res.status(400).json({ hata: e.message }); }
}));
app.post("/api/kayit/:id/iade", sarmala((req, res) => {
  const atayan = req.kullanici?.ad || req.kullanici?.kadi || null;
  const ok = zimmetIade(db, { kayitId: Number(req.params.id), atayan, not_: (req.body || {}).not || null });
  res.json({ iade: ok, zimmet: { aktif: null, gecmis: zimmetGecmisi(db, Number(req.params.id)) } });
}));

// ── Ekler (dosya: base64 govde → disk) ────────────────────────────────────────
app.post("/api/kayit/:id/ek", sarmala((req, res) => {
  const kayitId = Number(req.params.id);
  if (!kayitGetir(db, kayitId)) return res.status(404).json({ hata: "Kayit bulunamadi" });
  let { dosya_ad, tur, veri_b64, yukleyen } = req.body || {};
  if (!dosya_ad || !veri_b64) return res.status(400).json({ hata: "dosya_ad ve veri_b64 zorunlu" });
  const b64 = String(veri_b64).replace(/^data:[^;]*;base64,/, "");
  const buf = Buffer.from(b64, "base64");
  if (buf.length === 0) return res.status(400).json({ hata: "Bos/gecersiz dosya" });
  if (buf.length > MAX_EK) return res.status(413).json({ hata: `Dosya cok buyuk (max ${MAX_EK / 1048576} MB)` });

  const guvenliAd = basename(String(dosya_ad)).replace(/[^\w.\-() çğıöşüÇĞİÖŞÜ]/g, "_").slice(0, 120) || "dosya";
  const klasor = join(EKLER_DIR, String(kayitId));
  if (!existsSync(klasor)) mkdirSync(klasor, { recursive: true });
  const diskAd = `${randomUUID()}__${guvenliAd}`;
  writeFileSync(join(klasor, diskAd), buf);
  const goreli = `${kayitId}/${diskAd}`; // EKLER_DIR'e goreli
  ekEkle(db, kayitId, { dosya_ad: guvenliAd, yol: goreli, boyut: buf.length, tur: tur || null, yukleyen: yukleyen || null });
  res.status(201).json({ ekler: ekler(db, kayitId) });
}));
app.get("/api/ek/:id", sarmala((req, res) => {
  const ek = ekGetir(db, Number(req.params.id));
  if (!ek) return res.status(404).json({ hata: "Ek bulunamadi" });
  const tam = resolve(EKLER_DIR, ek.yol);
  if (!tam.startsWith(resolve(EKLER_DIR)) || !existsSync(tam)) return res.status(404).json({ hata: "Dosya yok" });
  res.download(tam, ek.dosya_ad);
}));
app.delete("/api/ek/:id", sarmala((req, res) => {
  const ek = ekSil(db, Number(req.params.id));
  if (ek) {
    const tam = resolve(EKLER_DIR, ek.yol);
    if (tam.startsWith(resolve(EKLER_DIR)) && existsSync(tam)) { try { unlinkSync(tam); } catch { /* yoksay */ } }
  }
  res.json({ silindi: !!ek });
}));

// ── Musteriler (talep kapisi yonetimi — LAN/personel) ─────────────────────────
app.get("/api/musteriler", sarmala((_req, res) => res.json(musteriListe(db))));
app.post("/api/musteriler", sarmala((req, res) => {
  const { ad, eposta } = req.body || {};
  if (!ad) return res.status(400).json({ hata: "ad zorunlu" });
  res.status(201).json(musteriEkle(db, { ad, eposta: eposta || null })); // token bir kez doner
}));
app.post("/api/musteriler/:id/token-yenile", sarmala((req, res) => {
  const token = musteriTokenYenile(db, Number(req.params.id));
  if (!token) return res.status(404).json({ hata: "Musteri bulunamadi" });
  res.json({ token });
}));
app.post("/api/musteriler/:id/durum", sarmala((req, res) => {
  res.json({ ok: musteriDurum(db, Number(req.params.id), !!(req.body || {}).aktif) });
}));

// ── Statik arayuz (arayuz/dist varsa) ────────────────────────────────────────
// Tarayici ONBELLEK TUTMASIN: express.static/sendFile kendi ETag/Cache-Control'unu koyar,
// bu da guncelleme sonrasi eski surumun kalmasina yol acar. Hepsini no-store yapiyoruz
// (LAN'de dosyalar kucuk; her yuklemede taze gelir → guncelleme aninda gorunur).
const CACHE_YOK = "no-store, no-cache, must-revalidate, max-age=0";
const DIST = join(PROJE_KOK, "arayuz", "dist");
if (existsSync(DIST)) {
  app.use(express.static(DIST, {
    etag: false,
    lastModified: false,
    setHeaders: (res) => res.set("Cache-Control", CACHE_YOK),
  }));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.set("Cache-Control", CACHE_YOK);
    res.sendFile(join(DIST, "index.html"), { etag: false, lastModified: false, cacheControl: false });
  });
}

app.listen(PORT, () => {
  console.log(`SITMS API → http://localhost:${PORT}  (db: ${db ? "acik" : "?"})`);
});
