@echo off
chcp 65001 >nul
rem يضيف شاشة التلفزيون إلى بدء تشغيل Windows (تعمل تلقائيًا بعد تسجيل الدخول)
set "SRC=%~dp0Start-TV-Silent.vbs"
set "DST=%AppData%\Microsoft\Windows\Start Menu\Programs\Startup\DailyScreenTV.vbs"
copy /y "%SRC%" "%DST%" >nul && (
  echo تمت الإضافة إلى بدء التشغيل. ستفتح الشاشة تلقائيًا عند تشغيل الجهاز.
) || echo تعذّرت الإضافة.
pause
