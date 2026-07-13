// ui.jsx — paylasilan kucuk bilesenler (yalnizca inline style).
import React, { useState, useEffect } from "react";
import { PAL, TIP_RENK, durumRenk } from "./tema.js";
import { api } from "./api.js";

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
    case "iliski":
      return <IliskiGirdi tanim={tanim} deger={deger} onChange={onChange} />;
    default:
      return <input {...ortak} type="text" />;
  }
}

// Iliski alani icin form-ici SECICI: iliski_tip'teki kayitlari arar, secilen kaydin id'sini saklar,
// etiketini rozet olarak gosterir. (Onceden ham metin/id giriliyordu — zayifti.)
export function IliskiGirdi({ tanim, deger, onChange }) {
  const [q, setQ] = useState("");
  const [sonuc, setSonuc] = useState([]);
  const [secili, setSecili] = useState(null); // { id, baslik }
  const [odak, setOdak] = useState(false);

  // Kayitli deger (id) → etiketi coz
  useEffect(() => {
    let iptal = false;
    if (deger) {
      if (!secili || String(secili.id) !== String(deger)) {
        api.kayit(deger).then((k) => { if (!iptal) setSecili(k ? { id: k.id, baslik: k.baslik } : null); }).catch(() => { if (!iptal) setSecili(null); });
      }
    } else setSecili(null);
    return () => { iptal = true; };
  }, [deger]); // eslint-disable-line

  async function ara(v) {
    setQ(v);
    if (v.trim().length < 2) { setSonuc([]); return; }
    try { setSonuc(await api.ara({ q: v, tip: tanim.iliski_tip, limit: 6 })); } catch { setSonuc([]); }
  }

  if (secili) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Rozet renk={PAL.mavi}>🔗 {secili.baslik}</Rozet>
        <button type="button" onClick={() => { onChange(""); setSecili(null); setQ(""); }}
          style={{ background: "none", border: "none", color: PAL.soluk2, cursor: "pointer", fontSize: 12.5 }}>değiştir</button>
      </div>
    );
  }
  return (
    <div style={{ position: "relative" }}>
      <input style={girdiStil} value={q} placeholder={`${tanim.etiket} ara… (en az 2 harf)`}
        onChange={(e) => ara(e.target.value)} onFocus={() => setOdak(true)} onBlur={() => setTimeout(() => setOdak(false), 150)} />
      {odak && sonuc.length > 0 && (
        <div style={{ marginTop: 4, background: PAL.bg2, border: `1px solid ${PAL.cizgi}`, borderRadius: 8, overflow: "hidden" }}>
          {sonuc.map((s) => (
            <div key={s.id}
              onMouseDown={(e) => { e.preventDefault(); onChange(s.id); setSecili({ id: s.id, baslik: s.baslik }); setQ(""); setSonuc([]); setOdak(false); }}
              style={{ padding: "7px 9px", cursor: "pointer", fontSize: 13 }}
              onMouseEnter={(e) => e.currentTarget.style.background = PAL.surface2}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              🔗 {s.baslik}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Yukleniyor({ metin = "Yükleniyor…" }) {
  return <div style={{ padding: 40, textAlign: "center", color: PAL.soluk2 }}>{metin}</div>;
}
