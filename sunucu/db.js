// db.js — SQLite (node:sqlite yerlesik) + FTS5 tam metin arama. Sifir native/harici bagimlilik.
// Strateji Masasi dersleri: (1) db/ ASLA ezilmez — kullanici verisi. (2) pkg/.exe icin META_URL.
import { DatabaseSync } from "node:sqlite";
import { randomBytes, createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TIPLER, ALANLAR } from "./tohum-alanlar.js";

// pkg/.exe'de import.meta.url bos kalabilir → META_URL yardimcisi (Strateji Masasi tuzagi #2).
const META_URL = (typeof __dirname !== "undefined") ? pathToFileURL(__dirname + "/").href : import.meta.url;
const BU_KLASOR = dirname(fileURLToPath(META_URL));
const PROJE_KOK = resolve(BU_KLASOR, "..");

// DB konumu: BILGI_DB ortam degiskeni > <proje>/db/bilgi.sqlite
export const DB_DIR = process.env.BILGI_DB
  ? dirname(resolve(process.env.BILGI_DB))
  : join(PROJE_KOK, "db");
const DB_YOL = process.env.BILGI_DB ? resolve(process.env.BILGI_DB) : join(DB_DIR, "bilgi.sqlite");

if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });

// Test icin bellek-ici veritabani acilabilsin diye fabrika. Uretimde varsayilan dosya.
export function veritabaniAc(yol = DB_YOL) {
  const db = new DatabaseSync(yol);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  semaKur(db);
  alanlariSenkronla(db);
  varsayilanKullanici(db);
  return db;
}

// ── SEMA ────────────────────────────────────────────────────────────────────
function semaKur(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kayitlar (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      tip          TEXT    NOT NULL,
      baslik       TEXT    NOT NULL,
      durum        TEXT,
      oncelik      TEXT,
      atanan       TEXT,               -- zimmet / sorumlu (kullanici sistemi gelene kadar serbest metin)
      konum        TEXT,
      veri         TEXT    NOT NULL DEFAULT '{}',  -- tipe ozel alanlar (JSON)
      olusturan    TEXT,
      olusturma    TEXT    NOT NULL,   -- ISO
      guncelleme   TEXT    NOT NULL,   -- ISO
      arsiv        INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS ix_kayit_tip   ON kayitlar(tip);
    CREATE INDEX IF NOT EXISTS ix_kayit_durum ON kayitlar(durum);

    -- Tipe ozel alan tanimlari (arayuz formu bunlardan cizilir)
    CREATE TABLE IF NOT EXISTS alan_tanim (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      tip        TEXT NOT NULL,
      kod        TEXT NOT NULL,
      etiket     TEXT NOT NULL,
      veri_tipi  TEXT NOT NULL,
      secenekler TEXT,            -- JSON dizi (secim/coklu_secim)
      iliski_tip TEXT,            -- veri_tipi=iliski ise hedef kayit tipi
      zorunlu    INTEGER NOT NULL DEFAULT 0,
      sira       INTEGER NOT NULL DEFAULT 100,
      UNIQUE(tip, kod)
    );

    -- Etiketler (labels)
    CREATE TABLE IF NOT EXISTS etiketler (
      id  INTEGER PRIMARY KEY AUTOINCREMENT,
      ad  TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS kayit_etiket (
      kayit_id  INTEGER NOT NULL REFERENCES kayitlar(id) ON DELETE CASCADE,
      etiket_id INTEGER NOT NULL REFERENCES etiketler(id) ON DELETE CASCADE,
      PRIMARY KEY (kayit_id, etiket_id)
    );

    -- Yorumlar (comments)
    CREATE TABLE IF NOT EXISTS yorumlar (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      kayit_id INTEGER NOT NULL REFERENCES kayitlar(id) ON DELETE CASCADE,
      yazar    TEXT,
      metin    TEXT NOT NULL,
      zaman    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_yorum_kayit ON yorumlar(kayit_id);

    -- Ekler (attachments)
    CREATE TABLE IF NOT EXISTS ekler (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      kayit_id  INTEGER NOT NULL REFERENCES kayitlar(id) ON DELETE CASCADE,
      dosya_ad  TEXT NOT NULL,
      yol       TEXT NOT NULL,
      boyut     INTEGER,
      tur       TEXT,
      yukleyen  TEXT,
      zaman     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_ek_kayit ON ekler(kayit_id);

    -- Kayitlar arasi iliskiler (issue links)
    CREATE TABLE IF NOT EXISTS iliskiler (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      kaynak_id INTEGER NOT NULL REFERENCES kayitlar(id) ON DELETE CASCADE,
      hedef_id  INTEGER NOT NULL REFERENCES kayitlar(id) ON DELETE CASCADE,
      tur       TEXT NOT NULL,
      UNIQUE(kaynak_id, hedef_id, tur)
    );

    -- Degisiklik gecmisi (audit log)
    CREATE TABLE IF NOT EXISTS gecmis (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      kayit_id  INTEGER NOT NULL REFERENCES kayitlar(id) ON DELETE CASCADE,
      kullanici TEXT,
      eylem     TEXT NOT NULL,   -- olustur | guncelle | yorum | iliski | sil
      alan      TEXT,
      eski      TEXT,
      yeni      TEXT,
      zaman     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_gecmis_kayit ON gecmis(kayit_id);

    -- ZIMMET DEFTERI (change management). Her satir bir zimmet donemi: hangi varlik, hangi
    -- personel, ne zaman verildi (baslangic) / iade edildi (bitis=NULL ise AKTIF). Yeniden
    -- zimmetlemede eski satir kapatilir, yeni satir acilir → tam tarihce korunur.
    CREATE TABLE IF NOT EXISTS zimmetler (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      kayit_id    INTEGER NOT NULL REFERENCES kayitlar(id) ON DELETE CASCADE,  -- varlik (cihaz/lisans)
      personel_id INTEGER NOT NULL REFERENCES kayitlar(id) ON DELETE CASCADE,  -- personel karti
      baslangic   TEXT NOT NULL,
      bitis       TEXT,             -- NULL = aktif zimmet
      atayan      TEXT,
      not_        TEXT,
      olusturma   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_zimmet_kayit    ON zimmetler(kayit_id);
    CREATE INDEX IF NOT EXISTS ix_zimmet_personel ON zimmetler(personel_id);

    -- PERSONEL KULLANICILARI (giris). Parola scrypt ile hash'li (salt:hash). Duz parola YOK.
    CREATE TABLE IF NOT EXISTS kullanicilar (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      kadi          TEXT NOT NULL UNIQUE,
      ad            TEXT,
      parola        TEXT NOT NULL,            -- "salt:hash"
      rol           TEXT NOT NULL DEFAULT 'personel',  -- admin | personel
      aktif         INTEGER NOT NULL DEFAULT 1,
      sifre_yenile  INTEGER NOT NULL DEFAULT 0,  -- 1 ise ilk giriste parola degistirmesi istenir
      olusturma     TEXT NOT NULL,
      son_giris     TEXT
    );

    -- OTURUMLAR (cerez token'i HASH'li). Suresi gecen otomatik gecersiz.
    CREATE TABLE IF NOT EXISTS oturumlar (
      token_hash  TEXT PRIMARY KEY,
      kullanici_id INTEGER NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
      bitis       TEXT NOT NULL,
      olusturma   TEXT NOT NULL
    );

    -- MUSTERILER — dis intake (talep kapisi) icin. Token HASH'li saklanir (asla duz metin).
    CREATE TABLE IF NOT EXISTS musteriler (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ad         TEXT NOT NULL,
      eposta     TEXT,
      token_hash TEXT NOT NULL UNIQUE,
      aktif      INTEGER NOT NULL DEFAULT 1,
      not_       TEXT,
      olusturma  TEXT NOT NULL
    );

    -- TAM METIN ARAMA (FTS5). Turkce: unicode61 + remove_diacritics 2 (kucuk harf + aksan-duyarsiz).
    -- rowid = kayitlar.id. Icerik elle bakimi yapilir (ftsYaz).
    CREATE VIRTUAL TABLE IF NOT EXISTS kayit_fts USING fts5(
      baslik, icerik,
      tokenize = "unicode61 remove_diacritics 2"
    );
  `);
}

// ── ALAN MIGRASYONU (tohum + guncelleme) ────────────────────────────────────
// tohum-alanlar.js KAYNAK KABUL edilir: her acilista katalog alanlari upsert edilir.
// Boylece dolu DB'ye yeni/degistirilmis alanlar veriyi bozmadan gelir. Katalogda olmayan
// (ileride UI'dan elle eklenmis) satirlara DOKUNULMAZ — silinmez.
export function alanlariSenkronla(db) {
  const upsert = db.prepare(
    `INSERT INTO alan_tanim (tip, kod, etiket, veri_tipi, secenekler, iliski_tip, zorunlu, sira)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tip, kod) DO UPDATE SET
       etiket     = excluded.etiket,
       veri_tipi  = excluded.veri_tipi,
       secenekler = excluded.secenekler,
       iliski_tip = excluded.iliski_tip,
       zorunlu    = excluded.zorunlu,
       sira       = excluded.sira`
  );
  for (const a of ALANLAR) {
    upsert.run(
      a.tip, a.kod, a.etiket, a.veri_tipi,
      a.secenekler ? JSON.stringify(a.secenekler) : null,
      a.iliski_tip ?? null,
      a.zorunlu ? 1 : 0,
      a.sira ?? 100
    );
  }
}

// ── FTS BAKIMI ──────────────────────────────────────────────────────────────
// Bir kaydin aranabilir metnini toplar: baslik + tipe ozel alan degerleri + etiketler + yorumlar.
function ftsIcerikTopla(db, kayit) {
  const parcalar = [];
  let veri = {};
  try { veri = JSON.parse(kayit.veri || "{}"); } catch { /* yoksay */ }
  for (const [, v] of Object.entries(veri)) {
    if (v == null) continue;
    if (Array.isArray(v)) parcalar.push(v.join(" "));
    else parcalar.push(String(v));
  }
  for (const k of ["durum", "oncelik", "atanan", "konum", "olusturan"]) {
    if (kayit[k]) parcalar.push(String(kayit[k]));
  }
  const etiketler = db.prepare(
    `SELECT e.ad FROM etiketler e JOIN kayit_etiket ke ON ke.etiket_id = e.id WHERE ke.kayit_id = ?`
  ).all(kayit.id).map(r => r.ad);
  if (etiketler.length) parcalar.push(etiketler.join(" "));
  const yorumlar = db.prepare(`SELECT metin FROM yorumlar WHERE kayit_id = ?`).all(kayit.id).map(r => r.metin);
  if (yorumlar.length) parcalar.push(yorumlar.join(" "));
  return parcalar.join(" \n ");
}

export function ftsYaz(db, kayitId) {
  const kayit = db.prepare("SELECT * FROM kayitlar WHERE id = ?").get(kayitId);
  db.prepare("DELETE FROM kayit_fts WHERE rowid = ?").run(kayitId);
  if (!kayit) return;
  const icerik = ftsIcerikTopla(db, kayit);
  db.prepare("INSERT INTO kayit_fts (rowid, baslik, icerik) VALUES (?, ?, ?)").run(kayitId, kayit.baslik, icerik);
}

// Kullanici sorgusunu guvenli FTS5 MATCH ifadesine cevirir (her kelime prefix* + AND).
// Girdideki ozel karakterler ("()* vb.) temizlenir → sozdizim hatasi olmaz.
export function aramaIfadesi(q) {
  if (!q) return null;
  const kelimeler = String(q)
    .split(/\s+/)
    .map(k => k.replace(/["'()*:^]/g, "").trim())
    .filter(Boolean);
  if (!kelimeler.length) return null;
  // Her kelimeyi tirnakla (aksan/ozel karakter guvenli) + prefix eslesme icin *.
  return kelimeler.map(k => `"${k}"*`).join(" ");
}

// ── KAYIT ISLEMLERI ─────────────────────────────────────────────────────────
const simdi = () => new Date().toISOString();

function etiketleriBagla(db, kayitId, etiketler) {
  db.prepare("DELETE FROM kayit_etiket WHERE kayit_id = ?").run(kayitId);
  if (!Array.isArray(etiketler)) return;
  const bul = db.prepare("SELECT id FROM etiketler WHERE ad = ?");
  const yeni = db.prepare("INSERT INTO etiketler (ad) VALUES (?)");
  const bag = db.prepare("INSERT OR IGNORE INTO kayit_etiket (kayit_id, etiket_id) VALUES (?, ?)");
  for (const ad0 of etiketler) {
    const ad = String(ad0).trim();
    if (!ad) continue;
    const mevcut = bul.get(ad);
    const eid = mevcut ? mevcut.id : Number(yeni.run(ad).lastInsertRowid);
    bag.run(kayitId, eid);
  }
}

export function kayitEkle(db, girdi) {
  const t = simdi();
  const r = db.prepare(
    `INSERT INTO kayitlar (tip, baslik, durum, oncelik, atanan, konum, veri, olusturan, olusturma, guncelleme)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    girdi.tip,
    girdi.baslik,
    girdi.durum ?? null,
    girdi.oncelik ?? null,
    girdi.atanan ?? null,
    girdi.konum ?? null,
    JSON.stringify(girdi.veri ?? {}),
    girdi.olusturan ?? null,
    t, t
  );
  const id = Number(r.lastInsertRowid);
  if (girdi.etiketler) etiketleriBagla(db, id, girdi.etiketler);
  db.prepare(
    `INSERT INTO gecmis (kayit_id, kullanici, eylem, zaman) VALUES (?, ?, 'olustur', ?)`
  ).run(id, girdi.olusturan ?? null, t);
  ftsYaz(db, id);
  return id;
}

export function kayitGuncelle(db, id, degisiklik) {
  const mevcut = db.prepare("SELECT * FROM kayitlar WHERE id = ?").get(id);
  if (!mevcut) return false;
  const alanlar = ["tip", "baslik", "durum", "oncelik", "atanan", "konum", "olusturan", "arsiv"];
  const set = [], deg = [];
  for (const a of alanlar) {
    if (a in degisiklik) { set.push(`${a} = ?`); deg.push(degisiklik[a]); }
  }
  if ("veri" in degisiklik) { set.push("veri = ?"); deg.push(JSON.stringify(degisiklik.veri ?? {})); }
  set.push("guncelleme = ?"); deg.push(simdi());
  db.prepare(`UPDATE kayitlar SET ${set.join(", ")} WHERE id = ?`).run(...deg, id);
  if ("etiketler" in degisiklik) etiketleriBagla(db, id, degisiklik.etiketler);
  ftsYaz(db, id);
  return true;
}

export function kayitGetir(db, id) {
  const k = db.prepare("SELECT * FROM kayitlar WHERE id = ?").get(id);
  if (!k) return null;
  return zenginlestir(db, k);
}

function zenginlestir(db, k) {
  let veri = {};
  try { veri = JSON.parse(k.veri || "{}"); } catch { /* yoksay */ }
  const etiketler = db.prepare(
    `SELECT e.ad FROM etiketler e JOIN kayit_etiket ke ON ke.etiket_id = e.id WHERE ke.kayit_id = ? ORDER BY e.ad`
  ).all(k.id).map(r => r.ad);
  return { ...k, veri, etiketler };
}

export function kayitSil(db, id) {
  db.prepare("DELETE FROM kayit_fts WHERE rowid = ?").run(id);
  const r = db.prepare("DELETE FROM kayitlar WHERE id = ?").run(id);
  return Number(r.changes) > 0;
}

// Tam metin arama + tip/durum suzgeci. Sorgu bossa son kayitlar doner.
export function ara(db, { q = "", tip = null, durum = null, limit = 50, offset = 0 } = {}) {
  const ifade = aramaIfadesi(q);
  const kosul = [], par = [];
  if (tip)   { kosul.push("k.tip = ?");   par.push(tip); }
  if (durum) { kosul.push("k.durum = ?"); par.push(durum); }

  if (ifade) {
    const nerede = kosul.length ? "AND " + kosul.join(" AND ") : "";
    const sql = `
      SELECT k.*, bm25(kayit_fts) AS skor
      FROM kayit_fts f
      JOIN kayitlar k ON k.id = f.rowid
      WHERE kayit_fts MATCH ? ${nerede}
      ORDER BY skor
      LIMIT ? OFFSET ?`;
    const satirlar = db.prepare(sql).all(ifade, ...par, limit, offset);
    return satirlar.map(k => zenginlestir(db, k));
  }
  // Arama yok → son guncellenenler
  const nerede = kosul.length ? "WHERE " + kosul.join(" AND ") : "";
  const sql = `SELECT * FROM kayitlar k ${nerede} ORDER BY guncelleme DESC LIMIT ? OFFSET ?`;
  const satirlar = db.prepare(sql).all(...par, limit, offset);
  return satirlar.map(k => zenginlestir(db, k));
}

// ── YORUMLAR ────────────────────────────────────────────────────────────────
export function yorumEkle(db, kayitId, { yazar = null, metin }) {
  const t = simdi();
  const r = db.prepare(
    "INSERT INTO yorumlar (kayit_id, yazar, metin, zaman) VALUES (?, ?, ?, ?)"
  ).run(kayitId, yazar, metin, t);
  db.prepare("INSERT INTO gecmis (kayit_id, kullanici, eylem, zaman) VALUES (?, ?, 'yorum', ?)")
    .run(kayitId, yazar, t);
  ftsYaz(db, kayitId); // yorum metni de aranabilir olsun
  return Number(r.lastInsertRowid);
}
export function yorumlar(db, kayitId) {
  return db.prepare("SELECT * FROM yorumlar WHERE kayit_id = ? ORDER BY zaman").all(kayitId);
}

// ── ILISKILER (issue links) ─────────────────────────────────────────────────
export function iliskiEkle(db, kaynakId, hedefId, tur) {
  if (Number(kaynakId) === Number(hedefId)) return false;
  db.prepare("INSERT OR IGNORE INTO iliskiler (kaynak_id, hedef_id, tur) VALUES (?, ?, ?)")
    .run(kaynakId, hedefId, tur);
  db.prepare("INSERT INTO gecmis (kayit_id, eylem, alan, yeni, zaman) VALUES (?, 'iliski', ?, ?, ?)")
    .run(kaynakId, tur, String(hedefId), simdi());
  return true;
}
export function iliskiSil(db, id) {
  return Number(db.prepare("DELETE FROM iliskiler WHERE id = ?").run(id).changes) > 0;
}
// Bir kaydin tum iliskileri (her iki yon), hedef basligiyla birlikte.
export function iliskilerGetir(db, kayitId) {
  const ileri = db.prepare(`
    SELECT i.id, i.tur, 'ileri' yon, k.id hedef_id, k.baslik, k.tip
    FROM iliskiler i JOIN kayitlar k ON k.id = i.hedef_id WHERE i.kaynak_id = ?`).all(kayitId);
  const geri = db.prepare(`
    SELECT i.id, i.tur, 'geri' yon, k.id hedef_id, k.baslik, k.tip
    FROM iliskiler i JOIN kayitlar k ON k.id = i.kaynak_id WHERE i.hedef_id = ?`).all(kayitId);
  return [...ileri, ...geri];
}

// ── EKLER (attachments) — dosya diskte, meta burada ──────────────────────────
export function ekEkle(db, kayitId, { dosya_ad, yol, boyut, tur, yukleyen = null }) {
  const t = simdi();
  const r = db.prepare(
    "INSERT INTO ekler (kayit_id, dosya_ad, yol, boyut, tur, yukleyen, zaman) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(kayitId, dosya_ad, yol, boyut ?? null, tur ?? null, yukleyen, t);
  db.prepare("INSERT INTO gecmis (kayit_id, kullanici, eylem, alan, yeni, zaman) VALUES (?, ?, 'ek', 'ekle', ?, ?)")
    .run(kayitId, yukleyen, dosya_ad, t);
  ftsYaz(db, kayitId); // dosya adi da aranabilir olsun
  return Number(r.lastInsertRowid);
}
export function ekler(db, kayitId) {
  return db.prepare("SELECT id, kayit_id, dosya_ad, boyut, tur, yukleyen, zaman FROM ekler WHERE kayit_id = ? ORDER BY zaman").all(kayitId);
}
export function ekGetir(db, id) {
  return db.prepare("SELECT * FROM ekler WHERE id = ?").get(id);
}
export function ekSil(db, id) {
  const ek = ekGetir(db, id);
  db.prepare("DELETE FROM ekler WHERE id = ?").run(id);
  if (ek) ftsYaz(db, ek.kayit_id);
  return ek; // cagiran diskteki dosyayi silsin
}

// ── UYARILAR (bitis tarihleri) ───────────────────────────────────────────────
// Tipe gore tarih alani: donanim.garanti_bitis, lisans.bitis, sozlesme.bitis.
const UYARI_ALANLARI = [
  { tip: "donanim", alan: "garanti_bitis", etiket: "Garanti" },
  { tip: "lisans",  alan: "bitis",         etiket: "Lisans" },
  { tip: "sozlesme", alan: "bitis",        etiket: "Sözleşme" },
];
export function uyarilar(db, { gun = 45, bugun = null } = {}) {
  const bugunISO = (bugun || new Date().toISOString().slice(0, 10));
  const cikti = [];
  for (const u of UYARI_ALANLARI) {
    const satirlar = db.prepare(
      `SELECT id, tip, baslik, durum, atanan, json_extract(veri, '$.' || ?) AS tarih
       FROM kayitlar
       WHERE tip = ? AND arsiv = 0 AND tarih IS NOT NULL AND tarih != ''`
    ).all(u.alan, u.tip);
    for (const s of satirlar) {
      const kalan = gunFarki(bugunISO, s.tarih);
      if (kalan == null) continue;
      cikti.push({ ...s, kategori: u.etiket, kalanGun: kalan,
        durumSinif: kalan < 0 ? "gecti" : (kalan <= gun ? "yakin" : "uzak") });
    }
  }
  const ilgili = cikti.filter(c => c.durumSinif !== "uzak").sort((a, b) => a.kalanGun - b.kalanGun);
  return {
    bugun: bugunISO, esik: gun,
    gecmis: ilgili.filter(c => c.durumSinif === "gecti"),
    yakin: ilgili.filter(c => c.durumSinif === "yakin"),
  };
}
function gunFarki(bugunISO, hedefISO) {
  const a = Date.parse(bugunISO + "T00:00:00Z");
  const b = Date.parse(String(hedefISO).slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

// ── ZIMMET (change management) ───────────────────────────────────────────────
// Bir varligin AKTIF zimmeti (personel adiyla birlikte) veya null.
export function zimmetAktif(db, kayitId) {
  return db.prepare(`
    SELECT z.*, p.baslik AS personel_ad
    FROM zimmetler z JOIN kayitlar p ON p.id = z.personel_id
    WHERE z.kayit_id = ? AND z.bitis IS NULL
    ORDER BY z.id DESC LIMIT 1`).get(kayitId) || null;
}
// Varligi bir personele zimmetle. Aktif zimmet varsa once kapatir (change management).
export function zimmetAta(db, { kayitId, personelId, atayan = null, not_ = null }) {
  const varlik = db.prepare("SELECT id, baslik FROM kayitlar WHERE id = ?").get(kayitId);
  const personel = db.prepare("SELECT id, baslik, tip FROM kayitlar WHERE id = ?").get(personelId);
  if (!varlik || !personel) throw new Error("Varlik veya personel bulunamadi");
  if (personel.tip !== "personel") throw new Error("Hedef bir personel karti olmali");
  const t = simdi();
  db.prepare("UPDATE zimmetler SET bitis = ? WHERE kayit_id = ? AND bitis IS NULL").run(t, kayitId);
  db.prepare("INSERT INTO zimmetler (kayit_id, personel_id, baslangic, atayan, not_, olusturma) VALUES (?, ?, ?, ?, ?, ?)")
    .run(kayitId, personelId, t, atayan, not_, t);
  // liste/aramada gorunsun diye atanan alanini personel adina esitle
  db.prepare("UPDATE kayitlar SET atanan = ?, guncelleme = ? WHERE id = ?").run(personel.baslik, t, kayitId);
  db.prepare("INSERT INTO gecmis (kayit_id, kullanici, eylem, alan, yeni, zaman) VALUES (?, ?, 'zimmet', 'personel', ?, ?)")
    .run(kayitId, atayan, personel.baslik, t);
  ftsYaz(db, kayitId);
  return zimmetAktif(db, kayitId);
}
// Aktif zimmeti kapat (iade). Varlik artik zimmetsiz.
export function zimmetIade(db, { kayitId, atayan = null, not_ = null }) {
  const aktif = zimmetAktif(db, kayitId);
  if (!aktif) return false;
  const t = simdi();
  db.prepare("UPDATE zimmetler SET bitis = ?, not_ = COALESCE(?, not_) WHERE id = ?").run(t, not_, aktif.id);
  db.prepare("UPDATE kayitlar SET atanan = NULL, guncelleme = ? WHERE id = ?").run(t, kayitId);
  db.prepare("INSERT INTO gecmis (kayit_id, kullanici, eylem, alan, eski, zaman) VALUES (?, ?, 'iade', 'personel', ?, ?)")
    .run(kayitId, atayan, aktif.personel_ad, t);
  ftsYaz(db, kayitId);
  return true;
}
// Bir varligin tum zimmet gecmisi (personel adiyla).
export function zimmetGecmisi(db, kayitId) {
  return db.prepare(`
    SELECT z.*, p.baslik AS personel_ad, p.id AS personel_id
    FROM zimmetler z JOIN kayitlar p ON p.id = z.personel_id
    WHERE z.kayit_id = ? ORDER BY z.baslangic DESC, z.id DESC`).all(kayitId);
}
// TERS SORGU: bir personelin zimmetli (aktif + gecmis) tum varliklari.
export function personelZimmetleri(db, personelId) {
  const satirlar = db.prepare(`
    SELECT z.id, z.baslangic, z.bitis, z.atayan,
           v.id AS varlik_id, v.baslik AS varlik_ad, v.tip AS varlik_tip, v.durum AS varlik_durum
    FROM zimmetler z JOIN kayitlar v ON v.id = z.kayit_id
    WHERE z.personel_id = ? ORDER BY z.bitis IS NULL DESC, z.baslangic DESC`).all(personelId);
  return {
    aktif: satirlar.filter(s => s.bitis == null),
    gecmis: satirlar.filter(s => s.bitis != null),
  };
}

// ── GECMIS (audit) ──────────────────────────────────────────────────────────
export function gecmisGetir(db, kayitId) {
  return db.prepare("SELECT * FROM gecmis WHERE kayit_id = ? ORDER BY zaman DESC, id DESC").all(kayitId);
}

// ── ISTATISTIK (pano) ───────────────────────────────────────────────────────
export function istatistik(db) {
  const tipBazli = db.prepare(
    "SELECT tip, COUNT(*) n FROM kayitlar WHERE arsiv = 0 GROUP BY tip"
  ).all();
  const durumBazli = db.prepare(
    "SELECT tip, durum, COUNT(*) n FROM kayitlar WHERE arsiv = 0 GROUP BY tip, durum"
  ).all();
  const toplam = Number(db.prepare("SELECT COUNT(*) n FROM kayitlar WHERE arsiv = 0").get().n);
  return { toplam, tipBazli, durumBazli };
}

// Alan tanimlarini (arayuz formu) doner. tip verilirse suzer.
export function alanTanimlari(db, tip = null) {
  const sql = tip
    ? "SELECT * FROM alan_tanim WHERE tip = ? ORDER BY sira, id"
    : "SELECT * FROM alan_tanim ORDER BY tip, sira, id";
  const satirlar = tip ? db.prepare(sql).all(tip) : db.prepare(sql).all();
  return satirlar.map(a => ({ ...a, secenekler: a.secenekler ? JSON.parse(a.secenekler) : null, zorunlu: !!a.zorunlu }));
}

// ── KULLANICILAR / GIRIS (scrypt + oturum) ───────────────────────────────────
function parolaKur(parola) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(parola), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
export function parolaDogru(parola, saklanan) {
  if (!saklanan || !saklanan.includes(":")) return false;
  const [salt, hash] = saklanan.split(":");
  const aday = scryptSync(String(parola), salt, 64);
  const gercek = Buffer.from(hash, "hex");
  return aday.length === gercek.length && timingSafeEqual(aday, gercek);
}

// Ilk acilista hic kullanici yoksa admin/admin olustur (ilk giriste sifre degistirmesi istenir).
export function varsayilanKullanici(db) {
  const say = Number(db.prepare("SELECT COUNT(*) n FROM kullanicilar").get().n);
  if (say > 0) return;
  db.prepare(
    "INSERT INTO kullanicilar (kadi, ad, parola, rol, aktif, sifre_yenile, olusturma) VALUES (?, ?, ?, 'admin', 1, 1, ?)"
  ).run("admin", "Yönetici", parolaKur("admin"), simdi());
}

export function kullaniciBulKadi(db, kadi) {
  return db.prepare("SELECT * FROM kullanicilar WHERE kadi = ?").get(String(kadi || "").trim().toLowerCase());
}
export function kullaniciBul(db, id) {
  return db.prepare("SELECT id, kadi, ad, rol, aktif, sifre_yenile, olusturma, son_giris FROM kullanicilar WHERE id = ?").get(id);
}
export function kullaniciListe(db) {
  return db.prepare("SELECT id, kadi, ad, rol, aktif, sifre_yenile, olusturma, son_giris FROM kullanicilar ORDER BY kadi").all();
}
export function kullaniciEkle(db, { kadi, ad = null, parola, rol = "personel" }) {
  const k = String(kadi || "").trim().toLowerCase();
  if (!k || !parola) throw new Error("kadi ve parola zorunlu");
  if (kullaniciBulKadi(db, k)) throw new Error("Bu kullanıcı adı zaten var");
  const r = db.prepare(
    "INSERT INTO kullanicilar (kadi, ad, parola, rol, aktif, sifre_yenile, olusturma) VALUES (?, ?, ?, ?, 1, 1, ?)"
  ).run(k, ad, parolaKur(parola), rol === "admin" ? "admin" : "personel", simdi());
  return Number(r.lastInsertRowid);
}
export function parolaDegistir(db, id, yeniParola, { yenileBayragi = 0 } = {}) {
  return Number(db.prepare("UPDATE kullanicilar SET parola = ?, sifre_yenile = ? WHERE id = ?")
    .run(parolaKur(yeniParola), yenileBayragi ? 1 : 0, id).changes) > 0;
}
export function kullaniciDurum(db, id, aktif) {
  return Number(db.prepare("UPDATE kullanicilar SET aktif = ? WHERE id = ?").run(aktif ? 1 : 0, id).changes) > 0;
}
export function kullaniciRol(db, id, rol) {
  return Number(db.prepare("UPDATE kullanicilar SET rol = ? WHERE id = ?").run(rol === "admin" ? "admin" : "personel", id).changes) > 0;
}

// Oturum
const OTURUM_GUN = 7;
export function oturumAc(db, kullaniciId) {
  const token = randomBytes(32).toString("base64url");
  const bitis = new Date(Date.now() + OTURUM_GUN * 86400000).toISOString();
  db.prepare("INSERT INTO oturumlar (token_hash, kullanici_id, bitis, olusturma) VALUES (?, ?, ?, ?)")
    .run(createHash("sha256").update(token).digest("hex"), kullaniciId, bitis, simdi());
  db.prepare("UPDATE kullanicilar SET son_giris = ? WHERE id = ?").run(simdi(), kullaniciId);
  return token;
}
export function oturumKullanici(db, token) {
  if (!token) return null;
  const h = createHash("sha256").update(String(token)).digest("hex");
  const o = db.prepare("SELECT kullanici_id, bitis FROM oturumlar WHERE token_hash = ?").get(h);
  if (!o) return null;
  if (Date.parse(o.bitis) < Date.now()) { db.prepare("DELETE FROM oturumlar WHERE token_hash = ?").run(h); return null; }
  const k = kullaniciBul(db, o.kullanici_id);
  return (k && k.aktif) ? k : null;
}
export function oturumKapat(db, token) {
  if (!token) return;
  db.prepare("DELETE FROM oturumlar WHERE token_hash = ?").run(createHash("sha256").update(String(token)).digest("hex"));
}
// Giris denemesi → basarili ise {kullanici, token}, degilse null.
export function girisDene(db, kadi, parola) {
  const k = kullaniciBulKadi(db, kadi);
  if (!k || !k.aktif) return null;
  if (!parolaDogru(parola, k.parola)) return null;
  const token = oturumAc(db, k.id);
  return { kullanici: kullaniciBul(db, k.id), token };
}

// ── MUSTERILER + TALEP KAPISI ────────────────────────────────────────────────
const tokenHash = (token) => createHash("sha256").update(String(token)).digest("hex");
const tokenUret = () => randomBytes(18).toString("base64url"); // ~24 karakter, yuksek entropi

export function musteriEkle(db, { ad, eposta = null, not_ = null }) {
  const token = tokenUret();
  const r = db.prepare(
    "INSERT INTO musteriler (ad, eposta, token_hash, aktif, not_, olusturma) VALUES (?, ?, ?, 1, ?, ?)"
  ).run(ad, eposta, tokenHash(token), not_, simdi());
  return { id: Number(r.lastInsertRowid), ad, token }; // token YALNIZCA burada doner (bir daha gorunmez)
}

// Intake icin: gecerli+aktif token → musteri satiri (token'siz). Yoksa null.
export function musteriBulToken(db, token) {
  if (!token) return null;
  const m = db.prepare("SELECT id, ad, eposta, aktif FROM musteriler WHERE token_hash = ?").get(tokenHash(token));
  return (m && m.aktif) ? m : null;
}

export function musteriListe(db) {
  return db.prepare("SELECT id, ad, eposta, aktif, not_, olusturma FROM musteriler ORDER BY ad").all();
}

export function musteriTokenYenile(db, id) {
  const token = tokenUret();
  const r = db.prepare("UPDATE musteriler SET token_hash = ? WHERE id = ?").run(tokenHash(token), id);
  return Number(r.changes) > 0 ? token : null;
}

export function musteriDurum(db, id, aktif) {
  return Number(db.prepare("UPDATE musteriler SET aktif = ? WHERE id = ?").run(aktif ? 1 : 0, id).changes) > 0;
}

// Talep olustur (intake veya personel). Musteri sahipligi veri icine yazilir.
export function talepEkle(db, { musteri_id = null, musteri = null, konu, iletisim = null, kategori = null, aciklama = null, ilgili_cihaz = null, kaynak = "intake" }) {
  const baslik = (konu && String(konu).trim()) || "(konusuz talep)";
  return kayitEkle(db, {
    tip: "talep",
    baslik: baslik.slice(0, 200),
    durum: "Yeni",
    olusturan: musteri ? `musteri:${musteri}` : kaynak,
    veri: {
      musteri_id, musteri, iletisim, kategori,
      aciklama: aciklama ? String(aciklama).slice(0, 5000) : null,
      ilgili_cihaz: ilgili_cihaz ? String(ilgili_cihaz).slice(0, 300) : null,
      kaynak,
    },
  });
}

export { TIPLER };
