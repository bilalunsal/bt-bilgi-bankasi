@echo off
chcp 65001 >nul
title SITMS - Semak IT Management Systems
cd /d "%~dp0"
rem Node PATH'te olmasa bile calissin diye standart kurulum yolunu ekle
set "PATH=%PATH%;C:\Program Files\nodejs"

where node >nul 2>nul
if errorlevel 1 (
  echo HATA: Node.js bulunamadi. Lutfen https://nodejs.org adresinden kurun.
  pause
  exit /b 1
)

rem Arayuz derlenmemisse ilk sefer derle
if not exist "arayuz\dist\index.html" (
  echo [Ilk kurulum] Arayuz derleniyor, birkac dakika surebilir...
  if not exist "arayuz\node_modules" (
    pushd arayuz
    call npm install
    popd
  )
  pushd arayuz
  call npm run build
  popd
)

echo.
echo Sunucu baslatiliyor: http://localhost:8793
echo (Durdurmak icin acilan kucuk "Sunucu" penceresini kapatin.)
start "BT Bilgi Bankasi - Sunucu" cmd /k node sunucu\server.js
timeout /t 3 >nul
start "" http://localhost:8793
timeout /t 3 >nul
