// KayitDetay.jsx — tek kaydin tam gorunumu: alanlar + yorumlar + iliskiler + gecmis.
import React, { useEffect, useState } from "react";
import { PAL, TIP_RENK, tarihFmt, gunFmt } from "./tema.js";
import { api, dosyaOku, boyutFmt } from "./api.js";
import { md } from "./md.js";
import PersonelSec from "./PersonelSec.jsx";
import { Panel, Eyebrow, Rozet, DurumRozet, TipRozet, Etiket, Buton, girdiStil, Yukleniyor } from "./ui.jsx";

export default function KayitDetay({ id, tipMeta, iliskiTurleri, onDuzenle, onGeri, onGit }) {
  const [k, setK] = useState(null);
  const [alanlar, setAlanlar] = useState([]);
  const [yeniYorum, setYeniYorum] = useState("");
  const [hata, setHata] = useState("");

  async function yukle() {
    setHata("");
    try {
      const kayit = await api.kayit(id);
      setK(kayit);
      setAlanlar(await api.alanlar(kayit.tip));
    } catch (e) { setHata(e.message); }
  }
  useEffect(() => { yukle(); }, [id]);

  if (hata) return <div style={{ color: PAL.rose, padding: 20 }}>{hata} <Buton onClick={onGeri}>Geri</Buton></div>;
  if (!k) return <Yukleniyor />;

  const renk = TIP_RENK[k.tip] || PAL.mavi;

  async function yorumGonder() {
    if (!yeniYorum.trim()) return;
    await api.yorumEkle(k.id, { metin: yeniYorum.trim() });
    setYeniYorum(""); yukle();
  }
  async function sil() {
    if (!confirm(`"${k.baslik}" kaydı silinsin mi? Bu geri alınamaz.`)) return;
    await api.sil(k.id); onGeri();
  }

  const alanEtiket = (kod) => alanlar.find((a) => a.kod === kod)?.etiket || kod;
  const alanTip = (kod) => alanlar.find((a) => a.kod === kod)?.veri_tipi;
  const veriGirdileri = Object.entries(k.veri || {}).filter(([kod, v]) => v !== "" && v != null && kod !== "musteri_id" && kod !== "kaynak");
  const kisaAlanlar = veriGirdileri.filter(([kod]) => alanTip(kod) !== "uzunmetin");
  const uzunAlanlar = veriGirdileri.filter(([kod]) => alanTip(kod) === "uzunmetin");

  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      {/* ust serit */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <Buton onClick={onGeri}>← Geri</Buton>
        <TipRozet tip={k.tip} tipMeta={tipMeta} />
        <span style={{ color: PAL.soluk2, fontSize: 12.5 }}>#{k.id}</span>
        <div style={{ flex: 1 }} />
        <Buton onClick={() => onDuzenle(k)}>✎ Düzenle</Buton>
        <Buton tehlike onClick={sil}>Sil</Buton>
      </div>

      <div style={{ borderLeft: `3px solid ${renk}`, paddingLeft: 14, marginBottom: 18 }}>
        <div style={{ fontSize: 25, fontWeight: 800, lineHeight: 1.2 }}>{k.baslik}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          <DurumRozet durum={k.durum} />
          {k.oncelik && <Rozet renk={PAL.gold}>⚑ {k.oncelik}</Rozet>}
          {k.atanan && <Rozet renk={PAL.mavi}>👤 {k.atanan}</Rozet>}
          {k.konum && <Rozet renk={PAL.soluk2}>📍 {k.konum}</Rozet>}
          {(k.etiketler || []).map((e) => <Etiket key={e}>{e}</Etiket>)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
        {/* SOL: (personel) zimmetli varliklar + alanlar + yorumlar */}
        <div>
          {k.personelZimmet && <div style={{ marginBottom: 16 }}><PersonelVarliklar veri={k.personelZimmet} tipMeta={tipMeta} onGit={onGit} /></div>}
          <Panel style={{ padding: 18, marginBottom: 16 }}>
            <Eyebrow>Detaylar</Eyebrow>
            {veriGirdileri.length === 0 && <div style={{ color: PAL.soluk2, fontSize: 13 }}>Doldurulmuş alan yok.</div>}
            {kisaAlanlar.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginTop: 6 }}>
                {kisaAlanlar.map(([kod, v]) => (
                  <div key={kod}>
                    <div style={{ fontSize: 11.5, color: PAL.soluk2, textTransform: "uppercase", letterSpacing: 0.5 }}>{alanEtiket(kod)}</div>
                    <div style={{ fontSize: 14, marginTop: 2, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{String(v)}</div>
                  </div>
                ))}
              </div>
            )}
            {uzunAlanlar.map(([kod, v]) => (
              <div key={kod} style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11.5, color: PAL.soluk2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{alanEtiket(kod)}</div>
                <div style={{ fontSize: 14, lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: md(String(v)) }} />
              </div>
            ))}
          </Panel>

          <Panel style={{ padding: 18 }}>
            <Eyebrow>Yorumlar ({k.yorumlar?.length || 0})</Eyebrow>
            <div style={{ display: "flex", gap: 8, margin: "8px 0 14px" }}>
              <input style={girdiStil} value={yeniYorum} placeholder="Yorum ekle…"
                onChange={(e) => setYeniYorum(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && yorumGonder()} />
              <Buton birincil onClick={yorumGonder}>Ekle</Buton>
            </div>
            {(k.yorumlar || []).map((y) => (
              <div key={y.id} style={{ padding: "8px 0", borderTop: `1px solid ${PAL.cizgi}` }}>
                <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{y.metin}</div>
                <div style={{ fontSize: 11, color: PAL.soluk2, marginTop: 3 }}>{y.yazar || "—"} · {tarihFmt(y.zaman)}</div>
              </div>
            ))}
          </Panel>
        </div>

        {/* SAG: zimmet + iliskiler + ekler + gecmis */}
        <div>
          {k.zimmet && <div style={{ marginBottom: 16 }}><ZimmetPanel k={k} onGit={onGit} onDegisti={yukle} /></div>}
          <IliskiPanel k={k} tipMeta={tipMeta} iliskiTurleri={iliskiTurleri} onGit={onGit} onDegisti={yukle} />
          <div style={{ marginTop: 16 }}>
            <EkPanel k={k} onDegisti={yukle} />
          </div>
          <Panel style={{ padding: 18, marginTop: 16 }}>
            <Eyebrow>Geçmiş</Eyebrow>
            <div style={{ fontSize: 12, color: PAL.soluk2, marginBottom: 8 }}>
              Oluşturma {tarihFmt(k.olusturma)} · Güncelleme {tarihFmt(k.guncelleme)}
            </div>
            {(k.gecmis || []).slice(0, 15).map((g) => (
              <div key={g.id} style={{ fontSize: 12.5, padding: "5px 0", borderTop: `1px solid ${PAL.cizgi}`, color: PAL.soluk }}>
                <span style={{ color: PAL.teal }}>{g.eylem}</span>
                {g.alan ? ` · ${g.alan}` : ""} <span style={{ color: PAL.soluk2 }}>— {tarihFmt(g.zaman)}</span>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ZimmetPanel({ k, onGit, onDegisti }) {
  const [sec, setSec] = useState(false);
  const aktif = k.zimmet?.aktif;
  const gecmis = k.zimmet?.gecmis || [];

  async function ata(p) { await api.zimmetAta(k.id, p.id); setSec(false); onDegisti(); }
  async function iade() { if (!confirm(`${aktif.personel_ad} zimmeti iade edilsin mi? (Cihaz zimmetsiz kalır)`)) return; await api.zimmetIade(k.id); onDegisti(); }

  return (
    <Panel style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Eyebrow>Zimmet</Eyebrow>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setSec((s) => !s)} style={{ background: "none", border: "none", color: PAL.teal, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            {sec ? "kapat" : (aktif ? "değiştir" : "+ zimmetle")}
          </button>
          {aktif && <button onClick={iade} style={{ background: "none", border: "none", color: PAL.rose, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>iade</button>}
        </div>
      </div>

      {aktif ? (
        <div onClick={() => onGit(aktif.personel_id)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 4 }}>
          <span style={{ fontSize: 18 }}>🧑‍💼</span>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>{aktif.personel_ad}</div>
            <div style={{ fontSize: 11.5, color: PAL.soluk2 }}>{gunFmt(aktif.baslangic)} tarihinden beri zimmetli</div>
          </div>
        </div>
      ) : (!sec && <div style={{ color: PAL.soluk2, fontSize: 13 }}>Zimmetsiz — kimseye verilmemiş.</div>)}

      {sec && <div style={{ marginTop: 10 }}><PersonelSec onSec={ata} placeholder={aktif ? "Yeni personel ara…" : "Personel ara…"} /></div>}

      {gecmis.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: PAL.soluk2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Zimmet geçmişi</div>
          {gecmis.map((z) => (
            <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderTop: `1px solid ${PAL.cizgi}`, fontSize: 12.5 }}>
              <span onClick={() => onGit(z.personel_id)} style={{ flex: 1, cursor: "pointer", color: z.bitis ? PAL.soluk : PAL.metin }}>🧑‍💼 {z.personel_ad}</span>
              <span style={{ color: PAL.soluk2 }}>{gunFmt(z.baslangic)} – {z.bitis ? gunFmt(z.bitis) : "şu an"}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function PersonelVarliklar({ veri, tipMeta, onGit }) {
  const aktif = veri.aktif || [], gecmis = veri.gecmis || [];
  const Satir = (z, gecmisMi) => (
    <div key={z.id} onClick={() => onGit(z.varlik_id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: `1px solid ${PAL.cizgi}`, cursor: "pointer" }}>
      <span style={{ fontSize: 16 }}>{tipMeta[z.varlik_tip]?.ikon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: gecmisMi ? PAL.soluk : PAL.metin }}>{z.varlik_ad}</div>
        <div style={{ fontSize: 11.5, color: PAL.soluk2 }}>{tipMeta[z.varlik_tip]?.etiket} · {gunFmt(z.baslangic)}{gecmisMi ? ` – ${gunFmt(z.bitis)}` : " → devam"}</div>
      </div>
    </div>
  );
  return (
    <Panel style={{ padding: 18 }}>
      <Eyebrow>Zimmetli Varlıklar · {aktif.length} aktif</Eyebrow>
      {aktif.length === 0 && <div style={{ color: PAL.soluk2, fontSize: 13 }}>Bu personele zimmetli aktif varlık yok.</div>}
      {aktif.map((z) => Satir(z, false))}
      {gecmis.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: PAL.soluk2, textTransform: "uppercase", letterSpacing: 0.5 }}>Geçmiş zimmetler</div>
          {gecmis.map((z) => Satir(z, true))}
        </div>
      )}
    </Panel>
  );
}

function EkPanel({ k, onDegisti }) {
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState("");
  const girisRef = React.useRef(null);

  async function yukle(dosyalar) {
    setHata(""); setYukleniyor(true);
    try {
      for (const f of dosyalar) {
        const veri_b64 = await dosyaOku(f);
        await api.ekEkle(k.id, { dosya_ad: f.name, tur: f.type, veri_b64 });
      }
      onDegisti();
    } catch (e) { setHata(e.message); }
    finally { setYukleniyor(false); if (girisRef.current) girisRef.current.value = ""; }
  }
  async function sil(ekId) {
    if (!confirm("Ek silinsin mi?")) return;
    await api.ekSil(ekId); onDegisti();
  }

  return (
    <Panel style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Eyebrow>Ekler ({k.ekler?.length || 0})</Eyebrow>
        <button onClick={() => girisRef.current?.click()} disabled={yukleniyor}
          style={{ background: "none", border: "none", color: PAL.teal, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
          {yukleniyor ? "yükleniyor…" : "+ dosya"}
        </button>
        <input ref={girisRef} type="file" multiple style={{ display: "none" }}
          onChange={(e) => e.target.files.length && yukle([...e.target.files])} />
      </div>
      {hata && <div style={{ color: PAL.rose, fontSize: 12.5, margin: "6px 0" }}>{hata}</div>}

      {(k.ekler || []).length === 0 && !yukleniyor && (
        <div style={{ color: PAL.soluk2, fontSize: 13 }}>Ek yok. Fatura, garanti, ekran görüntüsü ekleyebilirsiniz.</div>
      )}
      {(k.ekler || []).map((e) => (
        <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: `1px solid ${PAL.cizgi}` }}>
          <span style={{ fontSize: 16 }}>📎</span>
          <a href={api.ekUrl(e.id)} target="_blank" rel="noreferrer" download
            style={{ flex: 1, fontSize: 13, color: PAL.metin, textDecoration: "none", wordBreak: "break-word" }}>
            {e.dosya_ad}
          </a>
          <span style={{ fontSize: 11.5, color: PAL.soluk2 }}>{boyutFmt(e.boyut)}</span>
          <button title="İçeriğe gömme kodunu kopyala (görsel)"
            onClick={() => { const kod = `![${e.dosya_ad}](${api.ekUrl(e.id)})`; navigator.clipboard?.writeText(kod); alert("İçeriğe eklemek için kopyalandı:\n" + kod); }}
            style={{ background: "none", border: "none", color: PAL.soluk2, cursor: "pointer", fontSize: 14 }}>📋</button>
          <button onClick={() => sil(e.id)} style={{ background: "none", border: "none", color: PAL.soluk2, cursor: "pointer", fontSize: 15 }}>×</button>
        </div>
      ))}
    </Panel>
  );
}

function IliskiPanel({ k, tipMeta, iliskiTurleri, onGit, onDegisti }) {
  const [ekleAcik, setEkleAcik] = useState(false);
  const [q, setQ] = useState("");
  const [sonuc, setSonuc] = useState([]);
  const [tur, setTur] = useState(iliskiTurleri[0]?.kod || "ilgili");

  async function araYap(v) {
    setQ(v);
    if (v.trim().length < 2) { setSonuc([]); return; }
    const r = await api.ara({ q: v, limit: 6 });
    setSonuc(r.filter((x) => x.id !== k.id));
  }
  async function bagla(hedef) {
    await api.iliskiEkle(k.id, { hedef_id: hedef.id, tur });
    setEkleAcik(false); setQ(""); setSonuc([]); onDegisti();
  }
  async function kaldir(id) { await api.iliskiSil(id); onDegisti(); }

  const turEtiket = (kod, yon) => {
    const t = iliskiTurleri.find((x) => x.kod === kod);
    return yon === "geri" ? (t?.ters || kod) : (t?.etiket || kod);
  };

  return (
    <Panel style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Eyebrow>İlişkiler ({k.iliskiler?.length || 0})</Eyebrow>
        <button onClick={() => setEkleAcik((s) => !s)} style={{ background: "none", border: "none", color: PAL.teal, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
          {ekleAcik ? "kapat" : "+ bağla"}
        </button>
      </div>

      {ekleAcik && (
        <div style={{ margin: "8px 0 12px", padding: 10, background: PAL.bg2, borderRadius: 10, border: `1px solid ${PAL.cizgi}` }}>
          <select style={{ ...girdiStil, marginBottom: 8 }} value={tur} onChange={(e) => setTur(e.target.value)}>
            {iliskiTurleri.map((t) => <option key={t.kod} value={t.kod}>{t.etiket}</option>)}
          </select>
          <input style={girdiStil} value={q} placeholder="Kayıt ara…" onChange={(e) => araYap(e.target.value)} autoFocus />
          <div style={{ marginTop: 6 }}>
            {sonuc.map((s) => (
              <div key={s.id} onClick={() => bagla(s)} style={{ padding: "6px 8px", borderRadius: 7, cursor: "pointer", fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}
                onMouseEnter={(e) => e.currentTarget.style.background = PAL.surface2}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <span>{tipMeta[s.tip]?.ikon}</span> {s.baslik}
              </div>
            ))}
          </div>
        </div>
      )}

      {(k.iliskiler || []).length === 0 && !ekleAcik && (
        <div style={{ color: PAL.soluk2, fontSize: 13 }}>Bağlı kayıt yok.</div>
      )}
      {(k.iliskiler || []).map((i) => (
        <div key={i.id + i.yon} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", borderTop: `1px solid ${PAL.cizgi}` }}>
          <span style={{ fontSize: 11, color: PAL.soluk2, minWidth: 78 }}>{turEtiket(i.tur, i.yon)}</span>
          <span onClick={() => onGit(i.hedef_id)} style={{ flex: 1, fontSize: 13, cursor: "pointer", color: PAL.metin }}>
            {tipMeta[i.tip]?.ikon} {i.baslik}
          </span>
          {i.yon === "ileri" && (
            <button onClick={() => kaldir(i.id)} style={{ background: "none", border: "none", color: PAL.soluk2, cursor: "pointer", fontSize: 15 }}>×</button>
          )}
        </div>
      ))}
    </Panel>
  );
}
