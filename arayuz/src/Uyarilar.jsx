// Uyarilar.jsx — bitis uyarilari panosu (garanti / lisans / sozlesme / alan adi / SSL).
// Tamamen jenerik: /api/uyarilar ne donerse tipin ikonu + kategorisiyle cizer.
import React, { useEffect, useState } from "react";
import { PAL, TIP_RENK, gunFmt } from "./tema.js";
import { api } from "./api.js";
import { Panel, Eyebrow, Rozet, TipRozet, Buton, Yukleniyor } from "./ui.jsx";

const ESIKLER = [30, 45, 60, 90];

export default function Uyarilar({ tipMeta, onGit }) {
  const [gun, setGun] = useState(45);
  const [veri, setVeri] = useState(null);

  useEffect(() => { setVeri(null); api.uyarilar(gun).then(setVeri).catch(() => setVeri({ gecmis: [], yakin: [] })); }, [gun]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>🔔 Bitiş Uyarıları</h2>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: PAL.soluk2 }}>Eşik:</span>
        {ESIKLER.map((e) => (
          <button key={e} onClick={() => setGun(e)} style={{
            padding: "5px 11px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
            color: gun === e ? "#06231F" : PAL.soluk, background: gun === e ? PAL.teal : "transparent",
            border: `1px solid ${gun === e ? PAL.teal : PAL.cizgi2}`,
          }}>{e} gün</button>
        ))}
      </div>

      {!veri ? <Yukleniyor /> : (
        <>
          <Grup baslik="Süresi geçmiş" renk={PAL.rose} kayitlar={veri.gecmis} tipMeta={tipMeta} onGit={onGit} bos="Süresi geçmiş kayıt yok." />
          <div style={{ height: 16 }} />
          <Grup baslik={`Yaklaşan (${gun} gün içinde)`} renk={PAL.gold} kayitlar={veri.yakin} tipMeta={tipMeta} onGit={onGit} bos="Yaklaşan bitiş yok." />
        </>
      )}
    </div>
  );
}

function Grup({ baslik, renk, kayitlar, tipMeta, onGit, bos }) {
  return (
    <Panel style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: renk }} />
        <Eyebrow>{baslik} · {kayitlar.length}</Eyebrow>
      </div>
      {kayitlar.length === 0
        ? <div style={{ color: PAL.soluk2, fontSize: 13 }}>{bos}</div>
        : kayitlar.map((k) => (
          <div key={`${k.tip}-${k.id}`} onClick={() => onGit(k.id)} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: `1px solid ${PAL.cizgi}`, cursor: "pointer",
          }}>
            <span style={{ fontSize: 18 }}>{tipMeta[k.tip]?.ikon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.baslik}</div>
              <div style={{ fontSize: 12, color: PAL.soluk2 }}>{k.kategori} bitişi: {gunFmt(k.tarih)}{k.atanan ? ` · 👤 ${k.atanan}` : ""}</div>
            </div>
            <Rozet renk={renk} dolu={k.kalanGun < 0}>
              {k.kalanGun < 0 ? `${-k.kalanGun} gün geçti` : `${k.kalanGun} gün kaldı`}
            </Rozet>
          </div>
        ))}
    </Panel>
  );
}
