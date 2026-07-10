// PersonelSec.jsx — personel arayip secen kucuk bilesen (zimmet icin).
import React, { useState } from "react";
import { PAL } from "./tema.js";
import { api } from "./api.js";
import { girdiStil } from "./ui.jsx";

export default function PersonelSec({ onSec, placeholder = "Personel ara…" }) {
  const [q, setQ] = useState("");
  const [sonuc, setSonuc] = useState([]);

  async function ara(v) {
    setQ(v);
    if (v.trim().length < 2) { setSonuc([]); return; }
    try { setSonuc(await api.ara({ q: v, tip: "personel", limit: 6 })); } catch { setSonuc([]); }
  }
  return (
    <div>
      <input style={girdiStil} value={q} placeholder={placeholder} onChange={(e) => ara(e.target.value)} autoFocus />
      {sonuc.length > 0 && (
        <div style={{ marginTop: 4, background: PAL.bg2, border: `1px solid ${PAL.cizgi}`, borderRadius: 8, overflow: "hidden" }}>
          {sonuc.map((s) => (
            <div key={s.id} onClick={() => { onSec(s); setQ(""); setSonuc([]); }}
              style={{ padding: "7px 9px", cursor: "pointer", fontSize: 13 }}
              onMouseEnter={(e) => e.currentTarget.style.background = PAL.surface2}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              🧑‍💼 {s.baslik}{s.veri?.departman ? ` · ${s.veri.departman}` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
