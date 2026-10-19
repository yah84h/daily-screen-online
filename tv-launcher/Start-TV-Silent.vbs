' يشغّل Start-TV.bat دون إظهار نافذة سوداء — استخدم هذا الملف للتشغيل التلقائي
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c """ & dir & "\Start-TV.bat""", 0, False
