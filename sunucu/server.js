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
  ayarGetir, ayarKur, ayarlariGetir, ayarlariKaydet,
} from "./db.js";
import { epostaTest } from "./eposta.js";
import { yedekConfig, yedekAl, yedekListe, otomatikYedekDene, YEDEK_ADI_DESEN } from "./yedek.js";
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

const SERBEST = new Set(["/api/giris", "/api/cikis", "/api/ben", "/api/version", "/api/marka"]);
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
  // marka_logo buyuk bir data URI → ayar echo'suna koyma; arayuz onu /api/marka'dan alir.
  for (const [k, v] of Object.entries(ham)) { if (!GIZLI_AYAR.has(k) && k !== "marka_logo") cikti[k] = v; }
  cikti.smtp_parola_var = !!ham.smtp_parola; // parola tanimli mi (deger gonderilmez)
  res.json(cikti);
}));
// PUT: gonderilen anahtarlari yazar. Parola BOS gelirse mevcut deger KORUNUR (ezilmez).
app.put("/api/ayarlar", sarmala((req, res) => {
  if (!adminGerek(req, res)) return;
  const g = req.body || {};
  const yaz = {};
  const IZIN = ["smtp_host", "smtp_port", "smtp_kullanici", "smtp_gonderen",
    "bildirim_hedef", "bildirim_aktif", "bildirim_yeni_talep",
    "marka_ad", "marka_tam",
    "yedek_aktif", "yedek_klasor", "yedek_tut"];
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

// ── Yedekleme (yalnizca admin) ───────────────────────────────────────────────
// Hedef ikinci disk / ag paylasimi olabilir. Varsayilan: <proje>/_yedekler (ayni disk).
const YEDEK_VARSAYILAN = process.env.YEDEK_DIR ? resolve(process.env.YEDEK_DIR) : join(PROJE_KOK, "_yedekler");
app.post("/api/yedek/simdi", sarmala((req, res) => {
  if (!adminGerek(req, res)) return;
  const c = yedekConfig(db, YEDEK_VARSAYILAN);
  try { res.json({ ok: true, ...yedekAl(db, c.klasor, c.tut) }); }
  catch (e) { res.status(500).json({ hata: e.message }); }
}));
app.get("/api/yedek/liste", sarmala((req, res) => {
  if (!adminGerek(req, res)) return;
  const c = yedekConfig(db, YEDEK_VARSAYILAN);
  res.json({ klasor: c.klasor, varsayilanKlasor: c.varsayilanKlasor, aktif: c.aktif, tut: c.tut, son: c.son, liste: yedekListe(c.klasor) });
}));
app.get("/api/yedek/indir", sarmala((req, res) => {
  if (!adminGerek(req, res)) return;
  const ad = basename(String(req.query.ad || ""));
  if (!YEDEK_ADI_DESEN.test(ad)) return res.status(400).json({ hata: "Geçersiz dosya adı" });
  const c = yedekConfig(db, YEDEK_VARSAYILAN);
  const yol = join(c.klasor, ad);
  if (!existsSync(yol)) return res.status(404).json({ hata: "Bulunamadı" });
  res.download(yol, ad);
}));

// ── Marka (white-label) ──────────────────────────────────────────────────────
// PUBLIC — giris ekraninda da gorunmesi gerektigi icin auth'suz (SERBEST).
// Deger yoksa version.json'dan varsayilan; logo yoksa null (arayuz monogram gosterir).
function markaOku() {
  let ad = ayarGetir(db, "marka_ad", "");
  let tam = ayarGetir(db, "marka_tam", "");
  if (!ad || !tam) {
    try {
      const v = JSON.parse(readFileSync(join(PROJE_KOK, "version.json"), "utf8"));
      ad = ad || v.ad || "SITMS";
      tam = tam || v.tamAd || "IT Management Systems";
    } catch { ad = ad || "SITMS"; tam = tam || "IT Management Systems"; }
  }
  return { ad, tam, logo: ayarGetir(db, "marka_logo", "") || null };
}
app.get("/api/marka", sarmala((_req, res) => res.json(markaOku())));

const MARKA_LOGO_MAX = 2 * 1024 * 1024; // ~2MB (data URI olarak DB'de)
const MARKA_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"]);
app.post("/api/marka/logo", sarmala((req, res) => {
  if (!adminGerek(req, res)) return;
  const { veri, tur } = req.body || {};
  if (!veri || typeof veri !== "string") return res.status(400).json({ hata: "Görsel verisi (base64) gerekli" });
  if (!MARKA_MIME.has(String(tur))) return res.status(400).json({ hata: "Desteklenmeyen görsel türü (png/jpeg/webp/svg/gif)" });
  // base64 kaba boyut: her 4 karakter ~3 bayt
  if (veri.length * 0.75 > MARKA_LOGO_MAX) return res.status(413).json({ hata: "Logo çok büyük (en fazla ~2MB)" });
  ayarKur(db, "marka_logo", `data:${tur};base64,${veri}`);
  res.json({ ok: true });
}));
app.delete("/api/marka/logo", sarmala((req, res) => {
  if (!adminGerek(req, res)) return;
  ayarKur(db, "marka_logo", "");
  res.json({ ok: true });
}));

// ── Meta ────────────────────────────────────────────────────────────────────
app.get("/api/version", sarmala((_req, res) => {
  const v = JSON.parse(readFileSync(join(PROJE_KOK, "version.json"), "utf8"));
  res.json(v);
}));
// Guncelleme kontrolu: yerel version.json ile GitHub'daki karsilastirilir (yapim no).
// Sonuc guncelleme.bat calistirmadan "yeni surum var mi" gosterir. Cevrimdisi ise nazikce gecer.
const GUNCELLEME_URL = process.env.GUNCELLEME_URL
  || "https://raw.githubusercontent.com/bilalunsal/bt-bilgi-bankasi/main/version.json";
app.get("/api/guncelleme", sarmala(async (req, res) => {
  if (!adminGerek(req, res)) return;
  const yerel = JSON.parse(readFileSync(join(PROJE_KOK, "version.json"), "utf8"));
  try {
    const r = await fetch(GUNCELLEME_URL, { signal: AbortSignal.timeout(8000), headers: { "Cache-Control": "no-cache" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const uzak = await r.json();
    const guncellemeVar = Number(uzak.yapim || 0) > Number(yerel.yapim || 0);
    res.json({ yerel, uzak, guncellemeVar });
  } catch (e) {
    res.json({ yerel, uzak: null, guncellemeVar: false, hata: e.message });
  }
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

// Otomatik yedek: yalnizca bu (ana) surecte. Acilistan 15sn sonra + saatte bir "bugun alindi mi" kontrolu.
// intake.js yedek almaz (tek sorumlu surec). Kapali/klasorsuz ise sessizce atlar.
setTimeout(() => otomatikYedekDene(db, YEDEK_VARSAYILAN), 15000);
setInterval(() => otomatikYedekDene(db, YEDEK_VARSAYILAN), 60 * 60 * 1000);
