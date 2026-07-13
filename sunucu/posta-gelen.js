// posta-gelen.js — Gelen e-postalari TALEP'e cevirir (email-to-ticket). IMAP ile kutuyu yoklar.
// Ilke: ASLA firlatmaz (loglar). imapflow + mailparser DINAMIK import → paket yoksa no-op.
// GUVENLIK/dongu: kendi adresimizden veya otomatik-yanit maillerinden talep ACILMAZ.
import { ayarlariGetir, ayarGetir, ayarKur, kayitEkle, kayitGetir, kayitGuncelle, yorumEkle } from "./db.js";
import { yeniTalepBildir } from "./eposta.js";

const VARSAYILAN = {
  imap_aktif: "0",
  imap_host: "outlook.office365.com",
  imap_port: "993",
  imap_kullanici: "",   // orn: teknik@semak.com.tr
  imap_parola: "",
  imap_klasor: "INBOX",
};

export function imapAyarlari(db) {
  const hepsi = ayarlariGetir(db);
  const out = { ...VARSAYILAN };
  for (const k of Object.keys(VARSAYILAN)) if (hepsi[k] != null && hepsi[k] !== "") out[k] = hepsi[k];
  out.imap_son = ayarGetir(db, "imap_son", "") || null;
  out.imap_son_sonuc = ayarGetir(db, "imap_son_sonuc", "") || null;
  return out;
}

export function imapHazir(db) {
  const a = imapAyarlari(db);
  return !!(a.imap_host && a.imap_kullanici && a.imap_parola);
}

// Dongu/spam korumasi: kendi adresimiz veya otomatik yanit → talep olusturma.
function atlanmaliMi(a, from, basliklar) {
  const kendi = (a.imap_kullanici || "").toLowerCase();
  if (from && kendi && from.toLowerCase() === kendi) return "kendi adresimiz";
  const h = String(basliklar || "").toLowerCase();
  if (/auto-submitted:\s*auto/.test(h)) return "auto-submitted";
  if (/precedence:\s*(bulk|auto_reply|list|junk)/.test(h)) return "precedence";
  if (/x-autoreply|x-autorespond|x-auto-response-suppress/.test(h)) return "autoreply";
  return null;
}

// ── Yanit eslesme (dis kaynak / talebi acan e-postayla YANIT verir) ──────────
// Giden bildirim konusunda [#<id>] etiketi var. Yanit konusu bunu tasir → yeni talep ACMADAN
// ilgili talebe NOT ekle; gonderen o talebin dis-kaynagi/acani ise yetkili say; [cozuldu] → kapat.
const epostaMi = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || "").trim());
const norm = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("tr");
// Konuda/govdede kapatma isareti: [cozuldu] / [kapat] / [resolved] / [closed] (koseli parantez sart).
function kapatmaIstegi(konu, govde) {
  const m = norm(konu + " " + (govde || "")).match(/\[\s*(cozuldu|kapat|kapandi|resolved|closed)\s*\]/);
  return !!m;
}
// Talebe atanmis dis kisinin ve acanin e-postalari (yetkili gonderenler).
function talepYetkiliEpostalar(db, k) {
  const out = [];
  const il = String(k.veri?.iletisim || "").trim();
  if (epostaMi(il)) out.push(il.toLowerCase());
  if (k.veri?.hedef_tur === "Dış Kaynak" && k.veri?.dis_kaynak) {
    const dk = kayitGetir(db, k.veri.dis_kaynak);
    const e = dk?.veri?.email;
    if (epostaMi(e)) out.push(String(e).toLowerCase());
  }
  return out;
}
// Konudaki [#<id>] → mevcut ACIK talebe yanit mi? Yetkili gonderen ise isle ve true don.
export function yanitIslendiMi(db, { konu, govde, from, fromAd }) {
  const m = String(konu || "").match(/\[#(\d+)\]/);
  if (!m) return false;
  const k = kayitGetir(db, Number(m[1]));
  if (!k || k.tip !== "talep") return false;
  const yetkili = talepYetkiliEpostalar(db, k);
  if (yetkili.length && !yetkili.includes(String(from || "").toLowerCase())) return false; // baskasi → dokunma (yeni talep akisina birak)
  const not = String(govde || "").trim().slice(0, 5000) || "(bos yanit)";
  yorumEkle(db, k.id, { yazar: `${fromAd || from} (e-posta)`, metin: not, gorunur: 0, yazar_tip: "personel" });
  if (kapatmaIstegi(konu, govde)) {
    kayitGuncelle(db, k.id, { durum: "Cozuldu" });
  }
  return true;
}

// Son kontrol sonucunu kisa metne cevir (Ayarlar'da gosterilir → teshis kolaylasir).
function imapSonucOzet(r) {
  if (!r) return "";
  if (r.atlandi) return r.neden === "kapali" ? "IMAP kapalı" : r.neden === "yapilandirilmadi" ? "Yapılandırılmadı (host/kullanıcı/parola eksik)" : `Atlandı: ${r.neden}`;
  if (!r.ok) return `Hata: ${r.hata}`;
  return `${r.sayi} yeni talep · ${r.yanit || 0} yanıt · ${r.atlanan || 0} atlandı`;
}
// Kutuyu yoklar, okunmamis mailleri talebe cevirir; HER kontrolde son zaman+sonuc kaydedilir.
export async function postaKontrol(db) {
  const r = await _postaKontrol(db);
  try { ayarKur(db, "imap_son", new Date().toISOString()); ayarKur(db, "imap_son_sonuc", imapSonucOzet(r)); } catch { /* yoksay */ }
  return r;
}
async function _postaKontrol(db) {
  const a = imapAyarlari(db);
  if (a.imap_aktif !== "1") return { atlandi: true, neden: "kapali" };
  if (!a.imap_host || !a.imap_kullanici || !a.imap_parola) return { atlandi: true, neden: "yapilandirilmadi" };
  let ImapFlow, simpleParser;
  try { ({ ImapFlow } = await import("imapflow")); } catch { return { ok: false, hata: "imapflow kurulu degil (npm install)" }; }
  try { ({ simpleParser } = await import("mailparser")); } catch { return { ok: false, hata: "mailparser kurulu degil" }; }

  const port = Number(a.imap_port) || 993;
  const client = new ImapFlow({
    host: a.imap_host, port, secure: port === 993,
    auth: { user: a.imap_kullanici, pass: a.imap_parola },
    logger: false,
  });
  let sayi = 0, atlanan = 0, yanit = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock(a.imap_klasor || "INBOX");
    try {
      const uidler = await client.search({ seen: false }, { uid: true }) || [];
      for (const uid of uidler) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        let parsed;
        try { parsed = await simpleParser(msg.source); } catch { parsed = null; }
        // Islendi say → okundu isaretle (atlansa bile tekrar islenmesin)
        try { await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }); } catch { /* yoksay */ }
        if (!parsed) { atlanan++; continue; }
        const from = parsed.from?.value?.[0]?.address || "";
        const fromAd = parsed.from?.value?.[0]?.name || from || "(bilinmeyen)";
        const basliklar = (parsed.headerLines || []).map((h) => h.line).join("\n");
        if (atlanmaliMi(a, from, basliklar)) { atlanan++; continue; }
        const konu = (parsed.subject || "(konusuz e-posta)").slice(0, 200);
        const govde = (parsed.text || String(parsed.html || "").replace(/<[^>]+>/g, " ") || "").trim().slice(0, 5000);
        // Once: mevcut talebe YANIT mi? (konuda [#id] + yetkili gonderen) → not ekle, yeni talep ACMA.
        if (yanitIslendiMi(db, { konu, govde, from, fromAd })) { yanit++; continue; }
        const id = kayitEkle(db, {
          tip: "talep", baslik: konu, durum: "Yeni", olusturan: `eposta:${from}`,
          veri: { musteri: fromAd, iletisim: from, kategori: null, aciklama: govde, hedef_tur: "İç IT Ekibi", kaynak: "eposta" },
        });
        yeniTalepBildir(db, { id, baslik: konu, musteri: fromAd, iletisim: from, aciklama: govde }).catch(() => {});
        sayi++;
      }
    } finally { lock.release(); }
    await client.logout();
    return { ok: true, sayi, atlanan, yanit };
  } catch (e) {
    try { await client.close(); } catch { /* yoksay */ }
    console.error("[posta-gelen] hata:", e.message);
    return { ok: false, hata: e.message };
  }
}

// Zamanlayici sarmalayici — asla firlatmaz.
export async function postaKontrolDene(db) {
  try {
    const r = await postaKontrol(db);
    if (r.ok && (r.sayi || r.yanit)) console.log(`[posta-gelen] ${r.sayi} yeni talep, ${r.yanit || 0} yanit (atlanan: ${r.atlanan || 0})`);
    return r;
  } catch (e) { console.error("[posta-gelen]", e.message); return { ok: false, hata: e.message }; }
}
