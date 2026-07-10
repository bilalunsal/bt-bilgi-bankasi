// intake.js — MUSTERI TALEP KAPISI. Internete acilan TEK servis budur.
// Tek yetki: gecerli tokenli musteri KENDI talebini GONDERIR. Hicbir kayit OKUNAMAZ/listelenemez.
// Ana uygulama (server.js, :8793) LAN'de kalir; burasi (:8795) ayri process/porttur.
import express from "express";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { veritabaniAc, musteriBulToken, talepEkle,
  musteriTalepleri, musteriTalepGetir, musteriMesajEkle } from "./db.js";
import { yeniTalepBildir, musteriMesajBildir } from "./eposta.js";

const META_URL = (typeof __dirname !== "undefined") ? pathToFileURL(__dirname + "/").href : import.meta.url;
const PROJE_KOK = resolve(dirname(fileURLToPath(META_URL)), "..");
const PORT = Number(process.env.INTAKE_PORT) || 8795;

const db = veritabaniAc();
const app = express();
app.set("trust proxy", true); // tunnel/reverse-proxy arkasinda gercek IP icin
app.use(express.urlencoded({ extended: false, limit: "64kb" }));
app.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

// ── Basit hiz siniri (bellek-ici) ─────────────────────────────────────────────
const pencereMs = 15 * 60 * 1000;
const izlem = new Map(); // anahtar → zaman damgalari
function hizAsildi(anahtar, limit) {
  const t = Date.now();
  const dizi = (izlem.get(anahtar) || []).filter((x) => t - x < pencereMs);
  dizi.push(t);
  izlem.set(anahtar, dizi);
  if (izlem.size > 5000) izlem.delete(izlem.keys().next().value); // kaba budama
  return dizi.length > limit;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function sayfa(baslik, govde) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(baslik)}</title><style>
*{box-sizing:border-box} body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
background:#0F1420;color:#E7ECF3;display:flex;min-height:100vh;align-items:flex-start;justify-content:center;padding:24px}
.kart{width:100%;max-width:560px;background:#151C2C;border:1px solid #26314B;border-radius:16px;padding:28px;margin-top:24px}
h1{font-size:20px;margin:0 0 4px} .alt{color:#9AA7BD;font-size:13px;margin-bottom:20px}
label{display:block;font-size:13px;color:#9AA7BD;font-weight:600;margin:14px 0 5px}
input,textarea,select{width:100%;padding:11px 12px;border-radius:10px;background:#0B0F18;border:1px solid #324061;color:#E7ECF3;font-size:14px;font-family:inherit;outline:none}
textarea{resize:vertical;min-height:96px}
.btn{margin-top:22px;width:100%;padding:13px;border:none;border-radius:11px;background:#36C9B5;color:#06231F;font-size:15px;font-weight:800;cursor:pointer}
.hp{position:absolute;left:-9999px} .zorunlu{color:#F4707F}
.ok{text-align:center} .ok .im{font-size:46px;margin-bottom:8px}
.marka{font-size:12px;color:#6B7896;text-align:center;margin-top:18px}
</style></head><body><div class="kart">${govde}<div class="marka">Semak · Destek Talep Formu</div></div></body></html>`;
}

const bulunamadi = (res) => res.status(404).send(sayfa("Bulunamadı",
  `<h1>Bağlantı geçersiz</h1><div class="alt">Bu talep bağlantısı geçerli değil veya kapatılmış. Lütfen size verilen güncel bağlantıyı kullanın ya da bizimle iletişime geçin.</div>`));

// Durum → müşteri-dostu renk (kaba eşleşme). Sadece görsel.
function durumRenk(durum) {
  const d = (durum || "").toLocaleLowerCase("tr");
  if (/(çözüldü|cozuldu|kapandı|kapandi|tamam)/.test(d)) return "#3FD08A";
  if (/(reddedildi|iptal)/.test(d)) return "#F4707F";
  if (/(inceleniyor|işlem|islem)/.test(d)) return "#5B9BFF";
  if (/(beklemede|bekliyor)/.test(d)) return "#E0B978";
  return "#9AA7BD"; // Yeni vb.
}
const rozet = (durum) => `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;color:#0B0F18;background:${durumRenk(durum)}">${esc(durum || "-")}</span>`;
const trh = (iso) => { try { return new Date(iso).toLocaleDateString("tr-TR"); } catch { return ""; } };

// "Taleplerim" listesi (form sayfasinin altinda gosterilir).
function taleplerimHtml(db, m, token) {
  const liste = musteriTalepleri(db, m.id);
  if (!liste.length) return "";
  const satirlar = liste.slice(0, 20).map((t) => `
    <a href="/t/${esc(token)}/talep/${t.id}" style="display:flex;align-items:center;gap:10px;padding:11px 0;border-top:1px solid #26314B;text-decoration:none;color:#E7ECF3">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.baslik)}</div>
        <div style="font-size:11.5px;color:#6B7896">${esc(t.kategori || "")}${t.kategori ? " · " : ""}${trh(t.olusturma)}</div>
      </div>
      ${rozet(t.durum)}
    </a>`).join("");
  return `<div style="margin-top:26px"><div style="font-size:13px;color:#9AA7BD;font-weight:700;margin-bottom:2px">Taleplerim</div>${satirlar}</div>`;
}

// ── Form ──────────────────────────────────────────────────────────────────────
app.get("/t/:token", (req, res) => {
  const m = musteriBulToken(db, req.params.token);
  if (!m) return bulunamadi(res);
  res.send(sayfa("Destek Talebi", `
    <h1>Merhaba, ${esc(m.ad)}</h1>
    <div class="alt">Talebinizi aşağıdan iletin. Ekibimiz en kısa sürede dönüş yapacaktır.</div>
    <form method="post" action="/t/${esc(req.params.token)}">
      <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off">
      <label>Konu <span class="zorunlu">*</span></label>
      <input name="konu" maxlength="200" required placeholder="Kısa özet">
      <label>Kategori</label>
      <select name="kategori"><option>Arıza</option><option>Talep</option><option>Soru</option><option>Kurulum</option><option>Diğer</option></select>
      <label>İlgili cihaz (varsa)</label>
      <input name="ilgili_cihaz" maxlength="300" placeholder="Cihaz adı / seri no">
      <label>İletişim (tel / e-posta)</label>
      <input name="iletisim" maxlength="200" placeholder="Size nasıl ulaşalım?">
      <label>Açıklama <span class="zorunlu">*</span></label>
      <textarea name="aciklama" maxlength="5000" required placeholder="Sorunu / talebi detaylandırın"></textarea>
      <button class="btn" type="submit">Talebi Gönder</button>
    </form>
    ${taleplerimHtml(db, m, req.params.token)}`));
});

// ── Talep detayi (SADECE kendi talebi) — durum + gorunur mesaj akisi + yanit kutusu ──
app.get("/t/:token/talep/:id", (req, res) => {
  const m = musteriBulToken(db, req.params.token);
  if (!m) return bulunamadi(res);
  const t = musteriTalepGetir(db, m.id, Number(req.params.id));
  if (!t) return bulunamadi(res); // baskasinin/olmayan talep → notr 404
  const mesajlar = (t.mesajlar || []).map((y) => {
    const ben = y.yazar_tip === "musteri";
    return `<div style="margin:10px 0;padding:11px 13px;border-radius:12px;background:${ben ? "#1B2338" : "#12233a"};border:1px solid #26314B">
      <div style="font-size:11.5px;color:#6B7896;margin-bottom:3px">${ben ? "Siz" : "Destek ekibi"} · ${trh(y.zaman)}</div>
      <div style="white-space:pre-wrap;font-size:13.5px">${esc(y.metin)}</div></div>`;
  }).join("") || `<div class="alt">Henüz yanıt yok. Ekibimiz talebinizi inceliyor.</div>`;
  res.send(sayfa("Talep Durumu", `
    <a href="/t/${esc(req.params.token)}" style="color:#36C9B5;text-decoration:none;font-size:13px">← Taleplerim</a>
    <h1 style="margin-top:10px">${esc(t.baslik)}</h1>
    <div class="alt">Durum: ${rozet(t.durum)} &nbsp; · &nbsp; ${trh(t.olusturma)}</div>
    <div style="margin:6px 0 14px;padding:11px 13px;border-radius:12px;background:#0B0F18;border:1px solid #26314B;white-space:pre-wrap;font-size:13.5px">${esc(t.aciklama || "")}</div>
    <div style="font-size:13px;color:#9AA7BD;font-weight:700">Yazışma</div>
    ${mesajlar}
    <form method="post" action="/t/${esc(req.params.token)}/talep/${t.id}/mesaj" style="margin-top:14px">
      <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off">
      <label>Ek mesaj / güncelleme</label>
      <textarea name="mesaj" maxlength="3000" required placeholder="Eklemek istediğiniz bir şey var mı?"></textarea>
      <button class="btn" type="submit">Gönder</button>
    </form>`));
});

// Musteri mevcut talebine mesaj ekler.
app.post("/t/:token/talep/:id/mesaj", (req, res) => {
  const m = musteriBulToken(db, req.params.token);
  if (!m) return bulunamadi(res);
  const ip = req.ip || "?";
  if (hizAsildi(`t:${m.id}`, 12) || hizAsildi(`ip:${ip}`, 25)) {
    return res.status(429).send(sayfa("Çok fazla istek", `<h1>Biraz bekleyin</h1><div class="alt">Kısa sürede çok fazla istek. Birkaç dakika sonra tekrar deneyin.</div>`));
  }
  const b = req.body || {};
  if (b.website) return res.redirect(`/t/${req.params.token}/talep/${req.params.id}`); // honeypot: sessizce yut
  const talepId = Number(req.params.id);
  try {
    musteriMesajEkle(db, { talepId, musteriId: m.id, ad: m.ad, metin: b.mesaj });
    musteriMesajBildir(db, { talepId, baslik: (musteriTalepGetir(db, m.id, talepId)?.baslik) || "", musteri: m.ad, mesaj: String(b.mesaj || "").slice(0, 3000) })
      .catch((e) => console.error("[intake] mesaj bildirimi:", e.message));
    res.redirect(`/t/${req.params.token}/talep/${talepId}`);
  } catch {
    return bulunamadi(res); // sahip degil / gecersiz → notr
  }
});

// ── Gonderim ────────────────────────────────────────────────────────────────────
app.post("/t/:token", (req, res) => {
  const m = musteriBulToken(db, req.params.token);
  if (!m) return bulunamadi(res);
  const ip = req.ip || "?";
  if (hizAsildi(`t:${m.id}`, 8) || hizAsildi(`ip:${ip}`, 20)) {
    return res.status(429).send(sayfa("Çok fazla istek",
      `<h1>Biraz bekleyin</h1><div class="alt">Kısa sürede çok fazla talep gönderildi. Lütfen birkaç dakika sonra tekrar deneyin.</div>`));
  }
  const b = req.body || {};
  if (b.website) return res.send(sayfa("Alındı", `<div class="ok"><div class="im">✅</div><h1>Teşekkürler</h1></div>`)); // honeypot: sessizce yut
  const konu = String(b.konu || "").trim();
  const aciklama = String(b.aciklama || "").trim();
  if (!konu || !aciklama) {
    return res.status(400).send(sayfa("Eksik bilgi",
      `<h1>Eksik alan</h1><div class="alt">Konu ve açıklama zorunludur. <a style="color:#36C9B5" href="/t/${esc(req.params.token)}">Geri dön</a></div>`));
  }
  const kategori = String(b.kategori || "").slice(0, 40) || null;
  const iletisim = String(b.iletisim || "").slice(0, 200) || null;
  const talepId = talepEkle(db, {
    musteri_id: m.id, musteri: m.ad,
    konu, aciklama, kategori, iletisim,
    ilgili_cihaz: String(b.ilgili_cihaz || "").slice(0, 300) || null,
    kaynak: "intake",
  });
  // IT'ye bildirim maili — ana akisi (musteriye yanit) ASLA bloklamaz/kirmaz.
  yeniTalepBildir(db, { id: talepId, baslik: konu, musteri: m.ad, kategori, iletisim, aciklama })
    .catch((e) => console.error("[intake] bildirim hatasi:", e.message));
  res.send(sayfa("Talebiniz alındı", `<div class="ok"><div class="im">✅</div>
    <h1>Talebiniz alındı</h1><div class="alt">En kısa sürede sizinle iletişime geçeceğiz. Bu pencereyi kapatabilirsiniz.</div></div>`));
});

// Kok / diger → notr (bilgi sizdirma yok)
app.get("/", (_req, res) => res.status(200).send(sayfa("Destek", `<h1>Destek Talep Kapısı</h1><div class="alt">Talep göndermek için size verilen özel bağlantıyı kullanın.</div>`)));
app.use((_req, res) => bulunamadi(res));

app.listen(PORT, () => console.log(`Intake (talep kapisi) → http://localhost:${PORT}  [SADECE bu servis disari acilir]`));
