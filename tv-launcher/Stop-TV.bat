@echo off
chcp 65001 >nul
rem يغلق نافذة شاشة العرض فقط (جلسة DailyScreenTV) دون المساس بمتصفح المستخدم
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*DailyScreenTV*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
echo تم إيقاف شاشة العرض.
timeout /t 2 >nul
