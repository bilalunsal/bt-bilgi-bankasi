// Dashboard.jsx — Pano: KPI tile'lari + kayit tipi/talep durum barlari + IT takvimi + disa aktar.
// Grafik ilkeleri: ince marklar, yuvarlak uc, dogrudan deger etiketi, recessive eksen; mevcut PAL/TIP_RENK.
import React, { useEffect, useMemo, useState } from "react";
import { PAL, TIP_RENK, durumRenk, gunFmt } from "./tema.js";
import { api } from "./api.js";
import { Panel, Eyebrow, Yukleniyor, Buton } from "./ui.jsx";

const AY_ADI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const GUN_KISA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const bugunISO = () => new Date().toISOString().slice(0, 10);

export default function Dashboard({ tipMeta, onGit, onTip }) {
  const [ist, setIst] = useState(null);
  const [uy, setUy] = useState(null);
  const [tak, setTak] = useState(null);

  useEffect(() => {
    api.istatistik().then(setIst).catch(() => setIst({ toplam: 0, tipBazli: [], durumBazli: [] }));
    api.uyarilar(45).then(setUy).catch(() => setUy({ gecmis: [], yakin: [], talepler: [] }));
    api.takvim().then((d) => setTak(d.olaylar || [])).catch(() => setTak([]));
  }, []);

  const etiket = (kod) => tipMeta?.[kod]?.etiket || kod;
  const ikon = (kod) => tipMeta?.[kod]?.ikon || "•";

  const tipBar = useMemo(() => (ist?.tipBazli || [])
    .map((r) => ({ kod: r.tip, etiket: `${ikon(r.tip)} ${etiket(r.tip)}`, deger: Number(r.n), renk: TIP_RENK[r.tip] || PAL.mavi }))
    .sort((a, b) => b.deger - a.deger), [ist, tipMeta]);

  const talepDurumBar = useMemo(() => (ist?.durumBazli || [])
    .filter((r) => r.tip === "talep")
    .map((r) => ({ etiket: r.durum, deger: Number(r.n), renk: durumRenk(r.durum) }))
    .sort((a, b) => b.deger - a.deger), [ist]);

  if (!ist || !uy || !tak) return <Yukleniyor metin="Pano hazırlanıyor…" />;

  const acikTalep = uy.talepler?.length || 0;
  const yakin = uy.yakin?.length || 0;
  const gecmis = uy.gecmis?.length || 0;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>📊 Pano</h2>
        <div style={{ flex: 1 }} />
        <DisaAktar />
      </div>

      {/* KPI tile'lari */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
        <Tile etiket="Toplam kayıt" deger={ist.toplam} renk={PAL.mavi} ikon="▦" onClick={() => onTip?.("")} />
        <Tile etiket="Açık talep" deger={acikTalep} renk={PAL.teal} ikon="📨" onClick={() => onTip?.("talep")} />
        <Tile etiket="Yaklaşan uyarı" deger={yakin} renk={PAL.gold} ikon="🔔" />
        <Tile etiket="Süresi geçmiş" deger={gecmis} renk={PAL.rose} ikon="⚠️" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14 }}>
        <Panel style={{ padding: 18 }}>
          <Eyebrow>Kayıt tipi dağılımı</Eyebrow>
          <div style={{ marginTop: 10 }}>
            <BarListe veri={tipBar} onTikla={(b) => onTip?.(b.kod)} />
          </div>
        </Panel>
        <Panel style={{ padding: 18 }}>
          <Eyebrow>Talep durumu</Eyebrow>
          <div style={{ marginTop: 10 }}>
            {talepDurumBar.length ? <BarListe veri={talepDurumBar} /> : <Bos>Talep kaydı yok.</Bos>}
          </div>
        </Panel>
      </div>

      <div style={{ height: 14 }} />
      <Panel style={{ padding: 18 }}>
        <Eyebrow>IT Takvimi — bitiş / yenileme tarihleri</Eyebrow>
        <Takvim olaylar={tak} tipMeta={tipMeta} onGit={onGit} />
      </Panel>
    </div>
  );
}

function Tile({ etiket, deger, renk, ikon, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: PAL.surface, border: `1px solid ${PAL.cizgi}`, borderRadius: 14, padding: "16px 18px",
      cursor: onClick ? "pointer" : "default", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: renk }} />
      <div style={{ fontSize: 12.5, color: PAL.soluk, fontWeight: 600 }}>{ikon} {etiket}</div>
      <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6, color: PAL.metin, lineHeight: 1 }}>{deger ?? 0}</div>
    </div>
  );
}

// Yatay bar listesi — deger max'a gore olcekli, uc etiketi dogrudan, 2px'lik zemin bosluklari satir arasi.
function BarListe({ veri, onTikla }) {
  const max = Math.max(1, ...veri.map((v) => v.deger));
  if (!veri.length) return <Bos>Veri yok.</Bos>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {veri.map((v, i) => (
        <div key={i} onClick={onTikla ? () => onTikla(v) : undefined}
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: onTikla ? "pointer" : "default" }}>
          <div style={{ width: 140, flexShrink: 0, fontSize: 13, color: PAL.soluk, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={v.etiket}>{v.etiket}</div>
          <div style={{ flex: 1, height: 14, background: PAL.bg2, borderRadius: 7, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(4, (v.deger / max) * 100)}%`, height: "100%", background: v.renk, borderRadius: 7 }} />
          </div>
          <div style={{ width: 34, textAlign: "right", fontSize: 13, fontWeight: 700, color: PAL.metin }}>{v.deger}</div>
        </div>
      ))}
    </div>
  );
}

// Ay-izgara takvim: tarihli olaylar tip renginde nokta; gune tiklaninca o gunun olaylari acilir.
function Takvim({ olaylar, tipMeta, onGit }) {
  const simdi = new Date();
  const [yil, setYil] = useState(simdi.getFullYear());
  const [ay, setAy] = useState(simdi.getMonth()); // 0-11
  const [secGun, setSecGun] = useState(null);

  const gunlere = useMemo(() => {
    const m = {};
    for (const o of olaylar) { (m[o.tarih] ||= []).push(o); }
    return m;
  }, [olaylar]);

  const iso = (g) => `${yil}-${String(ay + 1).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
  const ayGun = new Date(yil, ay + 1, 0).getDate();
  const ilkGunJs = new Date(yil, ay, 1).getDay();       // 0=Paz
  const oncekiBos = (ilkGunJs + 6) % 7;                  // Pazartesi-basli
  const hucreler = [...Array(oncekiBos).fill(null), ...Array.from({ length: ayGun }, (_, i) => i + 1)];
  const bugun = bugunISO();

  function ayDegis(d) {
    let m = ay + d, y = yil;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setAy(m); setYil(y); setSecGun(null);
  }
  const secOlaylar = secGun ? (gunlere[secGun] || []) : [];

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button onClick={() => ayDegis(-1)} style={okBtn}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 700, minWidth: 150, textAlign: "center" }}>{AY_ADI[ay]} {yil}</div>
        <button onClick={() => ayDegis(1)} style={okBtn}>›</button>
        <button onClick={() => { setYil(simdi.getFullYear()); setAy(simdi.getMonth()); setSecGun(null); }} style={{ ...okBtn, width: "auto", padding: "4px 10px", fontSize: 12.5 }}>Bugün</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {GUN_KISA.map((g) => <div key={g} style={{ textAlign: "center", fontSize: 11, color: PAL.soluk2, fontWeight: 700, padding: "2px 0" }}>{g}</div>)}
        {hucreler.map((g, i) => {
          if (!g) return <div key={`b${i}`} />;
          const t = iso(g);
          const olay = gunlere[t] || [];
          const buGun = t === bugun;
          return (
            <div key={t} onClick={() => olay.length && setSecGun(secGun === t ? null : t)}
              style={{
                minHeight: 56, border: `1px solid ${secGun === t ? PAL.teal : PAL.cizgi}`, borderRadius: 8, padding: "5px 6px",
                background: buGun ? PAL.surface2 : "transparent", cursor: olay.length ? "pointer" : "default",
              }}>
              <div style={{ fontSize: 12, fontWeight: buGun ? 800 : 500, color: buGun ? PAL.teal : PAL.soluk }}>{g}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                {olay.slice(0, 4).map((o, j) => (
                  <span key={j} title={`${o.baslik} (${o.kategori})`}
                    style={{ width: 7, height: 7, borderRadius: 999, background: TIP_RENK[o.tip] || PAL.mavi }} />
                ))}
                {olay.length > 4 && <span style={{ fontSize: 9, color: PAL.soluk2 }}>+{olay.length - 4}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {secGun && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${PAL.cizgi}`, paddingTop: 10 }}>
          <div style={{ fontSize: 12.5, color: PAL.soluk, marginBottom: 6 }}>{gunFmt(secGun)} · {secOlaylar.length} olay</div>
          {secOlaylar.map((o) => (
            <div key={`${o.tip}-${o.id}`} onClick={() => onGit?.(o.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${PAL.cizgi}`, cursor: "pointer",
            }}>
              <span style={{ fontSize: 16 }}>{tipMeta?.[o.tip]?.ikon || "•"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.baslik}</div>
                <div style={{ fontSize: 12, color: PAL.soluk2 }}>{o.kategori} bitişi · {o.durum}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!olaylar.length && <Bos>Takvimde tarihli kayıt yok (garanti/lisans/SSL/alan adı/sözleşme bitişleri burada görünür).</Bos>}
    </div>
  );
}

function DisaAktar() {
  function indir(format) {
    const a = document.createElement("a");
    a.href = api.disaAktarUrl({ format });
    a.download = "";
    document.body.appendChild(a); a.click(); a.remove();
  }
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Buton onClick={() => indir("csv")}>⬇ CSV</Buton>
      <Buton onClick={() => indir("json")}>⬇ JSON</Buton>
    </div>
  );
}

const Bos = ({ children }) => <div style={{ color: PAL.soluk2, fontSize: 13, padding: "6px 0" }}>{children}</div>;
const okBtn = { width: 30, height: 30, borderRadius: 8, border: `1px solid ${PAL.cizgi2}`, background: "transparent", color: PAL.metin, cursor: "pointer", fontSize: 16, lineHeight: 1 };
