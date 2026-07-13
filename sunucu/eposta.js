// eposta.js — SMTP e-posta bildirim sarmalayicisi (Office 365 varsayilanli).
// Ilke: bildirim GONDERIMI ana akisi ASLA kirmaz. Yapilandirilmamis/kapali/hatali ise
// sessizce { ok:false, atlandi:true } doner, exception firlatmaz. nodemailer DINAMIK import
// edilir → paket kurulu degilse (offline zip) sunucu yine calisir, e-posta no-op olur.
import { ayarlariGetir } from "./db.js";

// Office 365 icin makul varsayilanlar. Kullanici (admin) ayarlar ekranindan gunceller.
const VARSAYILAN = {
  smtp_host: "smtp.office365.com",
  smtp_port: "587",              // 587 = STARTTLS (secure:false, requireTLS:true); 465 = SSL (secure:true)
  smtp_kullanici: "",            // orn: admin@semak.com.tr
  smtp_parola: "",               // duz metin (DB), yalniz admin erisir
  smtp_gonderen: "",             // From adresi; bos ise smtp_kullanici kullanilir
  bildirim_hedef: "",            // IT bildirim alicilari (virgulle birden fazla)
  bildirim_aktif: "1",           // ana anahtar
  bildirim_yeni_talep: "1",      // yeni musteri talebi / musteri yaniti gelince IT'ye mail
  bildirim_musteri_durum: "1",   // talep durumu degisince MUSTERIYE mail
  bildirim_dis_kaynak: "1",      // talep dis kaynaga yonlendirilince / not eklenince DIS KISIYE mail
  bildirim_talep_acan: "1",      // talebi ACAN kisiye (ic-portal/e-posta kaynakli) durum/yanit bildirimi
};

export function epostaAyarlari(db) {
  return { ...VARSAYILAN, ...ayarlariGetir(db) };
}

// Gonderim icin yeterli yapilandirma var mi? (host + kullanici + parola)
export function epostaHazir(db) {
  const a = epostaAyarlari(db);
  return !!(a.smtp_host && a.smtp_kullanici && a.smtp_parola);
}

// Bildirimler acik mi? (ana anahtar). Test maili bu anahtardan BAGIMSIZ gonderilir.
export function bildirimAcik(db) {
  return epostaAyarlari(db).bildirim_aktif === "1";
}

export function bildirimHedefleri(db) {
  const a = epostaAyarlari(db);
  const ham = a.bildirim_hedef || a.smtp_gonderen || a.smtp_kullanici || "";
  return ham.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
}

// Dusuk hacim: her gonderimde transporter kurulur (config runtime'da degisebilir).
async function transporterKur(a) {
  let nodemailer;
  try { nodemailer = (await import("nodemailer")).default; }
  catch { throw new Error("nodemailer kurulu degil (npm install calistirin)"); }
  const port = Number(a.smtp_port) || 587;
  const secure = port === 465; // 465 => SSL; 587 => STARTTLS
  return nodemailer.createTransport({
    host: a.smtp_host,
    port,
    secure,
    requireTLS: !secure,             // 587'de STARTTLS zorunlu
    auth: { user: a.smtp_kullanici, pass: a.smtp_parola },
  });
}

// Ana gonderim. { kime, konu, metin, html }. Asla firlatmaz.
// zorla=true → bildirim ana anahtari kapali olsa bile gonderir (test maili icin).
export async function epostaGonder(db, { kime, konu, metin, html, zorla = false }) {
  try {
    const a = epostaAyarlari(db);
    if (!zorla && a.bildirim_aktif !== "1") return { ok: false, atlandi: true, neden: "bildirim kapali" };
    if (!a.smtp_host || !a.smtp_kullanici || !a.smtp_parola) return { ok: false, atlandi: true, neden: "SMTP yapilandirilmadi" };
    const alicilar = Array.isArray(kime) ? kime.filter(Boolean) : String(kime || "").split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    if (alicilar.length === 0) return { ok: false, atlandi: true, neden: "alici yok" };
    const gonderen = a.smtp_gonderen || a.smtp_kullanici;
    const t = await transporterKur(a);
    // Konu musteri verisi icerebilir → CRLF temizle (baslik enjeksiyonuna karsi savunma derinligi).
    const konuTemiz = String(konu ?? "").replace(/[\r\n]+/g, " ").slice(0, 200);
    const bilgi = await t.sendMail({ from: gonderen, to: alicilar.join(", "), subject: konuTemiz, text: metin, html });
    return { ok: true, id: bilgi.messageId };
  } catch (e) {
    console.error("[eposta] gonderim hatasi:", e.message);
    return { ok: false, hata: e.message };
  }
}

// Test maili — ayar ekranindaki "Test Gonder" butonu icin. Ana anahtardan bagimsiz.
export async function epostaTest(db, kime) {
  const a = epostaAyarlari(db);
  const hedef = kime || bildirimHedefleri(db)[0] || a.smtp_kullanici;
  if (!hedef) return { ok: false, hata: "Alici adresi yok (bildirim hedefi / SMTP kullanicisi bos)" };
  return epostaGonder(db, {
    kime: hedef,
    konu: "SITMS · Test e-postasi",
    metin: "Bu bir test e-postasidir. SITMS e-posta bildirimleri calisiyor.\n\nSemak IT Management Systems",
    html: `<div style="font-family:system-ui,Segoe UI,sans-serif;font-size:14px;color:#0F1420">
      <p>✅ Bu bir <b>test e-postasidir</b>. SITMS e-posta bildirimleri çalışıyor.</p>
      <p style="color:#6B7896;font-size:12px">Semak IT Management Systems</p></div>`,
    zorla: true,
  });
}

// Musteri, mevcut talebine portaldan mesaj yazinca IT'ye bildirim (intake'ten cagrilir).
export async function musteriMesajBildir(db, { talepId, baslik, musteri, mesaj }) {
  const a = epostaAyarlari(db);
  if (a.bildirim_yeni_talep !== "1") return { ok: false, atlandi: true }; // ayni anahtara bagli
  const hedef = bildirimHedefleri(db);
  if (hedef.length === 0) return { ok: false, atlandi: true };
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  return epostaGonder(db, {
    kime: hedef,
    konu: `💬 Müşteri yanıtı: ${baslik}`.slice(0, 180),
    metin: `${musteri || "Müşteri"} #${talepId} talebine mesaj yazdı:\n\n${mesaj}`,
    html: `<div style="font-family:system-ui,Segoe UI,sans-serif;font-size:14px;color:#0F1420">
      <h2 style="margin:0 0 8px">💬 Müşteri yanıtı</h2>
      <div style="color:#6B7896">${esc(musteri) || "Müşteri"} · talep #${esc(talepId)} · <b>${esc(baslik)}</b></div>
      <p style="white-space:pre-wrap;margin-top:10px">${esc(mesaj)}</p></div>`,
  });
}

// Talep durumu degisince MUSTERIYE bildirim (server.js'ten cagrilir). musteri e-postasi verilir.
export async function musteriDurumBildir(db, { epostaAdres, baslik, durum, talepId, marka = "Destek" }) {
  const a = epostaAyarlari(db);
  if (a.bildirim_musteri_durum !== "1") return { ok: false, atlandi: true, neden: "kapali" };
  if (!epostaAdres) return { ok: false, atlandi: true, neden: "musteri e-postasi yok" };
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  return epostaGonder(db, {
    kime: epostaAdres,
    konu: `Talebinizin durumu güncellendi: ${durum}`.slice(0, 180),
    metin: `Merhaba,\n\n"${baslik}" başlıklı talebinizin durumu: ${durum}\n\nDetay için size iletilen bağlantıyı kullanabilirsiniz.\n\n${marka}`,
    html: `<div style="font-family:system-ui,Segoe UI,sans-serif;font-size:14px;color:#0F1420">
      <p>Merhaba,</p>
      <p>"<b>${esc(baslik)}</b>" başlıklı talebinizin durumu güncellendi:</p>
      <p style="font-size:16px"><b>${esc(durum)}</b></p>
      <p style="color:#6B7896;font-size:12px">Detay için size iletilen bağlantıyı kullanabilirsiniz. · ${esc(marka)}</p></div>`,
  });
}

// IT, talebe MUSTERIYE GORUNUR yanit yazinca musteriyi haberdar et (server.js'ten).
export async function musteriYanitBildir(db, { epostaAdres, baslik, talepId, marka = "Destek" }) {
  const a = epostaAyarlari(db);
  if (a.bildirim_musteri_durum !== "1") return { ok: false, atlandi: true };
  if (!epostaAdres) return { ok: false, atlandi: true };
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  return epostaGonder(db, {
    kime: epostaAdres,
    konu: `Talebinize yanıt geldi: ${baslik}`.slice(0, 180),
    metin: `Merhaba,\n\n"${baslik}" başlıklı talebinize destek ekibimiz yanıt yazdı. Detay için size iletilen bağlantıyı kullanabilirsiniz.\n\n${marka}`,
    html: `<div style="font-family:system-ui,Segoe UI,sans-serif;font-size:14px;color:#0F1420">
      <p>Merhaba,</p>
      <p>"<b>${esc(baslik)}</b>" başlıklı talebinize destek ekibimiz yanıt yazdı.</p>
      <p style="color:#6B7896;font-size:12px">Detay için size iletilen bağlantıyı kullanabilirsiniz. · ${esc(marka)}</p></div>`,
  });
}

// Talep DIS KAYNAGA yonlendirilince dis kisiye talep detayini gonder (server.js'ten).
export async function disKaynakBildir(db, { epostaAdres, baslik, aciklama, talepId, marka = "Destek" }) {
  const a = epostaAyarlari(db);
  if (a.bildirim_dis_kaynak !== "1") return { ok: false, atlandi: true };
  if (!epostaAdres) return { ok: false, atlandi: true, neden: "dis kisi e-postasi yok" };
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  return epostaGonder(db, {
    kime: epostaAdres,
    konu: `Size yönlendirilen talep: ${baslik}`.slice(0, 180),
    metin: `Merhaba,\n\nAşağıdaki talep tarafınıza yönlendirilmiştir:\n\nKonu: ${baslik}\n\n${aciklama || ""}\n\n${marka}`,
    html: `<div style="font-family:system-ui,Segoe UI,sans-serif;font-size:14px;color:#0F1420">
      <p>Merhaba,</p>
      <p>Aşağıdaki talep tarafınıza yönlendirilmiştir:</p>
      <p><b>${esc(baslik)}</b> <span style="color:#6B7896">(#${esc(talepId)})</span></p>
      <p style="white-space:pre-wrap">${esc(aciklama) || ""}</p>
      <p style="color:#6B7896;font-size:12px;margin-top:14px">${esc(marka)}</p></div>`,
  });
}

// IT, DIS KAYNAGA yonlendirilmis talebe yorum/not yazinca dis kisiyi haberdar et (server.js'ten).
export async function disKaynakYanitBildir(db, { epostaAdres, baslik, yorum, talepId, marka = "Destek" }) {
  const a = epostaAyarlari(db);
  if (a.bildirim_dis_kaynak !== "1") return { ok: false, atlandi: true };
  if (!epostaAdres) return { ok: false, atlandi: true, neden: "dis kisi e-postasi yok" };
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  return epostaGonder(db, {
    kime: epostaAdres,
    konu: `Yönlendirilen talebe not eklendi: ${baslik}`.slice(0, 180),
    metin: `Merhaba,\n\nTarafınıza yönlendirilen "${baslik}" (#${talepId}) talebine yeni bir not eklendi:\n\n${yorum || ""}\n\n${marka}`,
    html: `<div style="font-family:system-ui,Segoe UI,sans-serif;font-size:14px;color:#0F1420">
      <p>Merhaba,</p>
      <p>Tarafınıza yönlendirilen "<b>${esc(baslik)}</b>" <span style="color:#6B7896">(#${esc(talepId)})</span> talebine yeni bir not eklendi:</p>
      <p style="white-space:pre-wrap;background:#F3F5F9;border-radius:8px;padding:10px">${esc(yorum) || ""}</p>
      <p style="color:#6B7896;font-size:12px;margin-top:12px">${esc(marka)}</p></div>`,
  });
}

// Talebi ACAN kisiye (ic-portal/e-posta kaynakli, musteri portali disindaki) durum/yanit bildirimi (server.js'ten).
export async function talepAcanBildir(db, { epostaAdres, baslik, talepId, durum = null, yanit = false, marka = "Destek" }) {
  const a = epostaAyarlari(db);
  if (a.bildirim_talep_acan !== "1") return { ok: false, atlandi: true };
  if (!epostaAdres) return { ok: false, atlandi: true, neden: "acan e-postasi yok" };
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const konu = yanit ? `Talebinize yanıt geldi: ${baslik}` : `Talebinizin durumu güncellendi: ${durum}`;
  const govde = yanit
    ? `"${baslik}" (#${talepId}) başlıklı talebinize IT ekibimiz yanıt yazdı.`
    : `"${baslik}" (#${talepId}) başlıklı talebinizin durumu: ${durum}`;
  return epostaGonder(db, {
    kime: epostaAdres,
    konu: konu.slice(0, 180),
    metin: `Merhaba,\n\n${govde}\n\n${marka}`,
    html: `<div style="font-family:system-ui,Segoe UI,sans-serif;font-size:14px;color:#0F1420">
      <p>Merhaba,</p>
      <p>${esc(govde)}</p>
      <p style="color:#6B7896;font-size:12px;margin-top:12px">${esc(marka)}</p></div>`,
  });
}

// Yeni musteri talebi bildirimi (intake'ten cagrilir). Talep kaydi + musteri adi verilir.
export async function yeniTalepBildir(db, { baslik, musteri, kategori, aciklama, iletisim, id }) {
  const a = epostaAyarlari(db);
  if (a.bildirim_yeni_talep !== "1") return { ok: false, atlandi: true, neden: "yeni talep bildirimi kapali" };
  const hedef = bildirimHedefleri(db);
  if (hedef.length === 0) return { ok: false, atlandi: true, neden: "hedef yok" };
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  return epostaGonder(db, {
    kime: hedef,
    konu: `🎫 Yeni destek talebi: ${baslik}`.slice(0, 180),
    metin: `Yeni müşteri talebi geldi.\n\nMüşteri: ${musteri || "-"}\nKonu: ${baslik}\nKategori: ${kategori || "-"}\nİletişim: ${iletisim || "-"}\n\nAçıklama:\n${aciklama || "-"}`,
    html: `<div style="font-family:system-ui,Segoe UI,sans-serif;font-size:14px;color:#0F1420">
      <h2 style="margin:0 0 8px">🎫 Yeni destek talebi</h2>
      <table style="font-size:14px;border-collapse:collapse">
        <tr><td style="color:#6B7896;padding:2px 10px 2px 0">Müşteri</td><td><b>${esc(musteri) || "-"}</b></td></tr>
        <tr><td style="color:#6B7896;padding:2px 10px 2px 0">Konu</td><td><b>${esc(baslik)}</b></td></tr>
        <tr><td style="color:#6B7896;padding:2px 10px 2px 0">Kategori</td><td>${esc(kategori) || "-"}</td></tr>
        <tr><td style="color:#6B7896;padding:2px 10px 2px 0">İletişim</td><td>${esc(iletisim) || "-"}</td></tr>
      </table>
      <p style="white-space:pre-wrap;margin-top:12px">${esc(aciklama) || "-"}</p>
      <p style="color:#6B7896;font-size:12px;margin-top:16px">SITMS · talep #${esc(id)} · personel panelinden görüntüleyin</p></div>`,
  });
}
