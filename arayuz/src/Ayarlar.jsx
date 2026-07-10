// Ayarlar.jsx — admin: SMTP / e-posta bildirim yapilandirmasi + test maili.
// Parola GET'te maskeli gelir (smtp_parola_var). Bos birakilirsa mevcut parola KORUNUR.
import React, { useEffect, useState } from "react";
import { PAL } from "./tema.js";
import { api, dosyaOku, boyutFmt } from "./api.js";
import { Panel, Eyebrow, Buton, girdiStil, Yukleniyor, MarkaLogo } from "./ui.jsx";

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
  const [marka, setMarka] = useState(null);      // { ad, tam, logo } — onizleme
  const [logoYukluyor, setLogoYukluyor] = useState(false);
  const [hata, setHata] = useState("");
  const [bilgi, setBilgi] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [testYaziyor, setTestYaziyor] = useState(false);
  const [surum, setSurum] = useState(null);       // { yerel, uzak, guncellemeVar, hata }
  const [surumKontrol, setSurumKontrol] = useState(false);

  async function surumKontrolEt() {
    setSurumKontrol(true);
    try { setSurum(await api.guncelleme()); } catch (e) { setSurum({ hata: e.message }); }
    setSurumKontrol(false);
  }
  useEffect(() => { surumKontrolEt(); }, []);

  const [yedek, setYedek] = useState(null);        // { klasor, varsayilanKlasor, aktif, tut, son, liste }
  const [yedekYaziyor, setYedekYaziyor] = useState(false);
  async function yedekYukle() { try { setYedek(await api.yedekListe()); } catch (e) { setHata(e.message); } }
  useEffect(() => { yedekYukle(); }, []);
  async function simdiYedekle() {
    setHata(""); setBilgi(""); setYedekYaziyor(true);
    try {
      // Once klasor/tut ayarlarini kaydet (girilen degerlerle yedeklensin)
      await api.ayarlariKaydet({ yedek_aktif: f.yedek_aktif, yedek_klasor: f.yedek_klasor, yedek_tut: f.yedek_tut });
      const r = await api.yedekSimdi();
      setBilgi(`Yedek alındı: ${r.ad} (${boyutFmt(r.boyut)})`);
      yedekYukle();
    } catch (e) { setHata(`Yedek başarısız: ${e.message}`); }
    setYedekYaziyor(false);
  }

  useEffect(() => {
    Promise.all([api.ayarlar(), api.marka()]).then(([a, m]) => {
      setParolaVar(!!a.smtp_parola_var);
      setMarka(m);
      setF({
        marka_ad: a.marka_ad || m.ad || "",
        marka_tam: a.marka_tam || m.tam || "",
        smtp_host: a.smtp_host || VARSAYILAN.smtp_host,
        smtp_port: a.smtp_port || VARSAYILAN.smtp_port,
        smtp_kullanici: a.smtp_kullanici || VARSAYILAN.smtp_kullanici,
        smtp_gonderen: a.smtp_gonderen || VARSAYILAN.smtp_gonderen,
        bildirim_hedef: a.bildirim_hedef || VARSAYILAN.bildirim_hedef,
        bildirim_aktif: a.bildirim_aktif ?? VARSAYILAN.bildirim_aktif,
        bildirim_yeni_talep: a.bildirim_yeni_talep ?? VARSAYILAN.bildirim_yeni_talep,
        bildirim_musteri_durum: a.bildirim_musteri_durum ?? "1",
        bildirim_dis_kaynak: a.bildirim_dis_kaynak ?? "1",
        yedek_aktif: a.yedek_aktif ?? "0",
        yedek_klasor: a.yedek_klasor ?? "",
        yedek_tut: a.yedek_tut ?? "14",
        smtp_parola: "", // bos = degistirme
      });
    }).catch((e) => setHata(e.message));
  }, []);

  async function logoSec(e) {
    const dosya = e.target.files?.[0];
    e.target.value = ""; // ayni dosya tekrar secilebilsin
    if (!dosya) return;
    if (dosya.size > 2 * 1024 * 1024) { setHata("Logo çok büyük (en fazla ~2MB)."); return; }
    setHata(""); setBilgi(""); setLogoYukluyor(true);
    try {
      const b64 = await dosyaOku(dosya);
      await api.markaLogoYukle(b64, dosya.type);
      setMarka(await api.marka());
      setBilgi("Logo yüklendi.");
    } catch (er) { setHata(er.message); }
    setLogoYukluyor(false);
  }
  async function logoSil() {
    setHata(""); setBilgi("");
    try { await api.markaLogoSil(); setMarka(await api.marka()); setBilgi("Logo kaldırıldı."); }
    catch (er) { setHata(er.message); }
  }

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
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>⚙️ Ayarlar</h2>
        <div style={{ flex: 1 }} />
        <Buton onClick={test} disabled={testYaziyor}>{testYaziyor ? "Gönderiliyor…" : "✉️ Test Gönder"}</Buton>
        <div style={{ width: 8 }} />
        <Buton birincil onClick={kaydet} disabled={kaydediliyor}>{kaydediliyor ? "Kaydediliyor…" : "Kaydet"}</Buton>
      </div>
      {hata && <div style={{ color: PAL.rose, fontSize: 13, marginBottom: 10 }}>{hata}</div>}
      {bilgi && <div style={{ color: PAL.green, fontSize: 13, marginBottom: 10 }}>{bilgi}</div>}

      <Panel style={{ padding: 18, marginBottom: 14 }}>
        <Eyebrow>Marka / Görünüm</Eyebrow>
        <div style={{ fontSize: 11.5, color: PAL.soluk2, margin: "4px 0 12px" }}>
          Program adı ve logosu bu kuruluma özeldir. Başka bir firmaya kurarken burayı değiştirmeniz yeterli.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 6 }}>
          <MarkaLogo marka={marka || { ad: f.marka_ad }} yukseklik={40} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label style={{ ...btnGibi, cursor: logoYukluyor ? "default" : "pointer", opacity: logoYukluyor ? 0.6 : 1 }}>
              {logoYukluyor ? "Yükleniyor…" : (marka?.logo ? "Logoyu Değiştir" : "Logo Yükle")}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" onChange={logoSec} style={{ display: "none" }} disabled={logoYukluyor} />
            </label>
            {marka?.logo && <button onClick={logoSil} style={{ ...btnGibi, color: PAL.rose, borderColor: PAL.cizgi2 }}>Kaldır</button>}
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: PAL.soluk2, marginBottom: 12 }}>PNG / JPG / SVG · en fazla ~2MB. Logo yoksa baş harf gösterilir.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <Etiket baslik="Kısa ad" ipucu="Üst köşede görünür.">
            <input style={girdiStil} value={f.marka_ad} onChange={(e) => set("marka_ad", e.target.value)} placeholder="Örn: SITMS" />
          </Etiket>
          <Etiket baslik="Tam ad" ipucu="Giriş ekranı + sekme başlığı. Buradaki firma adını değiştirin.">
            <input style={girdiStil} value={f.marka_tam} onChange={(e) => set("marka_tam", e.target.value)} placeholder="Örn: Semak IT Management Systems" />
          </Etiket>
        </div>
      </Panel>

      <Panel style={{ padding: 18, marginBottom: 14 }}>
        <Eyebrow>Bildirimler</Eyebrow>
        <Anahtar acik={f.bildirim_aktif === "1"} onToggle={() => toggle("bildirim_aktif")}
          baslik="E-posta bildirimleri açık" aciklama="Kapalıysa hiçbir otomatik e-posta gönderilmez (test hariç)." />
        <div style={{ borderTop: `1px solid ${PAL.cizgi}` }} />
        <Anahtar acik={f.bildirim_yeni_talep === "1"} onToggle={() => toggle("bildirim_yeni_talep")}
          baslik="Yeni müşteri talebi / yanıtı geldiğinde e-posta" aciklama="Müşteri talep gönderince veya mevcut talebine mesaj yazınca IT'ye bildirim." />
        <div style={{ borderTop: `1px solid ${PAL.cizgi}` }} />
        <Anahtar acik={f.bildirim_musteri_durum === "1"} onToggle={() => toggle("bildirim_musteri_durum")}
          baslik="Müşteriye durum / yanıt e-postası" aciklama="Talebin durumu değişince veya müşteriye görünür yanıt yazılınca müşteriye bildirim (e-postası kayıtlıysa)." />
        <div style={{ borderTop: `1px solid ${PAL.cizgi}` }} />
        <Anahtar acik={f.bildirim_dis_kaynak === "1"} onToggle={() => toggle("bildirim_dis_kaynak")}
          baslik="Dış kaynağa yönlendirme e-postası" aciklama="Talep bir dış kişiye yönlendirilince, o kişinin e-postasına talep detayı otomatik gönderilir." />
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

      <Panel style={{ padding: 18, marginTop: 14 }}>
        <Eyebrow>Yedekleme</Eyebrow>
        <div style={{ fontSize: 11.5, color: PAL.soluk2, margin: "4px 0 10px" }}>
          Veriler tek bir SQLite dosyasında. Yedek <b>ikinci bir diske veya ağ paylaşımına</b> yazılmalı
          (aynı diske yazmak disk arızasında işe yaramaz).
        </div>
        <Anahtar acik={f.yedek_aktif === "1"} onToggle={() => toggle("yedek_aktif")}
          baslik="Otomatik günlük yedek" aciklama="Sunucu açıkken günde bir kez otomatik yedek alır (son N adet tutulur)." />
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginTop: 8 }}>
          <Etiket baslik="Yedek klasörü" ipucu="Örn: D:\SITMS-yedek veya \\SUNUCU\yedek. Boşsa: _yedekler (aynı disk).">
            <input style={girdiStil} value={f.yedek_klasor} onChange={(e) => set("yedek_klasor", e.target.value)}
              placeholder={yedek?.varsayilanKlasor || "D:\\SITMS-yedek"} />
          </Etiket>
          <Etiket baslik="Kaç adet saklansın" ipucu="Eski yedekler otomatik silinir.">
            <input style={girdiStil} type="number" min="1" value={f.yedek_tut} onChange={(e) => set("yedek_tut", e.target.value)} />
          </Etiket>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
          <Buton birincil onClick={simdiYedekle} disabled={yedekYaziyor}>{yedekYaziyor ? "Yedekleniyor…" : "💾 Şimdi Yedekle"}</Buton>
          <div style={{ fontSize: 12, color: PAL.soluk2 }}>
            {yedek?.son ? `Son yedek: ${new Date(yedek.son).toLocaleString("tr-TR")}` : "Henüz yedek alınmadı."}
            {yedek?.klasor && <span> · Klasör: {yedek.klasor}</span>}
          </div>
        </div>
        {yedek?.liste?.length > 0 && (
          <div style={{ marginTop: 12, borderTop: `1px solid ${PAL.cizgi}`, paddingTop: 8 }}>
            {yedek.liste.slice(0, 8).map((y) => (
              <div key={y.ad} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 12.5 }}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{y.ad}</span>
                <span style={{ color: PAL.soluk2 }}>{boyutFmt(y.boyut)}</span>
                <a href={api.yedekIndirUrl(y.ad)} style={{ color: PAL.teal, textDecoration: "none", fontWeight: 600 }}>indir</a>
              </div>
            ))}
            {yedek.liste.length > 8 && <div style={{ fontSize: 11.5, color: PAL.soluk2, marginTop: 4 }}>…ve {yedek.liste.length - 8} tane daha</div>}
          </div>
        )}
      </Panel>

      <Panel style={{ padding: 18, marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Eyebrow>Sürüm & Güncelleme</Eyebrow>
            <div style={{ fontSize: 13.5, marginTop: 6 }}>
              Yüklü sürüm: <b>{surum?.yerel?.version || "…"}</b>
              {surum?.yerel?.yapim != null && <span style={{ color: PAL.soluk2 }}> (yapım {surum.yerel.yapim})</span>}
            </div>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>
              {surumKontrol && <span style={{ color: PAL.soluk2 }}>GitHub kontrol ediliyor…</span>}
              {!surumKontrol && surum?.hata && <span style={{ color: PAL.soluk2 }}>Kontrol edilemedi (çevrimdışı?): {surum.hata}</span>}
              {!surumKontrol && surum && !surum.hata && (surum.guncellemeVar
                ? <span style={{ color: PAL.gold, fontWeight: 700 }}>⬆ Güncelleme mevcut: {surum.uzak.version} (yapım {surum.uzak.yapim})</span>
                : <span style={{ color: PAL.green, fontWeight: 700 }}>✓ En güncel sürümü kullanıyorsunuz</span>)}
            </div>
            {!surumKontrol && surum?.guncellemeVar && (
              <div style={{ fontSize: 12, color: PAL.soluk, marginTop: 6, lineHeight: 1.6 }}>
                {surum.uzak?.not && <div style={{ marginBottom: 4 }}>Yenilik: {surum.uzak.not}</div>}
                Sunucuda <b>guncelle.bat</b> çalıştırıp ardından <b>sunucu-baslat.bat</b> ile yeniden başlatın.
                (Veriler korunur.)
              </div>
            )}
          </div>
          <Buton onClick={surumKontrolEt} disabled={surumKontrol}>{surumKontrol ? "Kontrol…" : "Kontrol Et"}</Buton>
        </div>
      </Panel>
    </div>
  );
}

const btnGibi = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
  border: `1px solid ${PAL.cizgi2}`, background: PAL.surface2, color: PAL.metin, fontSize: 13,
  fontWeight: 600, cursor: "pointer",
};
