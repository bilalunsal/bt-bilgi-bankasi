// Giris.jsx — tam ekran giris. Basarili olunca onGiris(kullanici).
import React, { useState } from "react";
import { PAL } from "./tema.js";
import { api } from "./api.js";
import { Buton, girdiStil } from "./ui.jsx";
import logo from "./assets/logo-semak.jpg";

export default function Giris({ onGiris }) {
  const [kadi, setKadi] = useState("");
  const [parola, setParola] = useState("");
  const [hata, setHata] = useState("");
  const [bekle, setBekle] = useState(false);

  async function gir(e) {
    e?.preventDefault();
    setBekle(true); setHata("");
    try {
      const { kullanici } = await api.giris(kadi.trim(), parola);
      onGiris(kullanici);
    } catch (er) { setHata(er.message); setBekle(false); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: PAL.bg }}>
      <form onSubmit={gir} style={{ width: 360, background: PAL.surface, border: `1px solid ${PAL.cizgi}`, borderRadius: 16, padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "10px 16px", display: "flex" }}>
            <img src={logo} alt="SEMAK" style={{ height: 46, display: "block" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>BT Bilgi Bankası</div>
            <div style={{ fontSize: 12, color: PAL.soluk2 }}>Personel girişi</div>
          </div>
        </div>

        <label style={{ fontSize: 12.5, color: PAL.soluk, fontWeight: 600 }}>Kullanıcı adı</label>
        <input style={{ ...girdiStil, margin: "5px 0 12px" }} value={kadi} autoFocus autoComplete="username"
          onChange={(e) => setKadi(e.target.value)} placeholder="admin" />
        <label style={{ fontSize: 12.5, color: PAL.soluk, fontWeight: 600 }}>Parola</label>
        <input style={{ ...girdiStil, margin: "5px 0 4px" }} type="password" value={parola} autoComplete="current-password"
          onChange={(e) => setParola(e.target.value)} placeholder="••••••" />

        {hata && <div style={{ color: PAL.rose, fontSize: 12.5, marginTop: 8 }}>{hata}</div>}

        <Buton birincil type="submit" disabled={bekle} style={{ width: "100%", justifyContent: "center", marginTop: 16 }}>
          {bekle ? "Giriş yapılıyor…" : "Giriş"}
        </Buton>
        <div style={{ fontSize: 11.5, color: PAL.soluk2, marginTop: 14, textAlign: "center" }}>
          İlk kurulum: <b>admin</b> / <b>admin</b> — giriş sonrası parolanızı değiştirin.
        </div>
      </form>
    </div>
  );
}
