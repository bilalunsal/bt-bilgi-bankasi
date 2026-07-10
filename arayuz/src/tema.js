// tema.js — Strateji Masasi tarzi koyu palet + kucuk yardimcilar. Sadece inline style; Tailwind YOK.
export const PAL = {
  bg: "#0F1420",
  bg2: "#0B0F18",
  surface: "#151C2C",
  surface2: "#1B2338",
  cizgi: "#26314B",
  cizgi2: "#324061",
  metin: "#E7ECF3",
  soluk: "#9AA7BD",
  soluk2: "#6B7896",
  teal: "#36C9B5",
  green: "#3FD08A",
  mavi: "#5B9BFF",
  mor: "#A88BFA",
  gold: "#E0B978",
  rose: "#F4707F",
  turuncu: "#F2A25C",
};

// Kayit tipine gore vurgu rengi
export const TIP_RENK = {
  donanim: PAL.teal,
  yazilim: PAL.mavi,
  lisans: PAL.gold,
  bilgi: PAL.green,
  sozlesme: PAL.mor,
  tedarikci: PAL.turuncu,
  ag: PAL.rose,
  alan_adi: PAL.mavi,
  ssl: PAL.green,
  dis_kisi: PAL.turuncu,
};

// Duruma gore rozet rengi (kaba eslesme)
export function durumRenk(durum) {
  const d = (durum || "").toLocaleLowerCase("tr");
  if (/(aktif|kurulu|yayinda)/.test(d)) return PAL.green;
  if (/(ariza|hurda|kayip|iptal|doldu|fesh)/.test(d)) return PAL.rose;
  if (/(servis|bekliyor|yakinda|guncelle|taslak)/.test(d)) return PAL.gold;
  if (/(depo|rezerve|pasif|kaldir|kullanilm|kullanim disi)/.test(d)) return PAL.soluk2;
  return PAL.mavi;
}

export const tarihFmt = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

export const gunFmt = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
};
