# BT Bilgi Bankası

Firmanın **IT donanım · yazılım · lisans · bilgi bankası**. Her kayıt **herhangi bir kelimeyle
aranabilir** (seri no, marka, kişi, etiket, not içeriği…). Jira mantığında: kayıt tipleri, tipe
özel alanlar, durum, etiket, zimmet, yorum, kayıtlar-arası ilişki, geçmiş.

## Hızlı başlangıç (geliştirme)

```bash
# 1) Sunucu (API :8793)
npm start

# 2) Arayüz (:5180, tarayıcı açılır)  — ayrı bir terminalde
cd arayuz
npm install      # ilk sefer
npm run dev
```

Tarayıcıda: **http://localhost:5180**

## Tek pencere (üretim / ofis)

Arayüzü derleyip sunucudan servis edersen tek adres yeter:

```bash
cd arayuz && npm run build     # arayuz/dist üretir
cd .. && npm start             # http://localhost:8793  → hem arayüz hem API
```

Ofis ağında herkesin erişmesi için sunucu makinesinin IP'siyle: `http://<sunucu-ip>:8793`.

## Testler

```bash
npm test        # SQLite + tam metin arama testleri
```

## Notlar

- Veri `db/bilgi.sqlite`'ta tutulur — **yedeklemek için** sunucuyu durdurup `db/bilgi.sqlite*`
  dosyalarını kopyala. Bu dosyalar git'e girmez.
- Farklı veri konumu: `BILGI_DB=D:\yol\bilgi.sqlite` ortam değişkeni.
- Detaylı mimari ve kararlar: [CLAUDE.md](CLAUDE.md).
