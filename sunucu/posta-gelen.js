// posta-gelen.js — Gelen e-postalari TALEP'e cevirir (email-to-ticket). IMAP ile kutuyu yoklar.
// Ilke: ASLA firlatmaz (loglar). imapflow + mailparser DINAMIK import → paket yoksa no-op.
// GUVENLIK/dongu: kendi adresimizden veya otomatik-yanit maillerinden talep ACILMAZ.
import { ayarlariGetir, ayarGetir, ayarKur, kayitEkle } from "./db.js";
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

// Kutuyu yoklar, okunmamis mailleri talebe cevirir. { ok, sayi, atlanan } | { ok:false, hata }.
export async function postaKontrol(db) {
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
  let sayi = 0, atlanan = 0;
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
        const id = kayitEkle(db, {
          tip: "talep", baslik: konu, durum: "Yeni", olusturan: `eposta:${from}`,
          veri: { musteri: fromAd, iletisim: from, kategori: null, aciklama: govde, hedef_tur: "İç IT Ekibi", kaynak: "eposta" },
        });
        yeniTalepBildir(db, { id, baslik: konu, musteri: fromAd, iletisim: from, aciklama: govde }).catch(() => {});
        sayi++;
      }
    } finally { lock.release(); }
    await client.logout();
    ayarKur(db, "imap_son", new Date().toISOString());
    return { ok: true, sayi, atlanan };
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
    if (r.ok && r.sayi) console.log(`[posta-gelen] ${r.sayi} yeni talep (atlanan: ${r.atlanan || 0})`);
    return r;
  } catch (e) { console.error("[posta-gelen]", e.message); return { ok: false, hata: e.message }; }
}
