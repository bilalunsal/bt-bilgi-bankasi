// Ayarlar.jsx — admin: SMTP / e-posta bildirim yapilandirmasi + test maili.
// Parola GET'te maskeli gelir (smtp_parola_var). Bos birakilirsa mevcut parola KORUNUR.
import React, { useEffect, useState } from "react";
import { PAL } from "./tema.js";
import { api } from "./api.js";
import { Panel, Eyebrow, Buton, girdiStil, Yukleniyor } from "./ui.jsx";

// Office 365 varsayilanlari — ilk kurulumda alanlar dolu gelsin, admin yalniz parolayi girsin.
const VARSAYILAN = {
  smtp_host: "smtp.office365.com",
  smtp_port: "587",
  smtp_kullanici: "admin@semak.com.tr",
  smtp_gonderen: "admin@semak.com.tr",
  bildirim_hedef: "admin@semak.com.tr",
  bildirim_aktif: "1",
  bildirim_yeni_talep: "1",
};

function Etiket({ baslik, ipucu, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, color: PAL.soluk, marginBottom: 5, fontWeight: 600 }}>{baslik}</div>
      {children}
      {ipucu && <div style={{ fontSize: 11.5, color: PAL.soluk2, marginTop: 4 }}>{ipucu}</div>}
    </label>
  );
}

function Anahtar({ acik, onToggle, baslik, aciklama }) {
  return (
    <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", cursor: "pointer" }}>
      <div style={{ width: 42, height: 24, borderRadius: 999, background: acik ? PAL.teal : PAL.cizgi2, position: "relative", transition: "background .15s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 3, left: acik ? 21 : 3, width: 18, height: 18, borderRadius: 999, background: "#fff", transition: "left .15s" }} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{baslik}</div>
        {aciklama && <div style={{ fontSize: 11.5, color: PAL.soluk2 }}>{aciklama}</div>}
      </div>
    </div>
  );
}

export default function Ayarlar() {
  const [f, setF] = useState(null);
  const [parolaVar, setParolaVar] = useState(false);
  const [hata, setHata] = useState("");
  const [bilgi, setBilgi] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [testYaziyor, setTestYaziyor] = useState(false);

  useEffect(() => {
    api.ayarlar().then((a) => {
      setParolaVar(!!a.smtp_parola_var);
      setF({
        smtp_host: a.smtp_host || VARSAYILAN.smtp_host,
        smtp_port: a.smtp_port || VARSAYILAN.smtp_port,
        smtp_kullanici: a.smtp_kullanici || VARSAYILAN.smtp_kullanici,
        smtp_gonderen: a.smtp_gonderen || VARSAYILAN.smtp_gonderen,
        bildirim_hedef: a.bildirim_hedef || VARSAYILAN.bildirim_hedef,
        bildirim_aktif: a.bildirim_aktif ?? VARSAYILAN.bildirim_aktif,
        bildirim_yeni_talep: a.bildirim_yeni_talep ?? VARSAYILAN.bildirim_yeni_talep,
        smtp_parola: "", // bos = degistirme
      });
    }).catch((e) => setHata(e.message));
  }, []);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggle = (k) => setF((s) => ({ ...s, [k]: s[k] === "1" ? "0" : "1" }));

  async function kaydet() {
    setHata(""); setBilgi(""); setKaydediliyor(true);
    try {
      const yuk = { ...f };
      if (!yuk.smtp_parola) delete yuk.smtp_parola; // bos parola gonderme (mevcut korunur)
      await api.ayarlariKaydet(yuk);
      if (f.smtp_parola) setParolaVar(true);
      setF((s) => ({ ...s, smtp_parola: "" }));
      setBilgi("Ayarlar kaydedildi.");
    } catch (e) { setHata(e.message); }
    setKaydediliyor(false);
  }

  async function test() {
    setHata(""); setBilgi(""); setTestYaziyor(true);
    try {
      // Once kaydet (girilen ama kaydedilmemis degerlerle test edilsin)
      const yuk = { ...f }; if (!yuk.smtp_parola) delete yuk.smtp_parola;
      await api.ayarlariKaydet(yuk);
      if (f.smtp_parola) { setParolaVar(true); setF((s) => ({ ...s, smtp_parola: "" })); }
      const r = await api.epostaTest(f.bildirim_hedef);
      if (r.ok) setBilgi(`Test e-postası gönderildi → ${f.bildirim_hedef}. Gelen kutusunu kontrol edin.`);
      else setHata(`Test başarısız: ${r.hata || r.neden || "bilinmeyen"}`);
    } catch (e) { setHata(e.message); }
    setTestYaziyor(false);
  }

  if (hata && !f) return <div style={{ color: PAL.rose, padding: 20 }}>{hata}</div>;
  if (!f) return <Yukleniyor />;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>⚙️ E-posta Bildirimleri</h2>
        <div style={{ flex: 1 }} />
        <Buton onClick={test} disabled={testYaziyor}>{testYaziyor ? "Gönderiliyor…" : "✉️ Test Gönder"}</Buton>
        <div style={{ width: 8 }} />
        <Buton birincil onClick={kaydet} disabled={kaydediliyor}>{kaydediliyor ? "Kaydediliyor…" : "Kaydet"}</Buton>
      </div>
      {hata && <div style={{ color: PAL.rose, fontSize: 13, marginBottom: 10 }}>{hata}</div>}
      {bilgi && <div style={{ color: PAL.green, fontSize: 13, marginBottom: 10 }}>{bilgi}</div>}

      <Panel style={{ padding: 18, marginBottom: 14 }}>
        <Eyebrow>Bildirimler</Eyebrow>
        <Anahtar acik={f.bildirim_aktif === "1"} onToggle={() => toggle("bildirim_aktif")}
          baslik="E-posta bildirimleri açık" aciklama="Kapalıysa hiçbir otomatik e-posta gönderilmez (test hariç)." />
        <div style={{ borderTop: `1px solid ${PAL.cizgi}` }} />
        <Anahtar acik={f.bildirim_yeni_talep === "1"} onToggle={() => toggle("bildirim_yeni_talep")}
          baslik="Yeni müşteri talebi geldiğinde e-posta" aciklama="Müşteri talep kapısından talep gönderince IT'ye bildirim." />
        <div style={{ marginTop: 10 }}>
          <Etiket baslik="Bildirim alıcı(ları)" ipucu="Birden fazla için virgülle ayırın.">
            <input style={girdiStil} value={f.bildirim_hedef} onChange={(e) => set("bildirim_hedef", e.target.value)} placeholder="admin@semak.com.tr" />
          </Etiket>
        </div>
      </Panel>

      <Panel style={{ padding: 18 }}>
        <Eyebrow>SMTP Sunucusu (Office 365)</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginTop: 8 }}>
          <Etiket baslik="Sunucu (host)"><input style={girdiStil} value={f.smtp_host} onChange={(e) => set("smtp_host", e.target.value)} /></Etiket>
          <Etiket baslik="Port" ipucu="587 = STARTTLS, 465 = SSL"><input style={girdiStil} value={f.smtp_port} onChange={(e) => set("smtp_port", e.target.value)} /></Etiket>
        </div>
        <Etiket baslik="Kullanıcı adı (e-posta)"><input style={girdiStil} value={f.smtp_kullanici} onChange={(e) => set("smtp_kullanici", e.target.value)} placeholder="admin@semak.com.tr" /></Etiket>
        <Etiket baslik="Parola" ipucu={parolaVar ? "Parola tanımlı. Değiştirmek istemiyorsanız boş bırakın." : "Office 365 SMTP AUTH parolası (gerekirse uygulama parolası)."}>
          <input style={girdiStil} type="password" value={f.smtp_parola} onChange={(e) => set("smtp_parola", e.target.value)}
            placeholder={parolaVar ? "•••••••• (değiştirmek için yazın)" : "Parola girin"} autoComplete="new-password" />
        </Etiket>
        <Etiket baslik="Gönderen (From) adresi" ipucu="Genelde kullanıcı adıyla aynı. Office 365 farklı From'a genelde izin vermez.">
          <input style={girdiStil} value={f.smtp_gonderen} onChange={(e) => set("smtp_gonderen", e.target.value)} placeholder="admin@semak.com.tr" />
        </Etiket>
      </Panel>

      <div style={{ fontSize: 11.5, color: PAL.soluk2, marginTop: 14, lineHeight: 1.6 }}>
        <b>Office 365 notu:</b> Kiracıda <b>SMTP AUTH</b> kapalıysa gönderim başarısız olur (Test bunu gösterir).
        Microsoft 365 yönetim merkezinden ilgili posta kutusu için <i>Authenticated SMTP</i> açılmalı;
        MFA varsa <i>uygulama parolası</i> gerekebilir. Parola bu sunucudaki veritabanında (LAN) saklanır.
      </div>
    </div>
  );
}
