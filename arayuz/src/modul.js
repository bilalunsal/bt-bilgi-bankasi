// modul.js — TIPE OZEL SUNUM yapilandirmasi (motor ayni; her modul amaca ozel gorunur).
// BOLUMLER: formda alanlar bolumlere ayrilir. LISTE_KOLON: liste satirinda gosterilecek anahtar alanlar.
// Buradaki kodlar tohum-alanlar.js'teki alan 'kod'larina karsilik gelir. Listede olmayan alanlar
// otomatik "Diğer" bolumune duser (kaybolmaz).

export const BOLUMLER = {
  donanim: [
    { baslik: "Temel Bilgiler", kodlar: ["kategori", "marka", "model", "seri_no", "envanter_no"] },
    { baslik: "Teknik", kodlar: ["mac", "ip", "cpu", "ram", "disk", "isletim_sistemi"] },
    { baslik: "Satın Alma & Garanti", kodlar: ["satin_alma", "garanti_bitis", "tedarikci", "fatura_no", "fiyat"] },
  ],
  yazilim: [
    { baslik: "Yazılım", kodlar: ["kategori", "uretici", "surum"] },
    { baslik: "Bağlantı", kodlar: ["kurulu_cihaz", "lisans_kayit"] },
  ],
  lisans: [
    { baslik: "Lisans", kodlar: ["urun", "uretici", "lisans_anahtari", "lisans_turu", "koltuk"] },
    { baslik: "Süre & Maliyet", kodlar: ["baslangic", "bitis", "maliyet", "hesap_email", "tedarikci"] },
  ],
  bilgi: [
    { baslik: "Sınıflandırma", kodlar: ["kategori", "ozet", "ilgili_cihaz"] },
    { baslik: "İçerik", kodlar: ["icerik", "cozum"] },
  ],
  sozlesme: [
    { baslik: "Sözleşme", kodlar: ["tedarikci", "sozlesme_no", "tur", "sorumlu"] },
    { baslik: "Süre & Tutar", kodlar: ["baslangic", "bitis", "tutar"] },
  ],
  tedarikci: [
    { baslik: "İletişim", kodlar: ["firma", "yetkili", "telefon", "email", "web"] },
    { baslik: "Diğer", kodlar: ["adres", "vergi_no", "kategori"] },
  ],
  ag: [
    { baslik: "Ağ / Altyapı", kodlar: ["kategori", "ip_araligi", "vlan", "gateway", "dns", "cihaz"] },
  ],
  alan_adi: [
    { baslik: "Alan Adı", kodlar: ["kayit_yeri", "yetkili", "nameserver", "yonetim_url"] },
    { baslik: "Süre & Ücret", kodlar: ["kayit_tarihi", "bitis", "otomatik_yenileme", "yillik_ucret"] },
    { baslik: "Notlar", kodlar: ["notlar"] },
  ],
  ssl: [
    { baslik: "Sertifika", kodlar: ["saglayici", "tur", "kurulu_sunucu"] },
    { baslik: "Süre & Ücret", kodlar: ["baslangic", "bitis", "otomatik_yenileme", "yillik_ucret"] },
    { baslik: "Notlar", kodlar: ["notlar"] },
  ],
  talep: [
    { baslik: "Talep", kodlar: ["musteri", "iletisim", "kategori", "ilgili_cihaz"] },
    { baslik: "Açıklama", kodlar: ["aciklama"] },
  ],
  sistem: [
    { baslik: "Sistem", kodlar: ["musteri", "teknoloji", "ortam", "sorumlu", "repo", "mevcut_surum"] },
    { baslik: "Veritabanı & Notlar", kodlar: ["veritabani", "notlar"] },
  ],
  surec: [
    { baslik: "Tanım", kodlar: ["sistem", "hedef", "kategori", "ozet", "surum"] },
    { baslik: "İçerik", kodlar: ["icerik", "db_iliski"] },
  ],
  revizyon: [
    { baslik: "Talep", kodlar: ["sistem", "talep_no", "talep_eden", "talep_tarihi"] },
    { baslik: "Sürüm", kodlar: ["surum_no", "yayin_tarihi", "aciklama"] },
  ],
  personel: [
    { baslik: "Kimlik", kodlar: ["sicil_no", "departman", "unvan"] },
    { baslik: "İletişim", kodlar: ["email", "telefon", "ise_giris"] },
    { baslik: "Notlar", kodlar: ["notlar"] },
  ],
};

// Liste satirinda gosterilecek anahtar alanlar. v: veri alani kodu; f: ozel fonksiyon; et: opsiyonel etiket.
export const LISTE_KOLON = {
  donanim: [{ v: "seri_no", et: "SN" }, { f: (k) => [k.veri.marka, k.veri.model].filter(Boolean).join(" ") }, { f: (k) => k.atanan, et: "👤" }],
  yazilim: [{ v: "uretici" }, { v: "surum", et: "v" }, { f: (k) => k.atanan, et: "👤" }],
  lisans: [{ v: "urun" }, { v: "bitis", et: "Bitiş" }, { v: "koltuk", et: "Koltuk" }, { f: (k) => k.atanan, et: "👤" }],
  bilgi: [{ v: "kategori" }, { v: "ozet" }],
  sozlesme: [{ v: "tedarikci" }, { v: "bitis", et: "Bitiş" }, { v: "tutar", et: "Tutar" }],
  tedarikci: [{ v: "yetkili" }, { v: "telefon" }, { v: "email" }],
  ag: [{ v: "kategori" }, { v: "ip_araligi" }, { v: "vlan", et: "VLAN" }],
  alan_adi: [{ v: "kayit_yeri", et: "Kayıt" }, { v: "bitis", et: "Bitiş" }, { v: "otomatik_yenileme", et: "Oto" }],
  ssl: [{ v: "saglayici", et: "CA" }, { v: "tur" }, { v: "bitis", et: "Bitiş" }],
  talep: [{ v: "musteri" }, { v: "kategori" }],
  sistem: [{ v: "teknoloji" }, { v: "mevcut_surum", et: "Sürüm" }, { v: "ortam" }],
  surec: [{ v: "sistem" }, { v: "hedef" }, { v: "kategori" }],
  revizyon: [{ v: "sistem" }, { v: "surum_no", et: "Sürüm" }],
  personel: [{ v: "departman" }, { v: "unvan" }],
};

// Bir tip icin form bolumleri; alanlar (tanim listesi) verilir, bolumlere gore siralanip
// listede olmayanlar "Diğer" bolumune eklenir.
export function formBolumleri(tip, alanlar, metaEtiket) {
  const tanim = Object.fromEntries(alanlar.map((a) => [a.kod, a]));
  const sablon = BOLUMLER[tip];
  if (!sablon) return [{ baslik: `${metaEtiket} detayları`, alanlar }];
  const kullanilan = new Set();
  const bolumler = sablon.map((b) => {
    const alan = b.kodlar.map((k) => tanim[k]).filter(Boolean);
    alan.forEach((a) => kullanilan.add(a.kod));
    return { baslik: b.baslik, alanlar: alan };
  }).filter((b) => b.alanlar.length > 0);
  const kalan = alanlar.filter((a) => !kullanilan.has(a.kod));
  if (kalan.length) bolumler.push({ baslik: "Diğer", alanlar: kalan });
  return bolumler;
}
