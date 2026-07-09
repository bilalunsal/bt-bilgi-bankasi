# Müşteri Talep Kapısı (dar intake) — kurulum & güvenli yayın

Müşterileriniz, kendilerine verdiğiniz **kişiye özel gizli link** üzerinden **yalnızca kendi talebini**
gönderir. Hiçbir kaydı göremez/listeleyemez. Ana uygulamanız (personel) ağınızda kapalı kalır.

```
İnternet ──HTTPS──►  intake servisi (:8795)   ← SADECE bu dışarı açılır (tek iş: talep AL)
   müşteri                    │ aynı SQLite'a yazar
                              ▼
personel  ◄──── ana uygulama (:8793)  ← LAN'de, dışarı KAPALI (talepleri görür/triyaj eder)
```

## 1) Müşteri oluştur ve link üret

```bash
node sunucu/musteri-ekle.js "ACME Ltd" bilgi@acme.com --host https://destek.firmaniz.com
```

Çıktıdaki linki müşteriye verin:
```
https://destek.firmaniz.com/t/LpCdULyDd33myACLIUrKyquv
```

- **Token yalnızca bir kez görünür** (veritabanında hash'li durur). Kaybolursa yenileyin:
  `POST /api/musteriler/:id/token-yenile` (LAN'deki ana uygulamadan).
- `--host` vermezseniz test için `http://localhost:8795` kullanılır.

## 2) Intake servisini çalıştır

```bash
npm run intake        # veya: node sunucu/intake.js   → :8795
```

Ana uygulama (`npm start`, :8793) ile **aynı veritabanını** paylaşır; ikisi ayrı süreç olarak
birlikte çalışabilir. Gelen talepler personel tarafında **🎫 Müşteri Talebi** tipinde,
`Yeni` durumunda görünür — aramayla, müşteri adıyla bulunur.

## 3) Güvenli yayın — SADECE intake portunu aç

> **Altın kural:** 8793 (ana uygulama) İNTERNETE ASLA AÇILMAZ. Yalnızca 8795 (intake) yayınlanır.

**Önerilen: Cloudflare Tunnel** (port açmadan, ücretsiz HTTPS):
1. `cloudflared` kurun, Cloudflare hesabınızda bir tünel oluşturun.
2. Tüneli **yalnızca** `http://localhost:8795`'e yönlendirin (ana uygulamaya DEĞİL).
3. Bir alt alan adı bağlayın: `destek.firmaniz.com` → tünel.
4. Müşteri linklerini `--host https://destek.firmaniz.com` ile üretin.

Alternatif: reverse proxy (Caddy/Nginx) + router'da yalnız 8795 için port yönlendirme + otomatik TLS.
Bu durumda da 8793'ü asla dışarı yönlendirmeyin.

## Güvenlik özeti (kod tarafında hazır)

- **Yaz-yalnız kapı:** intake yalnızca talep oluşturur; okuma/listeleme/silme yok.
- **Token hash'li**, iptal/yenilenebilir, müşteri pasifleştirilebilir (`aktif=0`).
- **Hız sınırı:** token başına 8 / IP başına 20 gönderim / 15 dk (spam koruması).
- **Honeypot** gizli alan (basit botları eler). Girdi uzunlukları sınırlı; dosya yükleme yok (v1).
- **Bilgi sızmaz:** geçersiz/kapalı token nötr 404 döner.

## Henüz yapılmadı (sıradaki)

- Personel için **"Müşteriler" yönetim ekranı** (şu an CLI + `/api/musteriler`). 
- Talebe personel yanıtı → müşteriye e-posta bildirimi.
- İsteğe bağlı: müşterinin kendi geçmiş taleplerini görmesi (token ile, yalnız kendi kayıtları).
