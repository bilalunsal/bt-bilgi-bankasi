@echo off
chcp 65001 >nul
title SITMS - Semak IT Management Systems
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs"

where node >nul 2>nul
if errorlevel 1 (
  echo HATA: Node.js bulunamadi. Lutfen https://nodejs.org LTS surumunu kurun.
  pause
  exit /b 1
)

rem Sunucu bagimliliklari yoksa yukle (express + cors)
if not exist "node_modules\express" (
  echo [Kurulum] Sunucu bagimliliklari yukleniyor...
  call npm install
)

if not exist "arayuz\dist\index.html" (
  echo.
  echo UYARI: arayuz\dist bulunamadi. Personel arayuzu bu sunucuda derlenmeli:
  echo        cd arayuz  ^&^&  npm install  ^&^&  npm run build
  echo veya kendi bilgisayarinizda derleyip arayuz\dist klasorunu buraya kopyalayin.
  echo.
)

echo Ana uygulama (personel / LAN) : http://localhost:8793
start "BT - Ana Uygulama (8793)" cmd /k node sunucu\server.js
timeout /t 2 >nul

echo Talep kapisi (musteri intake) : http://localhost:8795
start "BT - Talep Kapisi (8795)" cmd /k node sunucu\intake.js
timeout /t 2 >nul

echo.
echo Iki servis de acildi. Durdurmak icin ilgili pencereyi kapatin.
echo   Personel erisimi ( agdaki diger PC'ler): http://SUNUCU-IP-ADRESI:8793
echo   Musteri kapisini INTERNETE acmak icin  : docs\musteri-talep-kapisi.md
echo   (SADECE 8795 yayinlanir; 8793 ASLA disari acilmaz.)
timeout /t 8 >nul
