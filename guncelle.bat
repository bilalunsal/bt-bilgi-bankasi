@echo off
chcp 65001 >nul
title SITMS - Guncelle
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs"

rem === GitHub deposu (kendi kullanici/repo adinizla degistirin) ===
set "REPO=bilalunsal/bt-bilgi-bankasi"
set "DAL=main"
set "ZIPURL=https://codeload.github.com/%REPO%/zip/refs/heads/%DAL%"
set "VERURL=https://raw.githubusercontent.com/%REPO%/%DAL%/version.json"

echo Guncelleme kontrol ediliyor: %REPO% (%DAL%)
echo.
echo Not: db\ (veritabani) ve ekler\ (dosyalar) KORUNUR, ustune yazilmaz.
echo.

echo [1/5] Surum kontrol ediliyor...
rem GitHub'daki version.json ile yereldeki karsilastirilir (yapim no). Esitse bosuna indirmeyiz.
powershell -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $u=(Invoke-WebRequest -Uri '%VERURL%' -UseBasicParsing -TimeoutSec 15).Content | ConvertFrom-Json; $l=Get-Content 'version.json' -Raw | ConvertFrom-Json; if([int]$u.yapim -le [int]$l.yapim){ Write-Host ('  Zaten guncel: surum '+$l.version+' (yapim '+$l.yapim+'). Indirme atlandi.'); exit 10 } else { Write-Host ('  Guncelleme mevcut: '+$l.version+' (yapim '+$l.yapim+') -> '+$u.version+' (yapim '+$u.yapim+')'); exit 0 } } catch { Write-Host '  Surum kontrol edilemedi; yine de devam ediliyor...'; exit 0 }"
if errorlevel 10 ( echo. & pause & exit /b 0 )

echo [2/5] Indiriliyor...
rem Eski Windows sunucularda TLS 1.2 varsayilan degil -> once acilir (yoksa SSL/TLS hatasi)
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri '%ZIPURL%' -OutFile '%TEMP%\btbb.zip' -UseBasicParsing } catch { exit 1 }"
if errorlevel 1 ( echo HATA: Indirme basarisiz. Internet / repo adresini kontrol edin. & pause & exit /b 1 )

echo [3/5] Aciliyor...
if exist "%TEMP%\btbb_x" rmdir /s /q "%TEMP%\btbb_x"
powershell -NoProfile -Command "Expand-Archive -Path '%TEMP%\btbb.zip' -DestinationPath '%TEMP%\btbb_x' -Force"

rem GitHub zip'i tek klasore acar: <repo>-<dal>
for /d %%D in ("%TEMP%\btbb_x\*") do set "KAYNAK=%%D"

echo [4/5] Dosyalar guncelleniyor (db, ekler, node_modules KORUNUYOR)...
robocopy "%KAYNAK%" "%CD%" /E /XD db ekler node_modules _yedekler .git "arayuz\node_modules" /XF .env license.json >nul

echo [5/5] Bagimliliklar kontrol ediliyor...
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
