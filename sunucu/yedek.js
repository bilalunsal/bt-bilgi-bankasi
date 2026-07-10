// yedek.js — SQLite sicak yedek. VACUUM INTO ile TUTARLI kopya (kilitlemeden, WAL guvenli).
// Hedef ikinci disk / ag paylasimi olabilir (ornek: D:\SITMS-yedek veya \\NAS\yedek).
// Ilke: yedek HATASI sunucuyu kirmaz — cagiran try/catch ile sarar; otomatik zamanlayici yutar.
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { ayarGetir, ayarKur } from "./db.js";

const iki = (n) => String(n).padStart(2, "0");
function damga(d = new Date()) {
  return `${d.getFullYear()}${iki(d.getMonth() + 1)}${iki(d.getDate())}-${iki(d.getHours())}${iki(d.getMinutes())}${iki(d.getSeconds())}`;
}
const YEDEK_ADI = /^yedek-\d{8}-\d{6}\.sqlite$/;

// Ayarlar + varsayilanlar. klasor bos ise fallbackDir (proje/_yedekler) kullanilir.
export function yedekConfig(db, fallbackDir) {
  const aktif = ayarGetir(db, "yedek_aktif", "0") === "1";
  const klasor = (ayarGetir(db, "yedek_klasor", "") || "").trim() || fallbackDir;
  const tut = Math.max(1, Number(ayarGetir(db, "yedek_tut", "14")) || 14);
  return { aktif, klasor, tut, son: ayarGetir(db, "yedek_son", "") || null, varsayilanKlasor: fallbackDir };
}

// Yedek al. Basarida { ad, yol, boyut }. Hata firlatir (cagiran yakalar).
export function yedekAl(db, klasor, tut = 14) {
  if (!klasor) throw new Error("Yedek klasörü tanımlı değil");
  if (!existsSync(klasor)) mkdirSync(klasor, { recursive: true }); // ag paylasimi erisilemezse burada patlar → yakalanir
  const ad = `yedek-${damga()}.sqlite`;
  const yol = join(klasor, ad);
  // VACUUM INTO transaction ICINDE calismaz; db.exec dogrudan calistirir. Tek tirnak kacisi.
  db.exec(`VACUUM INTO '${yol.replace(/'/g, "''")}'`);
  const boyut = statSync(yol).size;
  ayarKur(db, "yedek_son", new Date().toISOString());
  budama(klasor, tut);
  return { ad, yol, boyut };
}

// Eski yedekleri buda: en yeni `tut` adet kalir, gerisi silinir.
function budama(klasor, tut) {
  const hepsi = yedekListe(klasor);
  for (const f of hepsi.slice(tut)) { try { unlinkSync(join(klasor, f.ad)); } catch { /* yoksay */ } }
}

// Klasordeki yedekler, en yeniden eskiye. [{ ad, boyut, tarih }]
export function yedekListe(klasor) {
  if (!klasor || !existsSync(klasor)) return [];
  try {
    return readdirSync(klasor)
      .filter((a) => YEDEK_ADI.test(a))
      .map((a) => { const s = statSync(join(klasor, a)); return { ad: a, boyut: s.size, tarih: s.mtime.toISOString() }; })
      .sort((x, y) => y.ad.localeCompare(x.ad));
  } catch { return []; }
}

// Otomatik zamanlayici: gunde bir yedek. son yedek bugun degilse alir. ASLA firlatmaz.
export function otomatikYedekDene(db, fallbackDir) {
  try {
    const c = yedekConfig(db, fallbackDir);
    if (!c.aktif) return { atlandi: true, neden: "kapali" };
    const bugun = new Date().toISOString().slice(0, 10);
    if (c.son && c.son.slice(0, 10) === bugun) return { atlandi: true, neden: "bugun alindi" };
    const r = yedekAl(db, c.klasor, c.tut);
    console.log(`[yedek] otomatik alindi: ${r.yol} (${r.boyut} bayt)`);
    return { ok: true, ...r };
  } catch (e) {
    console.error("[yedek] otomatik hata:", e.message);
    return { ok: false, hata: e.message };
  }
}

export const YEDEK_ADI_DESEN = YEDEK_ADI;
