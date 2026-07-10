// KayitForm.jsx — tipe gore otomatik cizilen ekleme/duzenleme formu.
import React, { useEffect, useState } from "react";
import { PAL } from "./tema.js";
import { api } from "./api.js";
import { Panel, Eyebrow, Buton, AlanGirdi, girdiStil, Yukleniyor, Rozet } from "./ui.jsx";
import PersonelSec from "./PersonelSec.jsx";
import { formBolumleri } from "./modul.js";

const ONCELIKLER = ["Düşük", "Orta", "Yüksek", "Kritik"];

export default function KayitForm({ tip, tipMeta, mevcut, zimmetlenebilir = [], onKaydet, onIptal }) {
  const meta = tipMeta[tip];
  const fm = meta?.form || { baslikEtiket: "Başlık", baslikOrnek: "", oncelik: false, konum: false };
  const [alanlar, setAlanlar] = useState(null);
  const [f, setF] = useState(() => ({
    baslik: mevcut?.baslik || "",
    durum: mevcut?.durum || meta?.varsayilanDurum || "",
    oncelik: mevcut?.oncelik || "",
    atanan: mevcut?.atanan || "",
    konum: mevcut?.konum || "",
    etiketler: (mevcut?.etiketler || []).join(", "),
    veri: { ...(mevcut?.veri || {}) },
  }));
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState("");
  const [zimmetPersonel, setZimmetPersonel] = useState(null); // yeni kayitta ilk zimmet (opsiyonel)
  const zimmetlenebilirTip = !mevcut && zimmetlenebilir.includes(tip);

  useEffect(() => { api.alanlar(tip).then(setAlanlar).catch((e) => setHata(e.message)); }, [tip]);

  const setVeri = (kod, v) => setF((s) => ({ ...s, veri: { ...s.veri, [kod]: v } }));

  async function kaydet() {
    if (!f.baslik.trim()) { setHata("Başlık zorunlu."); return; }
    setKaydediliyor(true); setHata("");
    const yuk = {
      tip,
      baslik: f.baslik.trim(),
      durum: f.durum || null,
      etiketler: f.etiketler.split(",").map((s) => s.trim()).filter(Boolean),
      veri: f.veri,
    };
    // Sadece bu tipte GORUNEN cekirdek alanlar gonderilir (gizli alan ezilmez).
    if (fm.oncelik) yuk.oncelik = f.oncelik || null;
    if (fm.konum) yuk.konum = f.konum.trim() || null;
    try {
      const sonuc = mevcut ? await api.guncelle(mevcut.id, yuk) : await api.ekle(yuk);
      if (!mevcut && zimmetPersonel) {
        try { await api.zimmetAta(sonuc.id, zimmetPersonel.id); } catch { /* zimmet hatasi kaydi engellemesin */ }
      }
      onKaydet(sonuc);
    } catch (e) { setHata(e.message); setKaydediliyor(false); }
  }

  if (hata && !alanlar) return <div style={{ color: PAL.rose, padding: 20 }}>{hata}</div>;
  if (!alanlar) return <Yukleniyor />;

  const Etiketli = ({ baslik, zorunlu, children }) => (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, color: PAL.soluk, marginBottom: 5, fontWeight: 600 }}>
        {baslik} {zorunlu && <span style={{ color: PAL.rose }}>*</span>}
      </div>
      {children}
    </label>
  );

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <Eyebrow>{meta?.ikon} {meta?.etiket} · {mevcut ? "Düzenle" : "Yeni kayıt"}</Eyebrow>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{mevcut ? f.baslik || "Kayıt" : `Yeni ${meta?.etiket}`}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Buton onClick={onIptal}>İptal</Buton>
          <Buton birincil onClick={kaydet} disabled={kaydediliyor}>{kaydediliyor ? "Kaydediliyor…" : "Kaydet"}</Buton>
        </div>
      </div>

      {hata && <div style={{ color: PAL.rose, marginBottom: 12, fontSize: 13 }}>{hata}</div>}

      <Panel style={{ padding: 20, marginBottom: 16 }}>
        <Etiketli baslik={fm.baslikEtiket} zorunlu>
          <input style={girdiStil} value={f.baslik} autoFocus
            onChange={(e) => setF((s) => ({ ...s, baslik: e.target.value }))}
            placeholder={fm.baslikOrnek} />
        </Etiketli>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${1 + (fm.oncelik ? 1 : 0) + (fm.konum ? 1 : 0)}, 1fr)`, gap: 14 }}>
          <Etiketli baslik="Durum">
            <select style={girdiStil} value={f.durum} onChange={(e) => setF((s) => ({ ...s, durum: e.target.value }))}>
              <option value="">—</option>
              {(meta?.durumlar || []).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Etiketli>
          {fm.oncelik && (
            <Etiketli baslik="Öncelik">
              <select style={girdiStil} value={f.oncelik} onChange={(e) => setF((s) => ({ ...s, oncelik: e.target.value }))}>
                <option value="">—</option>
                {ONCELIKLER.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Etiketli>
          )}
          {fm.konum && (
            <Etiketli baslik="Konum">
              <input style={girdiStil} value={f.konum} onChange={(e) => setF((s) => ({ ...s, konum: e.target.value }))} placeholder="Örn: Merkez / 3. Kat" />
            </Etiketli>
          )}
        </div>
        <Etiketli baslik="Etiketler (virgülle)">
          <input style={girdiStil} value={f.etiketler} onChange={(e) => setF((s) => ({ ...s, etiketler: e.target.value }))} placeholder="muhasebe, garanti-devam" />
        </Etiketli>

        {zimmetlenebilirTip && (
          <Etiketli baslik="Zimmetli Personel (opsiyonel)">
            {zimmetPersonel ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Rozet renk={PAL.mavi}>🧑‍💼 {zimmetPersonel.baslik}</Rozet>
                <button type="button" onClick={() => setZimmetPersonel(null)} style={{ background: "none", border: "none", color: PAL.soluk2, cursor: "pointer", fontSize: 13 }}>değiştir/kaldır</button>
              </div>
            ) : (
              <>
                <PersonelSec onSec={setZimmetPersonel} placeholder="Personel ara (boş bırakılabilir)…" />
                <div style={{ fontSize: 11.5, color: PAL.soluk2, marginTop: 4 }}>Kimseye verilmeyecekse boş bırakın (ör. switch, AP).</div>
              </>
            )}
          </Etiketli>
        )}
      </Panel>

      {formBolumleri(tip, alanlar, meta?.etiket).map((bolum) => (
        <Panel key={bolum.baslik} style={{ padding: 20, marginBottom: 16 }}>
          <Eyebrow>{bolum.baslik}</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 6 }}>
            {bolum.alanlar.map((a) => (
              <div key={a.kod} style={{ gridColumn: (a.veri_tipi === "uzunmetin") ? "1 / -1" : "auto" }}>
                <Etiketli baslik={a.etiket + (a.iliski_tip ? "  ↔" : "")} zorunlu={a.zorunlu}>
                  <AlanGirdi tanim={a} deger={f.veri[a.kod]} onChange={(v) => setVeri(a.kod, v)} />
                </Etiketli>
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
