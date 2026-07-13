# CLAUDE.md — BT Bilgi Bankası

> Projenin **kalıcı hafızası**. Her oturum otomatik okunur. Amaç: yeni oturum "neden böyle"yi
> bilerek başlasın. (Kardeş proje: `C:\strateji-masasi` — bazı dersler oradan geldi.)

---

## 0) Bu proje nedir?

**BT Bilgi Bankası** — firmanın **tüm IT donanım + yazılım + bilgi bankası**. Girilen her kayıt
**herhangi bir kelimeyle tam metin aranabilir** (SQLite FTS5). Jira mantığında detaylı kurgu:
kayıt tipleri (issue type), tipe özel alanlar (custom fields), durum/iş akışı, etiketler,
zimmet, yorumlar, ekler, kayıtlar-arası ilişkiler (issue links), değişiklik geçmişi.

- Kullanım: **ofis ağı, birkaç kişi** (bir makinede sunucu, ekip tarayıcıdan girer).
- Arayüz dili **Türkçe**; değişken/fonksiyon isimleri de sıklıkla Türkçe.
- Sahibi: **Bilal Ünsal** (BilgiTek Teknoloji Çözümleri).
- **YATIRIM/DANIŞMANLIK ürünü DEĞİL** — bu bir iç envanter/bilgi bankası aracı.

---

## 1) Mimari

```
[ arayuz/ ] React + Vite (SPA, tarayıcı)  ──HTTP /api──►  [ sunucu/ ] Node + Express + node:sqlite (FTS5)
                                                                   │
                                                              db/bilgi.sqlite
```

- **sunucu/**: REST API + statik arayüz servisi. Port **8793** (8787=Strateji Masası, 8790=BilgiTek CRM — çakışma kaçınıldı).
- **arayuz/**: yalnızca UI; dev'de Vite (5180) `/api`'yi 8793'e proxy'ler. Üretimde `arayuz/dist`
  sunucudan servis edilir → tek origin, tek port.
- **Bağımlılıklar bilinçli olarak minimum:** sunucu = `express` + `cors`; DB = Node'un **yerleşik
  `node:sqlite`**'ı (native derleme YOK, harici sürücü YOK). Arayüz = react + vite.

---

## 2) Dosya yapısı

```
bt-bilgi-bankasi/
├─ package.json          # kök: "npm test" = node --test; "npm start" = sunucu
├─ version.json          # sürüm kaynağı (/api/version)
├─ CLAUDE.md             # bu dosya
├─ tests/
│  └─ db.test.mjs        # SQLite + FTS5 + arama + migrasyon + uyarılar + müşteri/talep (13 test)
├─ sunucu/
│  ├─ server.js          # Express API + statik servis (LAN :8793)
│  ├─ intake.js          # Müşteri talep kapısı — İNTERNETE AÇILAN TEK servis (:8795, ayrı süreç)
│  ├─ musteri-ekle.js    # CLI: müşteri oluştur + talep-kapısı linki üret
│  ├─ db.js              # node:sqlite: şema + tohum + kayıt/ek/müşteri işlemleri + FTS + migrasyon + uyarılar
│  └─ tohum-alanlar.js   # TİP KATALOĞU (talep dahil) + tipe özel ALAN tanımları + İLİŞKİ türleri
├─ docs/
│  └─ musteri-talep-kapisi.md  # kurulum + güvenli yayın rehberi (Cloudflare Tunnel)
├─ arayuz/               # React + Vite
│  └─ src/
│     ├─ App.jsx         # ana: kimlik kapısı + kenar çubuğu + arama + liste + görünüm geçişi
│     ├─ Giris.jsx       # giriş ekranı · ParolaDegistir.jsx · Kullanicilar.jsx (admin)
│     ├─ KayitForm.jsx   # tipe göre OTOMATİK çizilen ekleme/düzenleme formu
│     ├─ KayitDetay.jsx  # tek kayıt: alanlar + yorumlar + ilişkiler + ekler + geçmiş
│     ├─ Uyarilar.jsx    # bitiş uyarıları panosu
│     ├─ ui.jsx          # paylaşılan atomlar (Panel, Rozet, AlanGirdi…)
│     ├─ tema.js         # koyu palet (PAL) + yardımcılar
│     └─ api.js          # fetch sarmalayıcı (çerezli; kimlik + kayıt uçları)
└─ db/                   # bilgi.sqlite (GITIGNORED; sadece README commit'lenir)
```

---

## 3) Veri modeli (Jira karşılıkları)

Merkezde tek **kayıt** (issue) nesnesi; her kayıt bir **tipe** ait.

| Jira | Bizde | Nerede |
|---|---|---|
| Issue type | `tip`: donanim·yazilim·lisans·bilgi·sozlesme·tedarikci·ag | `tohum-alanlar.js` TIPLER |
| Custom fields | tipe özel alanlar (`alan_tanim` tablosu; form otomatik çizilir) | ALANLAR |
| Status | `durum` (tipe göre; TIPLER[].durumlar) | kayitlar.durum |
| Labels | çoklu `etiketler` | etiketler + kayit_etiket |
| Assignee | `atanan` (zimmet, serbest metin) | kayitlar.atanan |
| Comments | `yorumlar` | yorumlar tablosu |
| Attachments | `ekler` (şema hazır, UI Faz 4) | ekler tablosu |
| Issue links | `iliskiler` (kurulu/kapsar/bağlı/yedek…) | iliskiler + ILISKI_TURLERI |
| History | `gecmis` (audit) | gecmis tablosu |
| Search | **FTS5** — başlık + tüm alanlar + etiket + yorum | kayit_fts |

- **Tipe özel alanlar `kayitlar.veri` (JSON) kolonunda** durur; form şeması `alan_tanim` tablosundan
  (ilk açılışta `ALANLAR`'dan tohumlanır). Yeni alan eklemek = `tohum-alanlar.js`'e satır ekle
  (boş DB'de otomatik gelir; dolu DB'de migrasyon gerekir — henüz yok).
- **FTS elle bakımı:** her yazımda `ftsYaz(db, id)` kaydın aranabilir metnini yeniden kurar
  (başlık + veri değerleri + etiketler + yorumlar). `unicode61 remove_diacritics 2` → Türkçe
  büyük/küçük + aksan duyarsız. Arama `aramaIfadesi()` ile prefix (`kelime*`) + AND.

---

## 4) Komutlar

```bash
# Geliştirme (iki pencere)
cd sunucu ..  ->  npm start                 # API :8793 (kök: npm start)
cd arayuz && npm install && npm run dev      # UI :5180 (tarayıcı açılır, /api proxy'li)

# Test (kök)
npm test        # = node --test → tests/db.test.mjs

# Üretim (tek origin): arayüzü derle, sunucu onu servis etsin
cd arayuz && npm run build      # → arayuz/dist
npm start                        # http://localhost:8793 hem UI hem API
```

Ortam: `PORT` (varsayılan 8793), `BILGI_DB` (varsayılan `db/bilgi.sqlite`).

---

## 5) Strateji Masası'ndan taşınan dersler (uyulacak)

1. **db/ ASLA ezilmez** — kullanıcı verisi. `.gitignore`'da `db/*.sqlite`. Güncelleme yaparken
   db kopyalama dışı bırakılır.
2. **`import.meta.url` ↔ pkg/.exe tuzağı:** `server.js` ve `db.js`'te `META_URL` yardımcısı var.
   Bundle'a girecek dosyalarda `import.meta.url` doğrudan kullanma → `META_URL`.
3. **Bağımlılıkta temkinli ol** — native/paketleme-kıran bağımlılık ekleme. DB için yerleşik
   `node:sqlite` tam da bu yüzden seçildi (Node ≥ 22.5 gerekir; makinede Node 24).
4. **Yavaş, sıfır kod hatası, küçük doğrulanabilir adımlar.** Para/veri hesabı → önce test.
   Arayüze dokunmadan önce (mevcut ekranlar) onay al.

---

## 6) Yol haritası / durum

- [x] **Faz 0** — SQLite+FTS5 şeması + Türkçe arama testi (8/8).
- [x] **Faz 1** — REST API (kayıt CRUD, arama, tipler/alanlar, istatistik, yorum, ilişki, geçmiş).
- [x] **Faz 2** — Arayüz: kenar çubuğu + global arama + liste + tipe göre otomatik form + detay
      (alanlar/yorumlar/ilişkiler/geçmiş). Build + API + üretim servisi doğrulandı.
- [~] **Faz 4** (KISMEN — Bilal isteğiyle Faz 3'ten önce açıldı):
    - [x] **Alan migrasyonu** — `alanlariSenkronla()` her açılışta `tohum-alanlar.js`'i upsert eder;
          dolu DB'ye yeni/değişen alan veriyi bozmadan gelir, elle eklenmiş alan silinmez. (test)
    - [x] **Dosya ekleri** — base64 gövde → disk (`ekler/<kayitId>/`, gitignore'lı, env `EKLER_DIR`).
          Uçlar: POST `/api/kayit/:id/ek`, GET `/api/ek/:id` (indir), DELETE `/api/ek/:id`. Max 25MB.
          Dosya adı FTS'e girer (aranabilir). UI: detayda "Ekler" paneli. (HTTP doğrulandı)
    - [x] **Bitiş uyarıları** — `uyarilar()` garanti/lisans/sözleşme tarihlerini `json_extract` ile
          tarar; `/api/uyarilar?gun=`. UI: "🔔 Uyarılar" panosu + kenar çubuğu sayacı. (test)
    - [ ] Dışa/içe aktarma (JSON/CSV), form içinde ilişki-seç (gelişmiş alan tipi).
- [x] **Faz 5 — Müşteri Talep Kapısı (dar tokenlı intake).** Müşteri, kişiye özel gizli linkle
      (`…/t/<token>`) YALNIZCA kendi talebini gönderir; hiçbir kaydı okuyamaz/listeleyemez.
    - `talep` yeni kayıt tipi (durum: Yeni→İnceleniyor→…). `musteriler` tablosu (token **hash'li**).
    - `sunucu/intake.js` — İNTERNETE AÇILAN TEK servis (:8795, ayrı süreç). Yalnız yazar. Hız sınırı
      (token 8 / IP 20 / 15dk) + honeypot + nötr 404. Ana uygulama (:8793) LAN'de kalır.
    - `sunucu/musteri-ekle.js` — müşteri oluştur + link üret (token 1 kez görünür). LAN'de
      `/api/musteriler*` uçları (liste/ekle/token-yenile/durum). Talepler personel UI'ında otomatik görünür.
    - Yayın rehberi: `docs/musteri-talep-kapisi.md` (Cloudflare Tunnel; **8793 asla dışarı açılmaz**).
      **Bilal yapar** (ağ/domain). Kod+rehber hazır, testler dahil (13/13).
- [x] **Faz 3 — Personel giriş/parola (auth).** `kullanicilar` + `oturumlar` tabloları. Parola
      **scrypt** hash'li (salt:hash, sıfır ek bağımlılık). İlk açılışta **admin/admin** seed'lenir
      (`sifre_yenile=1` → ilk girişte değiştirme zorunlu). Çerez tabanlı oturum (HttpOnly, 7 gün).
      Roller: **admin** (kullanıcı yönetimi) / **personel**. Guard: `/api/*` girişsiz 401
      (serbest: giris/cikis/ben/version); admin uçları 403. UI: Giris + ParolaDegistir (zorunlu/gönüllü)
      + Kullanicilar (admin) + üst-bar kullanıcı menüsü. Testler 16/16, HTTP uçtan uca doğrulandı.
      NOT: müşteri intake AYRI (tokenli, hesapsız) — auth'tan etkilenmez.
- [x] **Faz 6 — Dokümantasyon modülü.** 3 yeni tip: **🧩 Sistem** (müşteri/teknoloji/veritabanı/
      ortam/mevcut sürüm), **📝 Süreç/Doküman** (bağlı sistem · hedef: Teknik/Son-kullanıcı · kategori ·
      **içerik markdown** · DB ilişkisi · sürüm), **🔀 Revizyon** (talep no/eden/tarih · durum
      Talep→…→Yayında · sürüm no · yayın tarihi → "hangi revizyonla hangi sürüm yayında").
      Uzun metin alanları **markdown** render edilir (`arayuz/src/md.js` — güvenli: HTML kaçışı +
      URL beyaz liste; test 5/5). Ekran görüntüsü: Ekler paneli → 📋 "gömme kodu" → `![](/api/ek/ID)`
      içeriğe yapıştırılır, detayda **inline** görünür. Testler 21/21 (db 16 + md 5).
    - [ ] Sonraki incelik: form içi ilişki-seç (sistem alanı şimdilik metin; İlişkiler panelinden
          gerçek bağ kurulabiliyor), içeriğe **yapıştır-yükle** (görsel panoyu doğrudan gömme).
- [x] **Faz 8 — Modül zenginleştirme (Yol A: motor aynı, sunum tipe özel).** Kullanıcı geri bildirimi
      "tek form her yere kopyalanmış" → düzeltildi. `arayuz/src/modul.js`: **BOLUMLER** (form alanları
      tipe göre bölümlere ayrılır — Donanım: Temel/Teknik/Satın Alma & Garanti…) + **LISTE_KOLON**
      (her tip listede kendi anahtar kolonlarını gösterir). Başlık etiketi/örneği tipe göre; Öncelik/
      Konum koşullu. **SEMAK logosu** header + giriş (gömülü). Motor/DB değişmedi — birleşik arama/
      ilişki/geçmiş/zimmet korundu. Karar: Yol B (ayrı tablolar) REDDEDİLDİ (birleşik aramayı kaybederdi).
      Sıradaki incelik: detay kartını da bölümlü göster; tipe özel workflow/durum renkleri.
- [x] **Faz 7 — Personel kartı + Zimmet (change management).** Yeni tip **🧑‍💼 Personel** (departman/
      sicil/ünvan/…). `zimmetler` defteri: her satır bir zimmet dönemi (kayit_id=varlık, personel_id,
      baslangic/bitis, atayan). `zimmetAta` yeniden zimmetlemede eskisini kapatıp yenisini açar → **tam
      tarihçe**; `atanan` kolonu senkron (liste/arama). **Ters sorgu** `personelZimmetleri` → personel
      kartında "Zimmetli Varlıklar" (aktif+geçmiş). Zimmet OPSİYONEL (switch/AP zimmetsiz). Zimmetlenebilir
      tipler: `ZIMMETLENEBILIR=[donanim,yazilim,lisans]`. UI: cihaz detayında Zimmet paneli (zimmetle/
      değiştir/iade + geçmiş), formda opsiyonel personel seçici (PersonelSec), personel kartında ters liste.
      Uçlar: POST `/api/kayit/:id/zimmet|iade`. Testler 23/23, HTTP doğrulandı.
- [x] **Dağıtım / güncelleme (GitHub oto-güncelleme).** Repo: **github.com/bilalunsal/bt-bilgi-bankasi**
      (public). `arayuz/dist` BİLİNÇLİ commit'lenir (müşteride derleme gerekmesin). `.gitattributes` →
      `.bat` depoda CRLF (indirilen zip Windows'ta çalışır). **İlk kurulum:** repo ZIP indir → aç →
      `sunucu-baslat.bat`. **Güncelleme:** `guncelle.bat` (codeload zip indirir, kodu yeniler,
      **db/ + ekler/ KORUNUR**, npm install). Akış: değişiklik → commit → `git push` → müşteride
      `guncelle.bat`. Uçtan uca test edildi (CRLF, dist, veri koruması). SEMAK'ta Node 24 kurulu.
- [x] **Faz 9 — Alan adı + SSL sertifikası takibi.** İki yeni tip: **🌍 Alan Adı** (kayıt yeri/
      sağlayıcı=tedarik yeri · bitiş/yenileme · otomatik yenileme · nameserver · yetkili · yönetim
      URL · yıllık ücret) ve **🔒 SSL Sertifikası** (sağlayıcı/CA · tür DV/OV/EV/Wildcard/SAN ·
      başlangıç/bitiş · otomatik yenileme · kurulu sunucu · yıllık ücret). Her ikisinin `bitis` alanı
      **uyarı motoruna** bağlandı (`UYARI_ALANLARI`) → 🔔 Uyarılar panosu + kenar çubuğu sayacı süresi
      yaklaşan/geçen alan adı, SSL, (abonelik) lisans, garanti, sözleşmeleri **tek yerde** gösterir.
      Sol menüde yeni grup "Alan Adı & SSL". Tipe özel form bölümleri + liste kolonları (modul.js).
      Motor/DB şeması değişmedi — tamamen ekleme; `alanlariSenkronla` dolu DB'ye otomatik taşır.
      Uyarilar.jsx zaten jenerik (tipMeta ikon + kategori). Testler 24/24. Commit+push edildi.
- [x] **Faz 10 — E-posta bildirimleri (SMTP / Office 365).** `ayarlar` (K/V) tablosu + yardımcılar
      (`ayarGetir/Kur/ariGetir/ariKaydet`). `sunucu/eposta.js`: **nodemailer** (^9.0.3, güvenlik
      yaması) DİNAMİK import — paket yoksa sunucu yine çalışır, e-posta no-op. Yapılandırılmamış/
      kapalı/hatalıysa **sessizce atlar, ASLA exception fırlatmaz** (ana akışı kırmaz). O365
      varsayılanı (smtp.office365.com:587 STARTTLS). Konu satırında CRLF temizliği (müşteri verisi).
      **Yeni müşteri talebi** gelince IT'ye mail (intake.js hook, non-blocking). Admin uçları:
      GET/PUT `/api/ayarlar` (parola **maskeli**; boş parola mevcut değeri korur), POST
      `/api/ayarlar/eposta-test`. `sarmala()` artık async-güvenli. UI: **Ayarlar.jsx** (SMTP +
      bildirim anahtarları + Test Gönder). Gönderen: **admin@semak.com.tr** (Bilal verdi; parolayı
      admin ekrandan girer — O365 SMTP AUTH açık olmalı). Test 26/26, HTTP uçtan uca.
- [x] **Faz 11 — White-label marka + sürüm takibi + form focus fix + menü akordeon.**
    - **Marka (white-label):** Logo artık GÖMÜLÜ DEĞİL — her firma Ayarlar>Marka'dan yükler (data URI,
      `ayarlar.marka_logo`; db/ korunduğu için güncellemede kalır). Program adı **değişken**:
      `marka_ad` (kısa) + `marka_tam` (tam) — "Semak" sabit değil. Public `GET /api/marka` (giriş
      ekranında da gerekli, auth'suz — SERBEST'te). Admin: POST/DELETE `/api/marka/logo` (tür+~2MB
      doğrulama). `ui.jsx MarkaLogo` (logo yoksa baş harf monogramı). App/Giriş marka'dan çizer,
      `document.title=marka_tam`. Gömülü `logo-semak.jpg` **silindi**. version.json tamAd nötrleşti.
      **NOT:** SEMAK'ın kendi adını/logosunu bir kez Ayarlar'dan girmesi gerekir (artık default değil).
    - **Sürüm takibi:** version.json'a **`yapim`** (build no) + `version` semver. `guncelle.bat` [1/5]
      **ön-kontrol**: GitHub raw version.json'u PowerShell'le çekip yerelle kıyaslar; eşit/ileri ise
      zip'i İNDİRMEZ (exit 10 → `if errorlevel 10` çıkış). server `GET /api/guncelleme` (admin) →
      { yerel, uzak, guncellemeVar }; çevrimdışı graceful. UI: Ayarlar "Sürüm & Güncelleme" +
      admin header "⬆ Güncelleme var" rozeti. `GUNCELLEME_URL` env ile değiştirilebilir.
      **Her yeni sürümde `version.json` `yapim`'ı artır** (yoksa istemci güncelleme göremez).
    - **Bug fix (Faz 8 regresyonu):** KayitForm'da `Etiketli` bileşeni render İÇİNDE tanımlıydı →
      her tuşta remount → focus başlığa fırlıyordu. Modül seviyesine taşındı. Tek ortak form olduğu
      için tüm tiplerin Yeni Kayıt ekranını düzeltti.
    - **Menü akordeon:** sol menüde tek grup açık (Set → tek string), Genel varsayılan.
- [x] **Faz 12 — Otomatik yedekleme + Müşteri talep durum takibi (portal).**
    - **Yedekleme:** `sunucu/yedek.js` — `VACUUM INTO` ile tutarlı sıcak kopya (WAL güvenli),
      tarihli dosya, son N adet (budama). Hedef **ikinci disk / ağ paylaşımı** (`\\SUNUCU\yedek`),
      boşsa `<proje>/_yedekler`. Otomatik: yalnız ana süreçte, açılış+15sn / saatte bir "bugün
      alındı mı" (günde bir). Admin uçları: POST `/api/yedek/simdi`, GET `/api/yedek/liste`,
      GET `/api/yedek/indir` (regex ad doğrulama → path traversal engeli). UI: Ayarlar>Yedekleme.
      `YEDEK_DIR` env. Test: VACUUM INTO geçerli kopya + budama.
    - **Müşteri portalı (durum takibi + mesajlaşma):** `yorumlar`+`gorunur`(0/1)+`yazar_tip` (hafif
      migrasyon `kolonEkle`, **yarış-güvenli**: iki süreç ALTER yarışında "duplicate column" yutulur).
      DB: `musteriTalepleri/TalepGetir/MesajEkle/musteriGetir` — **her sorgu `musteri_id` filtreli**,
      yalnız beyaz-liste alan + yalnız `gorunur=1` yorum döner (iç not/atanan **asla sızmaz**).
      intake.js (:8795): `/t/<token>` altında **Taleplerim** (durum rozeti) · `/t/<token>/talep/:id`
      detay+yazışma+yanıt kutusu · POST `.../mesaj` (hız sınırı+honeypot+limit). Başkasının talebi →
      nötr 404. Personel: yorum ucunda **`gorunur`** (müşteriye görünür yanıt) + durum değişince/
      görünür yanıtta **müşteriye e-posta** (`bildirim_musteri_durum`). eposta.js: `musteriMesajBildir`
      (IT'ye), `musteriDurumBildir`+`musteriYanitBildir` (müşteriye). KayitDetay'da "müşteriye görünür"
      anahtarı + müşteri/görünür rozetleri. Test 28/28; HTTP izolasyon (B→A 404), iç not sızmıyor.
- [x] **Faz 13 — Talep yönlendirme + Dış Kişi + iç portal + e-posta→ticket + ilişki seçici.**
    - **İlişki alanı form seçici** (ui.jsx `IliskiGirdi`): `iliski_tip`'teki kayıtları arar, seçilenin
      **id**'sini saklar, etiketini rozetle gösterir. AlanGirdi 'iliski' artık bunu çizer (eskiden zayıf
      ham giriş). KayitDetay'da ilişki alanı id yerine **etiket + tıklanabilir link** (`IliskiDeger`).
      TÜM ilişki alanlarını (tedarikçi, kurulu cihaz, dış kaynak) iyileştirir.
    - **Yeni tip `dis_kisi`** (Dış Kişi / Uzman 🧑‍🔧): firma/uzmanlık/email/telefon/notlar — tedarikçiden
      AYRI harici uzman listesi. Menü "Kişiler & Destek".
    - **Talep yönlendirme:** `hedef_tur` (İç IT Ekibi / Dış Kaynak) + `dis_kaynak` (ilişki→dis_kisi).
      Dış Kaynak'a (yeni/değişmiş) yönlendirilince dış kişinin e-postasına talep detayı otomatik gider
      (`disKaynakBildir`, server POST/PUT hook `disKaynakDene`). Ayar `bildirim_dis_kaynak`.
    - **İç talep portalı** `/ic` (LAN, login'siz): server-render form (ad+konu+kategori+hedef+açıklama)
      → talep (`kaynak=ic-portal`) + IT'ye bildirim. `/api` dışı → guard'a takılmaz; hız sınırı+honeypot.
      `express.urlencoded` eklendi. **Guard bozulmadı** (login'siz /api hâlâ 401).
    - **E-posta → ticket** (`posta-gelen.js`): `teknik@` gibi kutuyu **IMAP**'le (imapflow+mailparser,
      DİNAMİK import) yoklar, okunmamışları talebe çevirir (`kaynak=eposta`), okundu işaretler. Döngü/
      spam koruması (kendi adresimiz + auto-submitted/precedence/autoreply → talep AÇMAZ). Admin POST
      `/api/posta/kontrol` (manuel). Zamanlayıcı ana süreçte 3dk (env `POSTA_ARALIK_DK`). ayarlar
      `imap_*` (parola maskeli). **VARSAYILAN KAPALI**; canlı O365 testi Bilal'de (teknik@ + uygulama
      parolası; O365'te IMAP açık olmalı). deps: imapflow ^1, mailparser ^3 (saf JS, 0 açık).
      Test 29/29; e-posta→ticket graceful doğrulandı (canlı IMAP hariç). Sürüm **1.3.0 / yapım 13**.
- [x] **Faz 14 — 3 seviyeli yetki + bildirim genişletme + uyarı düzeltmeleri.** (Sürüm **1.4.0 / yapım 15**)
    - **Yetki (rol izinleri):** `sunucu/izinler.js` — roller **admin | it | personel** (db `rolGecerli`).
      İzin **MODÜL GRUBU** bazında (menüyle birebir: genel/envanter/alanssl/dokuman/destek/yonetim),
      yalnız "erişir/erişemez". **admin** hepsi, **it** yönetim hariç hepsi (SABİT), **personel**
      admin'in seçtiği içerik modülleri (ayarlar `izin_personel` JSON → **güncellemede korunur**;
      varsayılan=hepsi, mevcut kurulumda daralma yok). Backend guard: kayıt oku/yaz/yorum/ilişki/
      zimmet/ek uçlarında `kayitErisimGuard` (tip→modül); `ara` `tipler` süzgeci; istatistik/uyarılar
      izinli tiplere göre süzülür (gizli modül başlıkları **sızmaz**). `/api/ben` + `/api/giris`
      `izinModuller` döner → App menüyü + "Yeni" listesini süzer. Admin uçları GET/PUT `/api/roller/izin`.
      UI: Kullanicilar'da rol seçici (3 rol) + **"Rol izinleri — Personel"** onay-kutu paneli. E2E doğrulandı
      (personel destek→ticket erişir/donanım 403/aramada gizli; it envanter var/admin uçları 403).
    - **Bildirim genişletme:** (2) IT dış-kaynağa yönlendirilmiş talebe **yorum** yazınca atanan dış
      kişiye mail (`disKaynakYanitBildir`, yorum ucu hook). (3) Talebi **açana** (ic-portal/e-posta
      kaynak, `veri.iletisim` e-posta ise) durum değişimi + görünür yanıt bildirimi (`talepAcanBildir`;
      müşteri portalı olanlar eskisi gibi `musteri*Bildir`). Ayar `bildirim_talep_acan` (Ayarlar UI).
    - **Uyarı düzeltmeleri:** (4) `uyarilar()` **kapatılmış** kayıtları atlar (alan adı Birakildi, SSL
      Iptal/Yenilendi, lisans Iptal/Kullanilmiyor, sözleşme Feshedildi, hurda/kayıp garanti →
      `UYARI_KAPALI_DURUMLAR`, Türkçe-normalize). (6) Uyarılar panosu artık **açık talepleri** de
      listeler (durum Cozuldu/Kapandi/Reddedildi hariç → `talepler`); kenar çubuğu sayacına eklendi.
      Test **33/33**.
    - [ ] **Sırada:** dış kaynağın ticket'ı KAPATMA yolu yok (tokenlı dış-kaynak portalı / e-posta yanıt
          / IT kapatır — **Bilal ile yöntem netleşecek**). SEMAK teknik@ hem SMTP hem IMAP kullanacak.
- [ ] **Kalan dağıtım:** SEMAK'a ilk kurulum + Cloudflare Tunnel (8795 yayın); ops: **otomatik yedek
      (SIRADA — Bilal 'veri çok kritik' dedi)**, Windows başlangıç servisi, (opsiyonel) tek `.exe`.
- [ ] **Kararlaştırılan sonraki 4 (rakip ITSM analizi):** 1) E-posta ✅(Faz10) · 3) müşteri talep
      durum takibi ✅(Faz12) · KALAN: 2) SLA/talep zamanlaması · 4) dashboard + CSV/JSON export.

**Bilinen sınırlar:** müşteri "Müşteriler" yönetim ekranı henüz yok (CLI+API var); dışa aktarma yok;
markdown/inline ekran görüntüsü render'ı yok (Faz 6 ile gelecek).

**Portlar:** 8793 ana uygulama (LAN, girişli; ayrıca `/ic` login'siz iç talep portalı), 8795 intake
(dışa açılabilir tek servis, tokenli), 5180 Vite dev.
**Varsayılan giriş:** admin / admin (ilk girişte değiştirilir).

## SEMAK'ta güncelleme sonrası TEK-SEFERLİK ayarlar (Ayarlar ekranı, admin)
Güncelleme akışı: `guncelle.bat` → `sunucu-baslat.bat`. Sonra Ayarlar'da:
1. **Marka:** logoyu yükle + firma adını gir (logo artık gömülü değil, white-label).
2. **SMTP (giden):** **teknik@semak.com.tr** kullanıcı + (uygulama) parolası + Test Gönder (gönderen boş → teknik@; O365 SMTP AUTH açık olmalı).
3. **Yedekleme:** klasörü ikinci disk/ağ paylaşımına ayarla (`\\SUNUCU\yedek`), otomatik günlük aç, Şimdi Yedekle.
4. **E-posta→ticket (IMAP, gelen):** **teknik@semak.com.tr** kutusu + (uygulama) parolası + Şimdi Kontrol Et (O365 IMAP açık olmalı). — **CANLI TEST BEKLİYOR.**
5. **Bildirim hedefleri / anahtarlar** kontrol (dış kaynak, talebi açan, müşteri durum).
6. **Rol izinleri:** Kullanıcılar ekranından personel rolünün erişeceği modülleri seç (varsayılan hepsi açık).

## YARIN DEVAM (2026-07-11)
- **E-posta→ticket canlı test** (teknik@ IMAP; imapflow API'si canlı O365'te doğrulanmadı — hata çıkarsa `posta-gelen.js` düzeltilecek).
- **Kalan 2 (kararlaştırılan 4'ten):** SLA/talep zamanlaması · Dashboard + CSV/JSON export.
- Cloudflare Tunnel (8795 müşteri portalı yayını) — Bilal ağ/domain.
- (Sona) IT personeli için komple kullanım kılavuzu.
