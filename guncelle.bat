@echo off
chcp 65001 >nul
title SITMS - Guncelle
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs"

rem === GitHub deposu (kendi kullanici/repo adinizla degistirin) ===
set "REPO=bilalunsal/bt-bilgi-bankasi"
set "DAL=main"
set "ZIPURL=https://codeload.github.com/%REPO%/zip/refs/heads/%DAL%"

echo Guncelleme kontrol ediliyor: %REPO% (%DAL%)
echo.
echo Not: db\ (veritabani) ve ekler\ (dosyalar) KORUNUR, ustune yazilmaz.
echo.

echo [1/4] Indiriliyor...
rem Eski Windows sunucularda TLS 1.2 varsayilan degil -> once acilir (yoksa SSL/TLS hatasi)
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri '%ZIPURL%' -OutFile '%TEMP%\btbb.zip' -UseBasicParsing } catch { exit 1 }"
if errorlevel 1 ( echo HATA: Indirme basarisiz. Internet / repo adresini kontrol edin. & pause & exit /b 1 )

echo [2/4] Aciliyor...
if exist "%TEMP%\btbb_x" rmdir /s /q "%TEMP%\btbb_x"
powershell -NoProfile -Command "Expand-Archive -Path '%TEMP%\btbb.zip' -DestinationPath '%TEMP%\btbb_x' -Force"

rem GitHub zip'i tek klasore acar: <repo>-<dal>
for /d %%D in ("%TEMP%\btbb_x\*") do set "KAYNAK=%%D"

echo [3/4] Dosyalar guncelleniyor (db, ekler, node_modules KORUNUYOR)...
robocopy "%KAYNAK%" "%CD%" /E /XD db ekler node_modules _yedekler .git "arayuz\node_modules" /XF .env license.json >nul

echo [4/4] Bagimliliklar kontrol ediliyor...
call npm install --omit=dev >nul 2>nul

del "%TEMP%\btbb.zip" 2>nul
rmdir /s /q "%TEMP%\btbb_x" 2>nul

echo.
echo ============================================
echo  Guncelleme tamamlandi.
echo  Sunucuyu yeniden baslatin: sunucu-baslat.bat
echo ============================================
echo.
pause
