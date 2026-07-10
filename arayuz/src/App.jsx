// App.jsx — BT Bilgi Bankasi ana uygulama: kenar cubugu + tam metin arama + liste + detay + form.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { PAL, TIP_RENK, durumRenk, gunFmt } from "./tema.js";
import { api } from "./api.js";
import { Panel, Rozet, DurumRozet, TipRozet, Etiket, Buton, Yukleniyor, girdiStil, MarkaLogo } from "./ui.jsx";
import KayitForm from "./KayitForm.jsx";
import KayitDetay from "./KayitDetay.jsx";
import Uyarilar from "./Uyarilar.jsx";
import Giris from "./Giris.jsx";
import ParolaDegistir from "./ParolaDegistir.jsx";
import Kullanicilar from "./Kullanicilar.jsx";
import Ayarlar from "./Ayarlar.jsx";
import { LISTE_KOLON } from "./modul.js";

// Sol menu gruplari (FortiGate tarzi acilir-kapanir). tipler API'den gelir; burada gruplanir.
const MENU_GRUPLARI = [
  { baslik: "Genel", ikon: "📊", ozel: ["tumu", "uyarilar"] },
  { baslik: "Envanter", ikon: "🗄️", tipler: ["donanim", "yazilim", "lisans", "ag"] },
  { baslik: "Alan Adı & SSL", ikon: "🌍", tipler: ["alan_adi", "ssl"] },
  { baslik: "Dokümantasyon", ikon: "📚", tipler: ["sistem", "surec", "revizyon", "bilgi"] },
  { baslik: "Kişiler & Destek", ikon: "🤝", tipler: ["personel", "talep", "tedarikci", "sozlesme"] },
  { baslik: "Yönetim", ikon: "⚙️", ozel: ["kullanicilar", "ayarlar"], adminGerek: true },
];

export default function App() {
  const [tipler, setTipler] = useState([]);
  const [iliskiTurleri, setIliskiTurleri] = useState([]);
  const [zimmetlenebilir, setZimmetlenebilir] = useState([]);
  const [ist, setIst] = useState(null);
  const [q, setQ] = useState("");
  const [aktifTip, setAktifTip] = useState("");
  const [aktifDurum, setAktifDurum] = useState("");
  const [sonuclar, setSonuclar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [gorunum, setGorunum] = useState("liste"); // liste | detay | form
  const [seciliId, setSeciliId] = useState(null);
  const [formTip, setFormTip] = useState(null);
  const [formMevcut, setFormMevcut] = useState(null);
  const [yeniMenu, setYeniMenu] = useState(false);
  const [uyariSayi, setUyariSayi] = useState(0);
  const [ben, setBen] = useState(null);
  const [marka, setMarka] = useState({ ad: "SITMS", tam: "IT Management Systems", logo: null });
  const [guncelVar, setGuncelVar] = useState(false);
  const [authYuklendi, setAuthYuklendi] = useState(false);
  const [parolaModal, setParolaModal] = useState(false);
  const [kullaniciMenu, setKullaniciMenu] = useState(false);
  const araInput = useRef(null);

  const tipMeta = useMemo(() => Object.fromEntries(tipler.map((t) => [t.kod, t])), [tipler]);
  const aktifTipMeta = tipler.find((t) => t.kod === aktifTip);

  // Oturum kontrolu (acilista)
  useEffect(() => {
    api.ben().then((r) => setBen(r.kullanici)).catch(() => setBen(null)).finally(() => setAuthYuklendi(true));
  }, []);
  // Marka (public) — giristen once de yuklenir; sekme basligini gunceller
  useEffect(() => {
    api.marka().then((m) => {
      setMarka(m);
      if (m?.tam) document.title = m.tam;
    }).catch(() => {});
  }, [ben]);
  // Uygulama verisi — yalnizca giris yapildiktan sonra
  useEffect(() => {
    if (!ben) return;
    api.tipler().then((d) => { setTipler(d.tipler); setIliskiTurleri(d.iliskiTurleri); setZimmetlenebilir(d.zimmetlenebilir || []); });
    panoYenile();
    // Guncelleme kontrolu (yalnizca admin) — bat calistirmadan "yeni surum var mi" gorsun
    if (ben.rol === "admin") api.guncelleme().then((r) => setGuncelVar(!!r.guncellemeVar)).catch(() => {});
  }, [ben]);

  async function cikisYap() {
    try { await api.cikis(); } catch { /* yoksay */ }
    setBen(null); setKullaniciMenu(false); setGorunum("liste");
  }
  const panoYenile = () => {
    api.istatistik().then(setIst).catch(() => {});
    api.uyarilar(45).then((u) => setUyariSayi((u.gecmis?.length || 0) + (u.yakin?.length || 0))).catch(() => {});
  };

  // arama (debounce)
  useEffect(() => {
    if (!ben) return;
    setYukleniyor(true);
    const t = setTimeout(() => {
      api.ara({ q, tip: aktifTip, durum: aktifDurum, limit: 100 })
        .then(setSonuclar).catch(() => setSonuclar([])).finally(() => setYukleniyor(false));
    }, 220);
    return () => clearTimeout(t);
  }, [q, aktifTip, aktifDurum, ben]);

  const tipSay = (kod) => ist?.tipBazli.find((x) => x.tip === kod)?.n || 0;

  // Menu akordeon: yalnizca TEK grup acik. Bir baslik tiklaninca o acilir, digerleri kapanir.
  const [acikGrup, setAcikGrup] = useState("Genel");
  const toggleGrup = (b) => setAcikGrup((cur) => (cur === b ? "" : b));

  // Ozel (tip olmayan) menu ogeleri
  const ozelOge = {
    tumu: { etiket: "Tümü", ikon: "▦", renk: PAL.mavi, say: ist?.toplam, aktif: gorunum === "liste" && !aktifTip,
      onClick: () => { setAktifTip(""); setAktifDurum(""); setGorunum("liste"); } },
    uyarilar: { etiket: "Uyarılar", ikon: "🔔", renk: PAL.gold, rozetRenk: PAL.gold, say: uyariSayi || null,
      aktif: gorunum === "uyarilar", onClick: () => setGorunum("uyarilar") },
    kullanicilar: { etiket: "Kullanıcılar", ikon: "👤", renk: PAL.mor, say: null,
      aktif: gorunum === "kullanicilar", onClick: () => setGorunum("kullanicilar") },
    ayarlar: { etiket: "Ayarlar", ikon: "⚙️", renk: PAL.soluk, say: null,
      aktif: gorunum === "ayarlar", onClick: () => setGorunum("ayarlar") },
  };
  const grupCocuklari = (grup) => {
    const out = [];
    for (const oz of grup.ozel || []) { const d = ozelOge[oz]; if (d) out.push({ key: oz, ...d }); }
    for (const kod of grup.tipler || []) {
      const t = tipler.find((x) => x.kod === kod); if (!t) continue;
      out.push({ key: kod, etiket: t.etiket, ikon: t.ikon, renk: TIP_RENK[kod], say: tipSay(kod),
        aktif: gorunum === "liste" && aktifTip === kod,
        onClick: () => { setAktifTip(kod); setAktifDurum(""); setGorunum("liste"); } });
    }
    return out;
  };
  // Hicbir grupta olmayan tipler (ileride eklenirse) → "Diger"
  const kapsanan = new Set(MENU_GRUPLARI.flatMap((g) => g.tipler || []));
  const digerTipler = tipler.filter((t) => !kapsanan.has(t.kod)).map((t) => t.kod);

  function yeniAc(tipKod) { setFormTip(tipKod); setFormMevcut(null); setYeniMenu(false); setGorunum("form"); }
  function duzenleAc(kayit) { setFormTip(kayit.tip); setFormMevcut(kayit); setGorunum("form"); }
  function detayAc(id) { setSeciliId(id); setGorunum("detay"); }
  function formBitti() { setGorunum(seciliId ? "detay" : "liste"); panoYenile(); listeYenile(); }
  function listeYenile() {
    api.ara({ q, tip: aktifTip, durum: aktifDurum, limit: 100 }).then(setSonuclar).catch(() => {});
  }

  // klavye kisayolu: "/" → aramaya odaklan
  useEffect(() => {
    const h = (e) => {
      if (e.key === "/" && document.activeElement !== araInput.current && gorunum === "liste") {
        e.preventDefault(); araInput.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [gorunum]);

  // ── Kimlik kapisi ──
  if (!authYuklendi) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: PAL.soluk2 }}>Yükleniyor…</div>;
  if (!ben) return <Giris onGiris={setBen} marka={marka} />;
  if (ben.sifre_yenile) return <ParolaDegistir zorunlu onBitti={() => api.ben().then((r) => setBen(r.kullanici))} />;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* UST SERIT */}
      <header style={{
        display: "flex", alignItems: "center", gap: 16, padding: "12px 20px",
        borderBottom: `1px solid ${PAL.cizgi}`, background: PAL.bg2, position: "sticky", top: 0, zIndex: 20,
      }}>
        <div onClick={() => { setGorunum("liste"); setAktifTip(""); setAktifDurum(""); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
          <MarkaLogo marka={marka} yukseklik={26} />
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{marka.ad}</div>
            <div style={{ fontSize: 10.5, color: PAL.soluk2 }}>{marka.tam}</div>
          </div>
        </div>

        {ben.rol === "admin" && guncelVar && (
          <button onClick={() => setGorunum("ayarlar")} title="Güncelleme mevcut — Ayarlar'a git"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999,
              border: `1px solid ${PAL.gold}`, background: "transparent", color: PAL.gold, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
            ⬆ Güncelleme var
          </button>
        )}

        <div style={{ flex: 1, maxWidth: 640, position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: 10, color: PAL.soluk2 }}>🔍</span>
          <input ref={araInput} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Her şeyi ara: seri no, marka, kişi, etiket, not…  ( / )"
            style={{ ...girdiStil, paddingLeft: 34, height: 40, fontSize: 14 }}
            onFocus={() => setGorunum("liste")} />
        </div>

        <div style={{ position: "relative", display: "flex" }}>
          <Buton birincil onClick={() => (aktifTip ? yeniAc(aktifTip) : setYeniMenu((s) => !s))}
            style={aktifTip ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : undefined}>
            + Yeni {aktifTipMeta ? aktifTipMeta.etiket : "Kayıt"}
          </Buton>
          {aktifTip && (
            <Buton birincil title="Başka tip ekle" onClick={() => setYeniMenu((s) => !s)}
              style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: "1px solid rgba(0,0,0,.25)", padding: "9px 10px" }}>▾</Buton>
          )}
          {yeniMenu && (
            <div style={{ position: "absolute", right: 0, top: 46, background: PAL.surface, border: `1px solid ${PAL.cizgi2}`, borderRadius: 12, padding: 6, minWidth: 200, zIndex: 30, boxShadow: "0 12px 40px rgba(0,0,0,.5)" }}>
              <div style={{ fontSize: 11, color: PAL.soluk2, padding: "4px 11px 6px", textTransform: "uppercase", letterSpacing: 0.5 }}>Yeni kayıt tipi</div>
              {tipler.map((t) => (
                <div key={t.kod} onClick={() => yeniAc(t.kod)} style={{ padding: "9px 11px", borderRadius: 8, cursor: "pointer", display: "flex", gap: 9, alignItems: "center", fontSize: 14 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = PAL.surface2}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <span>{t.ikon}</span> {t.etiket}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KULLANICI MENUSU */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setKullaniciMenu((s) => !s)} style={{
            display: "flex", alignItems: "center", gap: 8, background: "transparent", border: `1px solid ${PAL.cizgi2}`,
            borderRadius: 10, padding: "6px 10px", cursor: "pointer", color: PAL.metin,
          }}>
            <span style={{ width: 24, height: 24, borderRadius: 999, background: PAL.surface2, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800 }}>
              {(ben.ad || ben.kadi).slice(0, 1).toLocaleUpperCase("tr")}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{ben.ad || ben.kadi}</span>
            {ben.rol === "admin" && <span style={{ fontSize: 10, color: PAL.gold, fontWeight: 700 }}>ADMIN</span>}
          </button>
          {kullaniciMenu && (
            <div style={{ position: "absolute", right: 0, top: 44, background: PAL.surface, border: `1px solid ${PAL.cizgi2}`, borderRadius: 12, padding: 6, minWidth: 200, zIndex: 30, boxShadow: "0 12px 40px rgba(0,0,0,.5)" }}>
              <MenuOge onClick={() => { setParolaModal(true); setKullaniciMenu(false); }}>🔑 Parola değiştir</MenuOge>
              {ben.rol === "admin" && <MenuOge onClick={() => { setGorunum("kullanicilar"); setKullaniciMenu(false); }}>👤 Kullanıcılar</MenuOge>}
              <MenuOge onClick={cikisYap}>🚪 Çıkış</MenuOge>
            </div>
          )}
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* KENAR */}
        <aside style={{ width: 236, borderRight: `1px solid ${PAL.cizgi}`, padding: "12px 12px", background: PAL.bg2, flexShrink: 0, overflowY: "auto" }}>
          {MENU_GRUPLARI.map((grup) => {
            if (grup.adminGerek && ben.rol !== "admin") return null;
            const cocuklar = grupCocuklari(grup);
            if (cocuklar.length === 0) return null;
            return (
              <MenuGrubu key={grup.baslik} grup={grup} cocuklar={cocuklar}
                acik={acikGrup === grup.baslik} onToggle={() => toggleGrup(grup.baslik)} />
            );
          })}
          {digerTipler.length > 0 && (
            <MenuGrubu grup={{ baslik: "Diğer", ikon: "📦" }} acik={acikGrup === "Diğer"} onToggle={() => toggleGrup("Diğer")}
              cocuklar={grupCocuklari({ tipler: digerTipler })} />
          )}

          {aktifTipMeta && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${PAL.cizgi}` }}>
              <div style={{ fontSize: 11, color: PAL.soluk2, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Durum</div>
              <DurumSuzgec durum="" etiket="Hepsi" aktif={!aktifDurum} onClick={() => setAktifDurum("")} />
              {aktifTipMeta.durumlar.map((d) => (
                <DurumSuzgec key={d} durum={d} etiket={d} aktif={aktifDurum === d} onClick={() => setAktifDurum(d)} />
              ))}
            </div>
          )}
        </aside>

        {/* ANA */}
        <main style={{ flex: 1, padding: 22, overflow: "auto", minWidth: 0 }}>
          {gorunum === "form" && (
            <KayitForm tip={formTip} tipMeta={tipMeta} mevcut={formMevcut} zimmetlenebilir={zimmetlenebilir}
              onKaydet={(k) => { if (!formMevcut) { setSeciliId(k.id); } formBitti(); if (!formMevcut) detayAc(k.id); }}
              onIptal={formBitti} />
          )}
          {gorunum === "detay" && seciliId && (
            <KayitDetay id={seciliId} tipMeta={tipMeta} iliskiTurleri={iliskiTurleri}
              onDuzenle={duzenleAc} onGeri={() => { setGorunum("liste"); panoYenile(); listeYenile(); }} onGit={detayAc} />
          )}
          {gorunum === "uyarilar" && (
            <Uyarilar tipMeta={tipMeta} onGit={detayAc} />
          )}
          {gorunum === "kullanicilar" && ben.rol === "admin" && (
            <Kullanicilar ben={ben} />
          )}
          {gorunum === "ayarlar" && ben.rol === "admin" && (
            <Ayarlar />
          )}
          {gorunum === "liste" && (
            <Liste sonuclar={sonuclar} yukleniyor={yukleniyor} tipMeta={tipMeta} q={q}
              baslik={aktifTipMeta ? `${aktifTipMeta.ikon} ${aktifTipMeta.etiket}` : "Tüm kayıtlar"}
              yeniEtiket={aktifTipMeta?.etiket}
              onDetay={detayAc} onYeni={() => (aktifTip ? yeniAc(aktifTip) : setYeniMenu(true))} />
          )}
        </main>
      </div>

      {parolaModal && <ParolaDegistir onBitti={() => setParolaModal(false)} onIptal={() => setParolaModal(false)} />}
    </div>
  );
}

function MenuOge({ children, onClick }) {
  return (
    <div onClick={onClick} style={{ padding: "9px 11px", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
      onMouseEnter={(e) => e.currentTarget.style.background = PAL.surface2}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      {children}
    </div>
  );
}

function MenuGrubu({ grup, cocuklar, acik, onToggle }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", cursor: "pointer", userSelect: "none" }}
        onMouseEnter={(e) => e.currentTarget.style.background = PAL.surface}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
        <span style={{ fontSize: 13, width: 16, textAlign: "center" }}>{grup.ikon}</span>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: PAL.soluk2 }}>{grup.baslik}</span>
        <span style={{ fontSize: 10, color: PAL.soluk2 }}>{acik ? "▾" : "▸"}</span>
      </div>
      {acik && (
        <div style={{ marginTop: 2 }}>
          {cocuklar.map((c) => (
            <KenarOge key={c.key} etiket={c.etiket} ikon={c.ikon} renk={c.renk} say={c.say}
              rozetRenk={c.rozetRenk} girinti aktif={c.aktif} onClick={c.onClick} />
          ))}
        </div>
      )}
    </div>
  );
}

function KenarOge({ etiket, ikon, say, aktif, onClick, renk = PAL.mavi, rozetRenk, girinti }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", paddingLeft: girinti ? 16 : 10, borderRadius: 9, cursor: "pointer",
      background: aktif ? `${renk}1f` : "transparent",
      border: `1px solid ${aktif ? renk + "55" : "transparent"}`, marginBottom: 2,
    }}
      onMouseEnter={(e) => { if (!aktif) e.currentTarget.style.background = PAL.surface; }}
      onMouseLeave={(e) => { if (!aktif) e.currentTarget.style.background = "transparent"; }}>
      <span style={{ width: 20, textAlign: "center" }}>{ikon}</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: aktif ? 700 : 500, color: aktif ? PAL.metin : PAL.soluk }}>{etiket}</span>
      {rozetRenk && say ? (
        <span style={{ fontSize: 11, fontWeight: 800, color: "#08121A", background: rozetRenk, borderRadius: 999, padding: "1px 7px", minWidth: 18, textAlign: "center" }}>{say}</span>
      ) : (
        <span style={{ fontSize: 12, color: PAL.soluk2, fontVariantNumeric: "tabular-nums" }}>{say ?? ""}</span>
      )}
    </div>
  );
}

function DurumSuzgec({ durum, etiket, aktif, onClick }) {
  const r = durum ? durumRenk(durum) : PAL.soluk;
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 8, cursor: "pointer",
      fontSize: 13, color: aktif ? PAL.metin : PAL.soluk, background: aktif ? PAL.surface : "transparent", marginBottom: 1,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: r }} />
      {etiket}
    </div>
  );
}

function Liste({ sonuclar, yukleniyor, tipMeta, q, baslik, yeniEtiket, onDetay, onYeni }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>{baslik}</h2>
        <span style={{ color: PAL.soluk2, fontSize: 13 }}>{sonuclar.length} kayıt{q ? ` · "${q}"` : ""}</span>
        {yukleniyor && <span style={{ color: PAL.teal, fontSize: 12 }}>arıyor…</span>}
        <div style={{ flex: 1 }} />
        {yeniEtiket && <Buton birincil onClick={onYeni}>+ Yeni {yeniEtiket}</Buton>}
      </div>

      {!yukleniyor && sonuclar.length === 0 && (
        <Panel style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🗂️</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{q ? "Eşleşen kayıt yok." : "Henüz kayıt yok."}</div>
          <div style={{ color: PAL.soluk2, fontSize: 13, margin: "6px 0 16px" }}>
            {q ? "Farklı bir kelime deneyin." : "İlk kaydı ekleyerek başlayın."}
          </div>
          <Buton birincil onClick={onYeni}>+ Yeni {yeniEtiket || "Kayıt"}</Buton>
        </Panel>
      )}

      <div style={{ display: "grid", gap: 9 }}>
        {sonuclar.map((k) => <Satir key={k.id} k={k} tipMeta={tipMeta} onClick={() => onDetay(k.id)} />)}
      </div>
    </div>
  );
}

function Satir({ k, tipMeta, onClick }) {
  const renk = TIP_RENK[k.tip] || PAL.mavi;
  // Tipe ozel kolonlar (yoksa ilk birkac veri alani)
  const sablon = LISTE_KOLON[k.tip];
  let kolonlar;
  if (sablon) {
    kolonlar = sablon.map((c) => {
      const v = c.f ? c.f(k) : k.veri?.[c.v];
      return (v || v === 0) ? { et: c.et, v: String(v) } : null;
    }).filter(Boolean);
  } else {
    kolonlar = Object.entries(k.veri || {}).filter(([kod, v]) => v !== "" && v != null && kod !== "musteri_id" && kod !== "kaynak")
      .slice(0, 3).map(([, v]) => ({ v: String(v) }));
  }
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 14, padding: "12px 15px", borderRadius: 12, cursor: "pointer",
      background: PAL.surface, border: `1px solid ${PAL.cizgi}`, borderLeft: `3px solid ${renk}`,
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = PAL.surface2}
      onMouseLeave={(e) => e.currentTarget.style.background = PAL.surface}>
      <span style={{ fontSize: 20 }}>{tipMeta[k.tip]?.ikon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.baslik}</div>
        <div style={{ display: "flex", gap: 12, marginTop: 3, fontSize: 12.5, color: PAL.soluk2, flexWrap: "wrap" }}>
          {kolonlar.map((c, i) => <span key={i}>{c.et ? <span style={{ color: PAL.soluk2 }}>{c.et} </span> : null}<span style={{ color: PAL.soluk }}>{c.v}</span></span>)}
          {(k.etiketler || []).slice(0, 3).map((e) => <span key={e} style={{ color: PAL.soluk2 }}>#{e}</span>)}
        </div>
      </div>
      <DurumRozet durum={k.durum} />
      <span style={{ fontSize: 11.5, color: PAL.soluk2, minWidth: 66, textAlign: "right" }}>{gunFmt(k.guncelleme)}</span>
    </div>
  );
}
