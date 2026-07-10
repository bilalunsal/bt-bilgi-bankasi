// ui.jsx — paylasilan kucuk bilesenler (yalnizca inline style).
import React from "react";
import { PAL, TIP_RENK, durumRenk } from "./tema.js";

// Marka logosu: yuklenmis logo (data URI) varsa onu, yoksa marka adinin bas harfiyle monogram.
// White-label: gomulu logo yok; her firma kendi logosunu Ayarlar'dan yukler.
export function MarkaLogo({ marka, yukseklik = 26 }) {
  if (marka?.logo) {
    return (
      <div style={{ background: "#fff", borderRadius: 8, padding: "4px 8px", display: "flex", alignItems: "center" }}>
        <img src={marka.logo} alt={marka.ad || ""} style={{ height: yukseklik, maxWidth: yukseklik * 5, objectFit: "contain", display: "block" }} />
      </div>
    );
  }
  const harf = ((marka?.ad || "?").trim()[0] || "?").toLocaleUpperCase("tr");
  const kutu = yukseklik + 12;
  return (
    <div style={{ width: kutu, height: kutu, borderRadius: 10, display: "grid", placeItems: "center",
      background: PAL.teal, color: "#06231F", fontWeight: 800, fontSize: Math.round(yukseklik * 0.62) }}>{harf}</div>
  );
}

export function Panel({ children, style, ...p }) {
  return (
    <div style={{ background: PAL.surface, border: `1px solid ${PAL.cizgi}`, borderRadius: 14, ...style }} {...p}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: PAL.soluk2, fontWeight: 700, marginBottom: 8 }}>
      {children}
    </div>
  );
}

export function Rozet({ children, renk = PAL.mavi, dolu = false }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 9px", borderRadius: 999, fontSize: 12, fontWeight: 600,
      color: dolu ? "#08121A" : renk,
      background: dolu ? renk : `${renk}1f`,
      border: `1px solid ${renk}55`,
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

export function DurumRozet({ durum }) {
  if (!durum) return null;
  const r = durumRenk(durum);
  return (
    <Rozet renk={r}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: r, display: "inline-block" }} />
      {durum}
    </Rozet>
  );
}

export function TipRozet({ tip, tipMeta }) {
  const m = tipMeta?.[tip];
  const renk = TIP_RENK[tip] || PAL.mavi;
  return <Rozet renk={renk}>{m?.ikon} {m?.etiket || tip}</Rozet>;
}

export function Etiket({ children }) {
  return (
    <span style={{
      padding: "1px 8px", borderRadius: 6, fontSize: 11.5, fontWeight: 600,
      color: PAL.soluk, background: PAL.surface2, border: `1px solid ${PAL.cizgi}`,
    }}>#{children}</span>
  );
}

export function Buton({ children, birincil, tehlike, style, ...p }) {
  const renk = tehlike ? PAL.rose : PAL.teal;
  return (
    <button {...p} style={{
      display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
      padding: "9px 15px", borderRadius: 10, fontSize: 13.5, fontWeight: 700,
      color: birincil ? "#06231F" : PAL.metin,
      background: birincil ? renk : "transparent",
      border: `1px solid ${birincil ? renk : PAL.cizgi2}`,
      transition: "all .12s", ...style,
    }}>{children}</button>
  );
}

export const girdiStil = {
  width: "100%", padding: "9px 11px", borderRadius: 9,
  background: PAL.bg2, border: `1px solid ${PAL.cizgi2}`, color: PAL.metin,
  fontSize: 13.5, outline: "none", fontFamily: "inherit",
};

// Alan tanimina gore form girdisi
export function AlanGirdi({ tanim, deger, onChange }) {
  const ortak = { style: girdiStil, value: deger ?? "", onChange: (e) => onChange(e.target.value) };
  switch (tanim.veri_tipi) {
    case "uzunmetin":
      return <textarea {...ortak} rows={4} style={{ ...girdiStil, resize: "vertical" }} />;
    case "sayi":
    case "para":
      return <input {...ortak} type="number" step="any" />;
    case "tarih":
      return <input {...ortak} type="date" />;
    case "eposta":
      return <input {...ortak} type="email" placeholder="ornek@firma.com" />;
    case "url":
      return <input {...ortak} type="url" placeholder="https://" />;
    case "secim":
      return (
        <select {...ortak}>
          <option value="">— seçin —</option>
          {(tanim.secenekler || []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      );
    default:
      return <input {...ortak} type="text" />;
  }
}

export function Yukleniyor({ metin = "Yükleniyor…" }) {
  return <div style={{ padding: 40, textAlign: "center", color: PAL.soluk2 }}>{metin}</div>;
}
