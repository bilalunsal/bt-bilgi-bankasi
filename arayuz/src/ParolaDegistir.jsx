// ParolaDegistir.jsx — parola degistirme (gonullu veya zorunlu ilk giris). Modal/kart.
import React, { useState } from "react";
import { PAL } from "./tema.js";
import { api } from "./api.js";
import { Panel, Buton, girdiStil } from "./ui.jsx";

export default function ParolaDegistir({ zorunlu = false, onBitti, onIptal }) {
  const [eski, setEski] = useState("");
  const [yeni, setYeni] = useState("");
  const [yeni2, setYeni2] = useState("");
  const [hata, setHata] = useState("");
  const [bekle, setBekle] = useState(false);

  async function kaydet(e) {
    e?.preventDefault();
    if (yeni.length < 4) return setHata("Yeni parola en az 4 karakter olmalı.");
    if (yeni !== yeni2) return setHata("Yeni parolalar eşleşmiyor.");
    setBekle(true); setHata("");
    try { await api.parolaDegistir(eski, yeni); onBitti(); }
    catch (er) { setHata(er.message); setBekle(false); }
  }

  const govde = (
    <form onSubmit={kaydet}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Parola değiştir</div>
      {zorunlu && <div style={{ color: PAL.gold, fontSize: 12.5, marginBottom: 12 }}>İlk giriş: güvenlik için lütfen parolanızı değiştirin.</div>}
      <label style={{ fontSize: 12.5, color: PAL.soluk, fontWeight: 600 }}>Mevcut parola</label>
      <input style={{ ...girdiStil, margin: "5px 0 10px" }} type="password" value={eski} onChange={(e) => setEski(e.target.value)} autoFocus />
      <label style={{ fontSize: 12.5, color: PAL.soluk, fontWeight: 600 }}>Yeni parola</label>
      <input style={{ ...girdiStil, margin: "5px 0 10px" }} type="password" value={yeni} onChange={(e) => setYeni(e.target.value)} />
      <label style={{ fontSize: 12.5, color: PAL.soluk, fontWeight: 600 }}>Yeni parola (tekrar)</label>
      <input style={{ ...girdiStil, margin: "5px 0 4px" }} type="password" value={yeni2} onChange={(e) => setYeni2(e.target.value)} />
      {hata && <div style={{ color: PAL.rose, fontSize: 12.5, marginTop: 8 }}>{hata}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
        {!zorunlu && <Buton onClick={onIptal} type="button">İptal</Buton>}
        <Buton birincil type="submit" disabled={bekle}>{bekle ? "Kaydediliyor…" : "Kaydet"}</Buton>
      </div>
    </form>
  );

  if (zorunlu) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: PAL.bg }}>
      <Panel style={{ width: 380, padding: 26 }}>{govde}</Panel>
    </div>;
  }
  return (
    <div onClick={onIptal} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "grid", placeItems: "center", zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()}>
        <Panel style={{ width: 380, padding: 26 }}>{govde}</Panel>
      </div>
    </div>
  );
}
