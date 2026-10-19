@echo off
chcp 65001 >nul
setlocal
rem ============================================================
rem  الشاشة اليومية - تشغيل التلفزيون في وضع العرض فقط (Kiosk)
rem  غيّر الرابط التالي إلى رابط موقعك على Netlify ثم احفظ الملف
rem ============================================================
set "TV_URL=https://schoolpodcast.netlify.app/tv"

rem مجلد بيانات مستقل للمتصفح حتى لا يفتح تبويبات أو جلسات أخرى
set "PROFILE=%LocalAppData%\DailyScreenTV"

set "BROWSER="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if "%BROWSER%"=="" if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if "%BROWSER%"=="" if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if "%BROWSER%"=="" if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if "%BROWSER%"=="" (
  echo لم يُعثر على Microsoft Edge أو Google Chrome.
  pause
  exit /b 1
)


start "" "%BROWSER%" --kiosk "%TV_URL%" --edge-kiosk-type=fullscreen ^
  --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check ^
  --disable-pinch --overscroll-history-navigation=0 --disable-features=TranslateUI,msEdgeSidebar ^
  --disable-session-crashed-bubble --disable-infobars --noerrdialogs --autoplay-policy=no-user-gesture-required

exit /b 0
