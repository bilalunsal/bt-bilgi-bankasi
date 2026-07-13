// Yetki modeli — MODÜL GRUBU bazında (sol menüyle birebir), yalnız "erişir/erişemez".
// Roller: admin | it | personel.
//   admin    → her modül (Yönetim dahil).            SABİT.
//   it       → Yönetim hariç tüm modüller.           SABİT.
//   personel → admin'in seçtiği içerik modülleri.    YAPILANDIRILABİLİR (ayarlar.izin_personel = JSON dizi).
// İzin verisi DB'de (ayarlar) durur → güncellemede korunur/silinmez.
//
// Not: "genel" (pano/tümü/uyarılar) tüm rollerde AÇIK (uygulama kabuğu); "yönetim" YALNIZ admin.
// Yapılandırılabilir olanlar yalnız İÇERİK modülleridir (envanter, alanssl, dokuman, destek).

export const MODULLER = [
  { anahtar: "genel",    baslik: "Genel",            tipler: [] },
  { anahtar: "envanter", baslik: "Envanter",         tipler: ["donanim", "yazilim", "lisans", "ag"] },
  { anahtar: "alanssl",  baslik: "Alan Adı & SSL",   tipler: ["alan_adi", "ssl"] },
  { anahtar: "dokuman",  baslik: "Dokümantasyon",    tipler: ["sistem", "surec", "revizyon", "bilgi"] },
  { anahtar: "destek",   baslik: "Kişiler & Destek", tipler: ["personel", "talep", "tedarikci", "dis_kisi", "sozlesme"] },
  { anahtar: "yonetim",  baslik: "Yönetim",          tipler: [] },
];

export const ROLLER = ["admin", "it", "personel"];
export function rolGecerli(r) { return ROLLER.includes(r) ? r : "personel"; }

const ANAHTARLAR = MODULLER.map((m) => m.anahtar);
// Personel için açılıp kapatılabilen modüller (genel her zaman açık, yönetim yalnız admin).
export const ICERIK_MODULLERI = ANAHTARLAR.filter((k) => k !== "genel" && k !== "yonetim");

// Bir kayıt tipinin ait olduğu modül anahtarı (yoksa null → kısıtlama uygulanmaz).
export function tipModulu(tip) {
  const m = MODULLER.find((x) => x.tipler.includes(tip));
  return m ? m.anahtar : null;
}

// ayarlar.izin_personel JSON'unu güvenle diziye çevir (yalnız geçerli içerik anahtarları). null → varsayılan.
export function personelIzinCoz(json) {
  if (!json) return null;
  try {
    const a = JSON.parse(json);
    return Array.isArray(a) ? a.filter((k) => ICERIK_MODULLERI.includes(k)) : null;
  } catch { return null; }
}

// Rolün erişebildiği modül anahtarları (Set). personelIzin: dizi | null (null → tüm içerik modülleri).
export function izinliModuller(rol, personelIzin) {
  if (rol === "admin") return new Set(ANAHTARLAR);
  const s = new Set(["genel"]); // genel her rolde açık
  if (rol === "it") { ICERIK_MODULLERI.forEach((k) => s.add(k)); return s; }
  const liste = Array.isArray(personelIzin)
    ? personelIzin.filter((k) => ICERIK_MODULLERI.includes(k))
    : ICERIK_MODULLERI; // varsayılan: hepsi (mevcut kurulumda erişim daralmasın)
  liste.forEach((k) => s.add(k));
  return s;
}

// Erişilebilir modül kümesinden erişilebilir KAYIT TİPLERİ kümesini üret.
export function izinliTipler(moduller) {
  const s = new Set();
  for (const m of MODULLER) if (moduller.has(m.anahtar)) for (const t of m.tipler) s.add(t);
  return s;
}
