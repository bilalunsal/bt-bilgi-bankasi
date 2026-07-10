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
- [ ] **Kalan dağıtım:** SEMAK'a ilk kurulum + Cloudflare Tunnel (8795 yayın); ops: otomatik yedek,
      Windows başlangıç servisi, (opsiyonel) tek `.exe`.

**Bilinen sınırlar:** müşteri "Müşteriler" yönetim ekranı henüz yok (CLI+API var); dışa aktarma yok;
markdown/inline ekran görüntüsü render'ı yok (Faz 6 ile gelecek).

**Portlar:** 8793 ana uygulama (LAN, girişli), 8795 intake (dışa açılabilir tek servis, tokenli), 5180 Vite dev.
**Varsayılan giriş:** admin / admin (ilk girişte değiştirilir).
