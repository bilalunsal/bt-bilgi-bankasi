# db/ — Kullanıcı verisi

Bu klasörde SQLite veritabanı dosyası (`bilgi.sqlite` + WAL/SHM yan dosyaları) tutulur.

- **`*.sqlite` dosyaları `.gitignore`'dadır — commit'lenmez.** (Strateji Masası dersi: kullanıcı verisi asla repoya girmez, güncellemede ezilmez.)
- Yedek almak için sunucu durdurulup bu klasördeki `bilgi.sqlite*` dosyaları kopyalanabilir.
- Farklı konum: `BILGI_DB` ortam değişkeni (`BILGI_DB=D:\veri\bilgi.sqlite`).
