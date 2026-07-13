// Kullanicilar.jsx — admin: hesaplari yonet (ekle, parola sifirla, rol, aktif/pasif)
// + Personel rolu izinlerini (modul grubu bazinda) yapilandir.
import React, { useEffect, useState } from "react";
import { PAL, tarihFmt } from "./tema.js";
import { api } from "./api.js";
import { Panel, Eyebrow, Rozet, Buton, girdiStil, Yukleniyor } from "./ui.jsx";

const ROL_AD = { admin: "Yönetici", it: "IT", personel: "Personel" };
const ROL_RENK = { admin: PAL.gold, it: PAL.green, personel: PAL.mavi };
const rolAd = (r) => ROL_AD[r] || r;

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
  async function rolDegis(k, r) { try { await api.kullaniciRol(k.id, r); yukle(); } catch (e) { setHata(e.message); } }

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
              <option value="it">IT</option>
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
            <Rozet renk={ROL_RENK[k.rol] || PAL.mavi}>{rolAd(k.rol)}</Rozet>
            {!k.aktif && <Rozet renk={PAL.rose}>Pasif</Rozet>}
            {k.id !== ben.id && (
              <>
                <select value={k.rol} onChange={(e) => rolDegis(k, e.target.value)} title="Rol"
                  style={{ ...girdiStil, width: "auto", padding: "5px 8px", fontSize: 12.5 }}>
                  <option value="personel">Personel</option>
                  <option value="it">IT</option>
                  <option value="admin">Yönetici</option>
                </select>
                <button onClick={() => sifirla(k)} title="Parola sıfırla" style={ikonBtn}>🔑</button>
                <button onClick={() => durum(k)} title={k.aktif ? "Pasifleştir" : "Aktifleştir"} style={ikonBtn}>{k.aktif ? "🚫" : "✅"}</button>
              </>
            )}
            {k.id === ben.id && <span style={{ fontSize: 11.5, color: PAL.soluk2 }}>siz</span>}
          </div>
        ))}
      </Panel>

      <PersonelIzinler onHata={setHata} onBilgi={setBilgi} />
    </div>
  );
}

// Personel rolunun eristigi modul gruplarini (ticket, envanter, dokuman, alan/ssl) admin secer.
// admin: her sey; IT: yonetim haric her sey (sabit). Yalniz PERSONEL yapilandirilabilir.
function PersonelIzinler({ onHata, onBilgi }) {
  const [veri, setVeri] = useState(null);
  const [secili, setSecili] = useState(null); // Set

  useEffect(() => {
    api.rollerIzin().then((r) => { setVeri(r); setSecili(new Set(r.izin_personel || [])); }).catch((e) => onHata?.(e.message));
  }, []); // eslint-disable-line

  if (!veri || !secili) return null;
  const icerik = veri.moduller.filter((m) => veri.icerikModulleri.includes(m.anahtar));

  function toggle(anahtar) {
    setSecili((s) => { const n = new Set(s); n.has(anahtar) ? n.delete(anahtar) : n.add(anahtar); return n; });
  }
  async function kaydet() {
    try { await api.rollerIzinKaydet(Array.from(secili)); onBilgi?.("Personel rolü izinleri kaydedildi."); }
    catch (e) { onHata?.(e.message); }
  }

  return (
    <Panel style={{ padding: 16, marginTop: 16 }}>
      <Eyebrow>Rol izinleri — Personel</Eyebrow>
      <div style={{ fontSize: 12.5, color: PAL.soluk2, margin: "6px 0 12px" }}>
        <b>Personel</b> rolündeki kullanıcıların erişeceği modülleri seçin. (<b>Yönetici</b> her şeye,
        <b> IT</b> Yönetim hariç her şeye erişir — bunlar sabittir.) “Genel” panosu herkese açıktır.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {icerik.map((m) => (
          <label key={m.anahtar} style={{
            display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", cursor: "pointer",
            border: `1px solid ${secili.has(m.anahtar) ? PAL.mavi : PAL.cizgi2}`, borderRadius: 9,
            background: secili.has(m.anahtar) ? PAL.bg2 : "transparent",
          }}>
            <input type="checkbox" checked={secili.has(m.anahtar)} onChange={() => toggle(m.anahtar)} />
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.baslik}</span>
          </label>
        ))}
      </div>
      <div style={{ marginTop: 12, textAlign: "right" }}><Buton birincil onClick={kaydet}>İzinleri Kaydet</Buton></div>
    </Panel>
  );
}

const ikonBtn = { background: "none", border: `1px solid ${PAL.cizgi2}`, borderRadius: 8, cursor: "pointer", fontSize: 14, padding: "4px 8px", color: PAL.metin };
