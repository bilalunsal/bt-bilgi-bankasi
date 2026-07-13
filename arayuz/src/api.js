// api.js — sunucu ile konusma. Dev'de Vite proxy /api → 8790; uretimde ayni origin.
const TABAN = "";

async function iste(yol, secenek) {
  const r = await fetch(TABAN + yol, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin", // oturum cerezi gonderilsin
    ...secenek,
  });
  if (!r.ok) {
    let m = r.statusText;
    try { m = (await r.json()).hata || m; } catch { /* yoksay */ }
    const e = new Error(m);
    if (r.status === 401) e.yetkisiz = true;
    throw e;
  }
  return r.status === 204 ? null : r.json();
}

export const api = {
  version: () => iste("/api/version"),
  guncelleme: () => iste("/api/guncelleme"),
  tipler: () => iste("/api/tipler"),
  alanlar: (tip) => iste(`/api/alanlar${tip ? `?tip=${tip}` : ""}`),
  istatistik: () => iste("/api/istatistik"),
  ara: ({ q = "", tip = "", durum = "", limit = 50, offset = 0 } = {}) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (tip) p.set("tip", tip);
    if (durum) p.set("durum", durum);
    p.set("limit", limit); p.set("offset", offset);
    return iste(`/api/ara?${p.toString()}`);
  },
  kayit: (id) => iste(`/api/kayit/${id}`),
  ekle: (g) => iste("/api/kayit", { method: "POST", body: JSON.stringify(g) }),
  guncelle: (id, g) => iste(`/api/kayit/${id}`, { method: "PUT", body: JSON.stringify(g) }),
  sil: (id) => iste(`/api/kayit/${id}`, { method: "DELETE" }),
  yorumEkle: (id, y) => iste(`/api/kayit/${id}/yorum`, { method: "POST", body: JSON.stringify(y) }),
  iliskiEkle: (id, i) => iste(`/api/kayit/${id}/iliski`, { method: "POST", body: JSON.stringify(i) }),
  iliskiSil: (id) => iste(`/api/iliski/${id}`, { method: "DELETE" }),
  ekEkle: (id, e) => iste(`/api/kayit/${id}/ek`, { method: "POST", body: JSON.stringify(e) }),
  ekSil: (ekId) => iste(`/api/ek/${ekId}`, { method: "DELETE" }),
  ekUrl: (ekId) => `/api/ek/${ekId}`,
  zimmetAta: (id, personel_id, not) => iste(`/api/kayit/${id}/zimmet`, { method: "POST", body: JSON.stringify({ personel_id, not }) }),
  zimmetIade: (id, not) => iste(`/api/kayit/${id}/iade`, { method: "POST", body: JSON.stringify({ not }) }),
  uyarilar: (gun = 45) => iste(`/api/uyarilar?gun=${gun}`),
  // ── Kimlik ──
  ben: () => iste("/api/ben"),
  giris: (kadi, parola) => iste("/api/giris", { method: "POST", body: JSON.stringify({ kadi, parola }) }),
  cikis: () => iste("/api/cikis", { method: "POST" }),
  parolaDegistir: (eski, yeni) => iste("/api/parola", { method: "POST", body: JSON.stringify({ eski, yeni }) }),
  kullanicilar: () => iste("/api/kullanicilar"),
  kullaniciEkle: (k) => iste("/api/kullanicilar", { method: "POST", body: JSON.stringify(k) }),
  kullaniciSifirla: (id, yeni) => iste(`/api/kullanicilar/${id}/sifirla`, { method: "POST", body: JSON.stringify({ yeni }) }),
  kullaniciDurum: (id, aktif) => iste(`/api/kullanicilar/${id}/durum`, { method: "POST", body: JSON.stringify({ aktif }) }),
  kullaniciRol: (id, rol) => iste(`/api/kullanicilar/${id}/rol`, { method: "POST", body: JSON.stringify({ rol }) }),
  rollerIzin: () => iste("/api/roller/izin"),
  rollerIzinKaydet: (izin_personel) => iste("/api/roller/izin", { method: "PUT", body: JSON.stringify({ izin_personel }) }),
  // ── Ayarlar (SMTP / e-posta bildirim) — admin ──
  ayarlar: () => iste("/api/ayarlar"),
  ayarlariKaydet: (a) => iste("/api/ayarlar", { method: "PUT", body: JSON.stringify(a) }),
  epostaTest: (kime) => iste("/api/ayarlar/eposta-test", { method: "POST", body: JSON.stringify({ kime }) }),
  postaKontrol: () => iste("/api/posta/kontrol", { method: "POST" }),
  // ── Marka (white-label) — GET public; logo yaz/sil admin ──
  marka: () => iste("/api/marka"),
  markaLogoYukle: (veri, tur) => iste("/api/marka/logo", { method: "POST", body: JSON.stringify({ veri, tur }) }),
  markaLogoSil: () => iste("/api/marka/logo", { method: "DELETE" }),
  // ── Yedekleme — admin ──
  yedekListe: () => iste("/api/yedek/liste"),
  yedekSimdi: () => iste("/api/yedek/simdi", { method: "POST" }),
  yedekIndirUrl: (ad) => `/api/yedek/indir?ad=${encodeURIComponent(ad)}`,
};

// Dosyayi base64'e cevir (data URL onekini ayikla)
export function dosyaOku(file) {
  return new Promise((coz, hata) => {
    const r = new FileReader();
    r.onload = () => coz(String(r.result).replace(/^data:[^;]*;base64,/, ""));
    r.onerror = () => hata(new Error("Dosya okunamadi"));
    r.readAsDataURL(file);
  });
}

export const boyutFmt = (b) => {
  if (b == null) return "";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
};
