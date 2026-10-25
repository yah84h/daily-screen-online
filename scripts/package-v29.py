from pathlib import Path
import shutil,zipfile,os
repo=Path(__file__).resolve().parents[1];out=repo.parent
for platform in ('Mac','Windows'):
 dest=out/f'Daily-Screen-v29-{platform}'
 if dest.exists():shutil.rmtree(dest)
 shutil.copytree(repo/'dist-local',dest)
 for p in dest.glob('*.bat' if platform=='Mac' else '*.command'):p.unlink()
 for p in dest.glob('*.command'):p.chmod(0o755)
 shutil.copy(repo/'docs/V29-ar.md',dest/'الجديد-٢٩.md')
 readme=(repo/'local-test/اقرأني.txt').read_text()
 readme+=('\nهذه حزمة Windows. شغّل Start-Windows.bat. عند طلب الجدار الناري اسمح لـ Node على الشبكة الخاصة. لم يُشغّل ملف BAT داخل Windows في هذه البيئة؛ الخادم والواجهة المشتركة اختُبرا.\n' if platform=='Windows' else '\nهذه حزمة Mac. شغّل Start-Mac.command. إذا تعذر فتحه شغّل node server.mjs --lan --open من Terminal داخل المجلد.\n')
 (dest/'اقرأني.txt').write_text(readme,encoding='utf-8-sig' if platform=='Windows' else 'utf-8')
 assert not (dest/'data').exists()
 with zipfile.ZipFile(out/f'{dest.name}.zip','w',zipfile.ZIP_DEFLATED) as z:
  for p in dest.rglob('*'):
   if p.is_file():z.write(p,p.relative_to(out))
with zipfile.ZipFile(out/'Daily-Screen-v29-Source.zip','w',zipfile.ZIP_DEFLATED) as z:
 for folder,dirs,files in os.walk(repo):
  dirs[:]=[d for d in dirs if d not in {'.git','node_modules','dist','dist-local','.netlify','data','__pycache__'}]
  for name in files:
   if name=='.DS_Store' or name.endswith('.tsbuildinfo') or(name.startswith('.env') and name!='.env.example'):continue
   p=Path(folder)/name;z.write(p,Path('Daily-Screen-v29-Source')/p.relative_to(repo))
for suffix in ('Mac','Windows','Source'):
 p=out/f'Daily-Screen-v29-{suffix}.zip'
 with zipfile.ZipFile(p) as z:
  assert z.testzip() is None
  assert not any('/data/' in n or n.endswith('/.env') or n.endswith('/staff.json') or n.endswith('/setup-code.json') for n in z.namelist())
  if suffix!='Source':
   assert any(n.endswith('/accounts.mjs') for n in z.namelist())
   assert any(n.endswith('/headlines.mjs') for n in z.namelist())
   assert any(n.endswith('/bootstrap-account.mjs') for n in z.namelist())
  else:
   assert any(n.endswith('/0007_first_login.sql') for n in z.namelist())
   assert any(n.endswith('/netlify/functions/tech-news.mjs') for n in z.namelist())
 print(p,p.stat().st_size)
