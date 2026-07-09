// Kullanicilar.jsx — admin: personel hesaplarini yonet (ekle, parola sifirla, rol, aktif/pasif).
import React, { useEffect, useState } from "react";
import { PAL, tarihFmt } from "./tema.js";
import { api } from "./api.js";
import { Panel, Eyebrow, Rozet, Buton, girdiStil, Yukleniyor } from "./ui.jsx";

export default function Kullanicilar({ ben }) {
  const [liste, setListe] = useState(null);
  const [hata, setHata] = useState("");
  const [ekleAcik, setEkleAcik] = useState(false);
  const [yeni, setYeni] = useState({ kadi: "", ad: "", rol: "personel", parola: "" });
  const [bilgi, setBilgi] = useState("");

  async function yukle() { try { setListe(await api.kullanicilar()); } catch (e) { setHata(e.message); } }
  useEffect(() => { yukle(); }, []);

  async function ekle() {
    setHata(""); setBilgi("");
    try {
      await api.kullaniciEkle(yeni);
      setBilgi(`"${yeni.kadi}" eklendi. Geçici parola: ${yeni.parola} (ilk girişte değiştirmesi istenecek).`);
      setYeni({ kadi: "", ad: "", rol: "personel", parola: "" }); setEkleAcik(false); yukle();
    } catch (e) { setHata(e.message); }
  }
  async function sifirla(k) {
    const p = prompt(`"${k.kadi}" için yeni geçici parola:`);
    if (!p) return;
    try { await api.kullaniciSifirla(k.id, p); setBilgi(`"${k.kadi}" parolası sıfırlandı (geçici: ${p}).`); }
    catch (e) { setHata(e.message); }
  }
  async function durum(k) { try { await api.kullaniciDurum(k.id, !k.aktif); yukle(); } catch (e) { setHata(e.message); } }
  async function rol(k) { try { await api.kullaniciRol(k.id, k.rol === "admin" ? "personel" : "admin"); yukle(); } catch (e) { setHata(e.message); } }

  if (!liste) return <Yukleniyor />;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>👤 Kullanıcılar</h2>
        <div style={{ flex: 1 }} />
        <Buton birincil onClick={() => setEkleAcik((s) => !s)}>+ Kullanıcı</Buton>
      </div>
      {hata && <div style={{ color: PAL.rose, fontSize: 13, marginBottom: 10 }}>{hata}</div>}
      {bilgi && <div style={{ color: PAL.green, fontSize: 13, marginBottom: 10 }}>{bilgi}</div>}

      {ekleAcik && (
        <Panel style={{ padding: 16, marginBottom: 14 }}>
          <Eyebrow>Yeni kullanıcı</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
            <input style={girdiStil} placeholder="Kullanıcı adı" value={yeni.kadi} onChange={(e) => setYeni({ ...yeni, kadi: e.target.value })} />
            <input style={girdiStil} placeholder="Ad Soyad" value={yeni.ad} onChange={(e) => setYeni({ ...yeni, ad: e.target.value })} />
            <input style={girdiStil} placeholder="Geçici parola" value={yeni.parola} onChange={(e) => setYeni({ ...yeni, parola: e.target.value })} />
            <select style={girdiStil} value={yeni.rol} onChange={(e) => setYeni({ ...yeni, rol: e.target.value })}>
              <option value="personel">Personel</option>
              <option value="admin">Yönetici (admin)</option>
            </select>
          </div>
          <div style={{ marginTop: 10, textAlign: "right" }}><Buton birincil onClick={ekle}>Ekle</Buton></div>
        </Panel>
      )}

      <Panel style={{ padding: 6 }}>
        {liste.map((k) => (
          <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderBottom: `1px solid ${PAL.cizgi}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                {k.ad || k.kadi} <span style={{ color: PAL.soluk2, fontWeight: 400, fontSize: 12.5 }}>@{k.kadi}</span>
              </div>
              <div style={{ fontSize: 11.5, color: PAL.soluk2 }}>
                {k.son_giris ? `Son giriş: ${tarihFmt(k.son_giris)}` : "Hiç giriş yapmadı"}
                {k.sifre_yenile ? " · parola değiştirmesi bekleniyor" : ""}
              </div>
            </div>
            <Rozet renk={k.rol === "admin" ? PAL.gold : PAL.mavi}>{k.rol === "admin" ? "Yönetici" : "Personel"}</Rozet>
            {!k.aktif && <Rozet renk={PAL.rose}>Pasif</Rozet>}
            {k.id !== ben.id && (
              <>
                <button onClick={() => rol(k)} title="Rol değiştir" style={ikonBtn}>⇅</button>
                <button onClick={() => sifirla(k)} title="Parola sıfırla" style={ikonBtn}>🔑</button>
                <button onClick={() => durum(k)} title={k.aktif ? "Pasifleştir" : "Aktifleştir"} style={ikonBtn}>{k.aktif ? "🚫" : "✅"}</button>
              </>
            )}
            {k.id === ben.id && <span style={{ fontSize: 11.5, color: PAL.soluk2 }}>siz</span>}
          </div>
        ))}
      </Panel>
    </div>
  );
}

const ikonBtn = { background: "none", border: `1px solid ${PAL.cizgi2}`, borderRadius: 8, cursor: "pointer", fontSize: 14, padding: "4px 8px", color: PAL.metin };
