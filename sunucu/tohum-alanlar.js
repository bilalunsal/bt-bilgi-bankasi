// tohum-alanlar.js — TIP KATALOGU (Jira "issue type") + TIPE OZEL ALANLAR ("custom fields").
// DB'deki alan_tanim tablosu bu katalogdan tohumlanir (bos ise). Arayuz formu bu alanlara gore cizilir.
// veri_tipi: metin | uzunmetin | sayi | para | tarih | secim | coklu_secim | iliski | eposta | url | ip
// Yeni alan eklerken: kod essiz (tip icinde), sira gorunum sirasini belirler.

// Her kayit tipi: kod, etiket, ikon (emoji), durumlar (is akisi), varsayilan durum.
export const TIPLER = [
  {
    kod: "donanim", etiket: "Donanim", ikon: "🖥️",
    durumlar: ["Aktif", "Depoda", "Serviste", "Arizali", "Zimmetli", "Hurda", "Kayip"],
    varsayilanDurum: "Aktif",
  },
  {
    kod: "yazilim", etiket: "Yazilim", ikon: "💿",
    durumlar: ["Kurulu", "Kaldirildi", "Guncelleme Bekliyor", "Kullanim Disi"],
    varsayilanDurum: "Kurulu",
  },
  {
    kod: "lisans", etiket: "Lisans", ikon: "🔑",
    durumlar: ["Aktif", "Yakinda Bitiyor", "Suresi Doldu", "Iptal", "Kullanilmiyor"],
    varsayilanDurum: "Aktif",
  },
  {
    kod: "bilgi", etiket: "Bilgi Notu", ikon: "📘",
    durumlar: ["Taslak", "Yayinda", "Guncellenmeli", "Arsiv"],
    varsayilanDurum: "Yayinda",
  },
  {
    kod: "sozlesme", etiket: "Sozlesme", ikon: "📄",
    durumlar: ["Aktif", "Yakinda Bitiyor", "Suresi Doldu", "Feshedildi"],
    varsayilanDurum: "Aktif",
  },
  {
    kod: "tedarikci", etiket: "Tedarikci", ikon: "🏢",
    durumlar: ["Aktif", "Pasif", "Kara Liste"],
    varsayilanDurum: "Aktif",
  },
  {
    kod: "ag", etiket: "Ag / Altyapi", ikon: "🌐",
    durumlar: ["Aktif", "Rezerve", "Kullanim Disi"],
    varsayilanDurum: "Aktif",
  },
  {
    // Musteri talebi — DIS intake servisinden (dar kapi) veya personelce girilir.
    kod: "talep", etiket: "Musteri Talebi", ikon: "🎫",
    durumlar: ["Yeni", "Inceleniyor", "Beklemede", "Cozuldu", "Kapandi", "Reddedildi"],
    varsayilanDurum: "Yeni",
  },
  // ── DOKUMANTASYON MODULU (Faz 6) ────────────────────────
  {
    kod: "sistem", etiket: "Sistem / Yazilim", ikon: "🧩",
    durumlar: ["Aktif", "Bakimda", "Emekli"],
    varsayilanDurum: "Aktif",
  },
  {
    kod: "surec", etiket: "Surec / Dokuman", ikon: "📝",
    durumlar: ["Taslak", "Yayinda", "Guncellenmeli", "Arsiv"],
    varsayilanDurum: "Taslak",
  },
  {
    kod: "revizyon", etiket: "Revizyon / Degisiklik", ikon: "🔀",
    durumlar: ["Talep", "Gelistiriliyor", "Test", "Yayinda", "Iptal"],
    varsayilanDurum: "Talep",
  },
  {
    // Personel karti — zimmet ters sorgusunun merkezi.
    kod: "personel", etiket: "Personel", ikon: "🧑‍💼",
    durumlar: ["Aktif", "Izinli", "Ayrildi"],
    varsayilanDurum: "Aktif",
  },
];

// Zimmet (change management) UYGULANABILEN kayit tipleri — bunlar bir personele verilebilir.
export const ZIMMETLENEBILIR = ["donanim", "yazilim", "lisans"];

// Form gorunum meta'si: baslik alaninin etiketi/ornegi + hangi cekirdek alanlar gosterilsin.
// (Oncelik/Konum her tipe uymuyor — personel kartinda "oncelik" saçma. Tipe gore acilir.)
const TIP_FORM = {
  donanim:   { baslikEtiket: "Tanım",            baslikOrnek: "Örn: Dell Latitude 5540 — Muhasebe", oncelik: false, konum: true },
  yazilim:   { baslikEtiket: "Yazılım Adı",       baslikOrnek: "Örn: AutoCAD 2024",                  oncelik: false, konum: false },
  lisans:    { baslikEtiket: "Lisans / Ürün",     baslikOrnek: "Örn: Microsoft 365 Business",        oncelik: false, konum: false },
  bilgi:     { baslikEtiket: "Başlık",            baslikOrnek: "Örn: VPN bağlantı sorunu çözümü",    oncelik: false, konum: false },
  sozlesme:  { baslikEtiket: "Sözleşme Başlığı",  baslikOrnek: "Örn: Yıllık bakım sözleşmesi",       oncelik: false, konum: false },
  tedarikci: { baslikEtiket: "Firma / Kısa Ad",   baslikOrnek: "Örn: ABC Bilişim",                   oncelik: false, konum: false },
  ag:        { baslikEtiket: "Ad / Tanım",        baslikOrnek: "Örn: Muhasebe VLAN",                 oncelik: false, konum: true },
  talep:     { baslikEtiket: "Konu",              baslikOrnek: "Örn: Yazıcı bağlanmıyor",            oncelik: true,  konum: false },
  sistem:    { baslikEtiket: "Sistem Adı",        baslikOrnek: "Örn: SEMAK B2B",                     oncelik: false, konum: false },
  surec:     { baslikEtiket: "Doküman Başlığı",   baslikOrnek: "Örn: Patlak Resim Süreci — Teknik",  oncelik: false, konum: false },
  revizyon:  { baslikEtiket: "Revizyon Başlığı",  baslikOrnek: "Örn: v2.3 — sipariş ekranı düzeltmesi", oncelik: true, konum: false },
  personel:  { baslikEtiket: "Ad Soyad",          baslikOrnek: "Örn: Ayşe Yılmaz",                   oncelik: false, konum: false },
};
// Her TIPLER ogesine form meta'sini ekle (arayuz tipMeta[kod].form olarak okur).
for (const t of TIPLER) t.form = TIP_FORM[t.kod] || { baslikEtiket: "Başlık", baslikOrnek: "", oncelik: false, konum: true };

// Tipe ozel alanlar. (Ortak alanlar — baslik, durum, oncelik, atanan, konum, etiket — cekirdek kolonlarda.)
export const ALANLAR = [
  // ── DONANIM ─────────────────────────────────────────────
  { tip: "donanim", kod: "kategori", etiket: "Kategori", veri_tipi: "secim", secenekler: ["Dizustu", "Masaustu", "Sunucu", "Monitor", "Yazici", "Ag Cihazi", "Telefon", "Tablet", "Depolama", "UPS", "Diger"], zorunlu: 1, sira: 10 },
  { tip: "donanim", kod: "marka", etiket: "Marka", veri_tipi: "metin", sira: 20 },
  { tip: "donanim", kod: "model", etiket: "Model", veri_tipi: "metin", sira: 30 },
  { tip: "donanim", kod: "seri_no", etiket: "Seri No", veri_tipi: "metin", sira: 40 },
  { tip: "donanim", kod: "envanter_no", etiket: "Envanter No", veri_tipi: "metin", sira: 50 },
  { tip: "donanim", kod: "mac", etiket: "MAC Adresi", veri_tipi: "metin", sira: 60 },
  { tip: "donanim", kod: "ip", etiket: "IP Adresi", veri_tipi: "ip", sira: 70 },
  { tip: "donanim", kod: "cpu", etiket: "Islemci", veri_tipi: "metin", sira: 80 },
  { tip: "donanim", kod: "ram", etiket: "RAM", veri_tipi: "metin", sira: 90 },
  { tip: "donanim", kod: "disk", etiket: "Disk", veri_tipi: "metin", sira: 100 },
  { tip: "donanim", kod: "isletim_sistemi", etiket: "Isletim Sistemi", veri_tipi: "metin", sira: 110 },
  { tip: "donanim", kod: "satin_alma", etiket: "Satin Alma Tarihi", veri_tipi: "tarih", sira: 120 },
  { tip: "donanim", kod: "garanti_bitis", etiket: "Garanti Bitis", veri_tipi: "tarih", sira: 130 },
  { tip: "donanim", kod: "tedarikci", etiket: "Tedarikci", veri_tipi: "iliski", iliski_tip: "tedarikci", sira: 140 },
  { tip: "donanim", kod: "fatura_no", etiket: "Fatura No", veri_tipi: "metin", sira: 150 },
  { tip: "donanim", kod: "fiyat", etiket: "Alis Fiyati", veri_tipi: "para", sira: 160 },

  // ── YAZILIM ─────────────────────────────────────────────
  { tip: "yazilim", kod: "kategori", etiket: "Kategori", veri_tipi: "secim", secenekler: ["Isletim Sistemi", "Ofis", "Guvenlik", "Tasarim", "Gelistirme", "Muhasebe", "Yedekleme", "Diger"], sira: 10 },
  { tip: "yazilim", kod: "uretici", etiket: "Uretici", veri_tipi: "metin", sira: 20 },
  { tip: "yazilim", kod: "surum", etiket: "Surum", veri_tipi: "metin", sira: 30 },
  { tip: "yazilim", kod: "kurulu_cihaz", etiket: "Kurulu Oldugu Cihaz", veri_tipi: "iliski", iliski_tip: "donanim", sira: 40 },
  { tip: "yazilim", kod: "lisans_kayit", etiket: "Bagli Lisans", veri_tipi: "iliski", iliski_tip: "lisans", sira: 50 },

  // ── LISANS ──────────────────────────────────────────────
  { tip: "lisans", kod: "urun", etiket: "Urun", veri_tipi: "metin", zorunlu: 1, sira: 10 },
  { tip: "lisans", kod: "uretici", etiket: "Uretici", veri_tipi: "metin", sira: 20 },
  { tip: "lisans", kod: "lisans_anahtari", etiket: "Lisans Anahtari", veri_tipi: "metin", sira: 30 },
  { tip: "lisans", kod: "lisans_turu", etiket: "Lisans Turu", veri_tipi: "secim", secenekler: ["Abonelik", "Suresiz", "OEM", "Volume", "Acik Kaynak", "Deneme"], sira: 40 },
  { tip: "lisans", kod: "koltuk", etiket: "Koltuk / Kullanici Sayisi", veri_tipi: "sayi", sira: 50 },
  { tip: "lisans", kod: "baslangic", etiket: "Baslangic", veri_tipi: "tarih", sira: 60 },
  { tip: "lisans", kod: "bitis", etiket: "Bitis / Yenileme", veri_tipi: "tarih", sira: 70 },
  { tip: "lisans", kod: "maliyet", etiket: "Maliyet", veri_tipi: "para", sira: 80 },
  { tip: "lisans", kod: "hesap_email", etiket: "Hesap E-postasi", veri_tipi: "eposta", sira: 90 },
  { tip: "lisans", kod: "tedarikci", etiket: "Tedarikci", veri_tipi: "iliski", iliski_tip: "tedarikci", sira: 100 },

  // ── BILGI NOTU (KB makalesi) ────────────────────────────
  { tip: "bilgi", kod: "kategori", etiket: "Kategori", veri_tipi: "secim", secenekler: ["Nasil Yapilir", "Sorun Cozumu", "Konfigurasyon", "Politika", "Prosedur", "Diger"], sira: 10 },
  { tip: "bilgi", kod: "ozet", etiket: "Ozet", veri_tipi: "metin", sira: 20 },
  { tip: "bilgi", kod: "icerik", etiket: "Icerik", veri_tipi: "uzunmetin", sira: 30 },
  { tip: "bilgi", kod: "cozum", etiket: "Cozum / Adimlar", veri_tipi: "uzunmetin", sira: 40 },
  { tip: "bilgi", kod: "ilgili_cihaz", etiket: "Ilgili Cihaz", veri_tipi: "iliski", iliski_tip: "donanim", sira: 50 },

  // ── SOZLESME ────────────────────────────────────────────
  { tip: "sozlesme", kod: "tedarikci", etiket: "Tedarikci", veri_tipi: "iliski", iliski_tip: "tedarikci", sira: 10 },
  { tip: "sozlesme", kod: "sozlesme_no", etiket: "Sozlesme No", veri_tipi: "metin", sira: 20 },
  { tip: "sozlesme", kod: "tur", etiket: "Tur", veri_tipi: "secim", secenekler: ["Bakim", "Destek", "Kiralama", "Abonelik", "Danismanlik", "Diger"], sira: 30 },
  { tip: "sozlesme", kod: "baslangic", etiket: "Baslangic", veri_tipi: "tarih", sira: 40 },
  { tip: "sozlesme", kod: "bitis", etiket: "Bitis", veri_tipi: "tarih", sira: 50 },
  { tip: "sozlesme", kod: "tutar", etiket: "Tutar", veri_tipi: "para", sira: 60 },
  { tip: "sozlesme", kod: "sorumlu", etiket: "Sorumlu", veri_tipi: "metin", sira: 70 },

  // ── TEDARIKCI ───────────────────────────────────────────
  { tip: "tedarikci", kod: "firma", etiket: "Firma Adi", veri_tipi: "metin", zorunlu: 1, sira: 10 },
  { tip: "tedarikci", kod: "yetkili", etiket: "Yetkili Kisi", veri_tipi: "metin", sira: 20 },
  { tip: "tedarikci", kod: "telefon", etiket: "Telefon", veri_tipi: "metin", sira: 30 },
  { tip: "tedarikci", kod: "email", etiket: "E-posta", veri_tipi: "eposta", sira: 40 },
  { tip: "tedarikci", kod: "web", etiket: "Web Sitesi", veri_tipi: "url", sira: 50 },
  { tip: "tedarikci", kod: "adres", etiket: "Adres", veri_tipi: "uzunmetin", sira: 60 },
  { tip: "tedarikci", kod: "vergi_no", etiket: "Vergi No", veri_tipi: "metin", sira: 70 },
  { tip: "tedarikci", kod: "kategori", etiket: "Kategori", veri_tipi: "metin", sira: 80 },

  // ── AG / ALTYAPI ────────────────────────────────────────
  { tip: "ag", kod: "kategori", etiket: "Kategori", veri_tipi: "secim", secenekler: ["VLAN", "Subnet", "IP Rezervasyonu", "DNS Kaydi", "Port", "Hesap / Erisim", "Genel"], sira: 10 },
  { tip: "ag", kod: "ip_araligi", etiket: "IP / Aralik", veri_tipi: "metin", sira: 20 },
  { tip: "ag", kod: "vlan", etiket: "VLAN", veri_tipi: "metin", sira: 30 },
  { tip: "ag", kod: "gateway", etiket: "Gateway", veri_tipi: "ip", sira: 40 },
  { tip: "ag", kod: "dns", etiket: "DNS", veri_tipi: "metin", sira: 50 },
  { tip: "ag", kod: "cihaz", etiket: "Ilgili Cihaz", veri_tipi: "iliski", iliski_tip: "donanim", sira: 60 },

  // ── MUSTERI TALEBI ──────────────────────────────────────
  { tip: "talep", kod: "musteri", etiket: "Musteri", veri_tipi: "metin", sira: 10 },
  { tip: "talep", kod: "iletisim", etiket: "Iletisim (tel/e-posta)", veri_tipi: "metin", sira: 20 },
  { tip: "talep", kod: "kategori", etiket: "Kategori", veri_tipi: "secim", secenekler: ["Ariza", "Talep", "Soru", "Kurulum", "Diger"], sira: 30 },
  { tip: "talep", kod: "aciklama", etiket: "Aciklama", veri_tipi: "uzunmetin", sira: 40 },
  { tip: "talep", kod: "ilgili_cihaz", etiket: "Ilgili Cihaz (musteri beyani)", veri_tipi: "metin", sira: 50 },

  // ── SISTEM / YAZILIM ────────────────────────────────────
  { tip: "sistem", kod: "musteri", etiket: "Musteri / Sahip", veri_tipi: "metin", sira: 10 },
  { tip: "sistem", kod: "teknoloji", etiket: "Teknoloji / Platform", veri_tipi: "metin", sira: 20 },
  { tip: "sistem", kod: "veritabani", etiket: "Veritabani (ad / baglanti notu)", veri_tipi: "metin", sira: 30 },
  { tip: "sistem", kod: "ortam", etiket: "Ortam", veri_tipi: "secim", secenekler: ["Uretim", "Test", "Gelistirme"], sira: 40 },
  { tip: "sistem", kod: "sorumlu", etiket: "Sorumlu", veri_tipi: "metin", sira: 50 },
  { tip: "sistem", kod: "repo", etiket: "Repo / URL", veri_tipi: "url", sira: 60 },
  { tip: "sistem", kod: "mevcut_surum", etiket: "Mevcut Yayinda Surum", veri_tipi: "metin", sira: 70 },
  { tip: "sistem", kod: "notlar", etiket: "Notlar", veri_tipi: "uzunmetin", sira: 80 },

  // ── SUREC / DOKUMAN ─────────────────────────────────────
  { tip: "surec", kod: "sistem", etiket: "Bagli Sistem", veri_tipi: "metin", sira: 10 },
  { tip: "surec", kod: "hedef", etiket: "Hedef Kitle", veri_tipi: "secim", secenekler: ["Teknik", "Son Kullanici", "Her Ikisi"], sira: 20 },
  { tip: "surec", kod: "kategori", etiket: "Kategori", veri_tipi: "secim", secenekler: ["Surec", "Runbook", "Nasil Yapilir", "Mimari", "DB Iliskisi", "Politika"], sira: 30 },
  { tip: "surec", kod: "ozet", etiket: "Ozet", veri_tipi: "metin", sira: 40 },
  { tip: "surec", kod: "icerik", etiket: "Icerik (markdown)", veri_tipi: "uzunmetin", sira: 50 },
  { tip: "surec", kod: "db_iliski", etiket: "Ilgili DB Tablolari & Iliskiler", veri_tipi: "uzunmetin", sira: 60 },
  { tip: "surec", kod: "surum", etiket: "Ait Oldugu Surum", veri_tipi: "metin", sira: 70 },

  // ── REVIZYON / DEGISIKLIK ───────────────────────────────
  { tip: "revizyon", kod: "sistem", etiket: "Bagli Sistem", veri_tipi: "metin", sira: 10 },
  { tip: "revizyon", kod: "talep_no", etiket: "Talep No", veri_tipi: "metin", sira: 20 },
  { tip: "revizyon", kod: "talep_eden", etiket: "Talep Eden", veri_tipi: "metin", sira: 30 },
  { tip: "revizyon", kod: "talep_tarihi", etiket: "Talep Tarihi", veri_tipi: "tarih", sira: 40 },
  { tip: "revizyon", kod: "aciklama", etiket: "Aciklama (ne degisti)", veri_tipi: "uzunmetin", sira: 50 },
  { tip: "revizyon", kod: "surum_no", etiket: "Surum No", veri_tipi: "metin", sira: 60 },
  { tip: "revizyon", kod: "yayin_tarihi", etiket: "Yayin Tarihi", veri_tipi: "tarih", sira: 70 },

  // ── PERSONEL ────────────────────────────────────────────
  { tip: "personel", kod: "sicil_no", etiket: "Sicil No", veri_tipi: "metin", sira: 10 },
  { tip: "personel", kod: "departman", etiket: "Departman", veri_tipi: "metin", sira: 20 },
  { tip: "personel", kod: "unvan", etiket: "Unvan", veri_tipi: "metin", sira: 30 },
  { tip: "personel", kod: "email", etiket: "E-posta", veri_tipi: "eposta", sira: 40 },
  { tip: "personel", kod: "telefon", etiket: "Telefon", veri_tipi: "metin", sira: 50 },
  { tip: "personel", kod: "ise_giris", etiket: "Ise Giris", veri_tipi: "tarih", sira: 60 },
  { tip: "personel", kod: "notlar", etiket: "Notlar", veri_tipi: "uzunmetin", sira: 70 },
];

// Kayitlar arasi iliski turleri (Jira "issue link" karsiligi).
export const ILISKI_TURLERI = [
  { kod: "kurulu", etiket: "kuruludur", ters: "uzerinde kurulu" },
  { kod: "kapsar", etiket: "kapsar", ters: "kapsaminda" },
  { kod: "bagli", etiket: "bagli", ters: "baglantili" },
  { kod: "yedek", etiket: "yedegi", ters: "yedeklenir" },
  { kod: "ait", etiket: "aittir", ters: "sahibi" },
  { kod: "ilgili", etiket: "ilgili", ters: "ilgili" },
];
