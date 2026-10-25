from pathlib import Path
import shutil,zipfile,os
repo=Path(__file__).resolve().parents[1];out=repo.parent
for platform in ('Mac','Windows'):
 dest=out/f'Daily-Screen-v27-{platform}'
 if dest.exists():shutil.rmtree(dest)
 shutil.copytree(repo/'dist-local',dest)
 for p in dest.glob('*.bat' if platform=='Mac' else '*.command'):p.unlink()
 for p in dest.glob('*.command'):p.chmod(0o755)
 shutil.copy(repo/'docs/V27-ar.md',dest/'الجديد-٢٧.md')
 if platform=='Windows':
  (dest/'اقرأني.txt').write_text('''الشاشة اليومية — Windows، الإصدار ٢٧

١. ثبّت Node.js 22 أو 24 LTS من https://nodejs.org على الحاسوب فقط.
٢. فك ضغط المجلد كاملًا. انسخ مجلد data القديم إلى هذا المجلد قبل التشغيل إذا كنت ترقي.
٣. افتح Start-Windows.bat، واسمح لـ Node على شبكة المدرسة الخاصة في Windows Firewall إذا طلب ذلك.
٤. يفتح عنوان الإدارة الرقمي، مثل http://192.168.1.20:8080/admin. افتح /display على التلفزيون وفعّل ملء الشاشة أو F11.
٥. الهاتف يجب أن يكون على الشبكة نفسها؛ استخدم عنوان IP المطبوع في نافذة التشغيل.
٦. الأخبار: افتح /news على نفس العنوان. رمز نشر المعلمين مطبوع في نافذة التشغيل بجانب Staff PIN؛ شاركه مع المصرح لهم فقط.
٧. اترك نافذة الخادم مفتوحة. للإيقاف اضغط Control+C.

أخبار المدرسة محفوظة لكل شاشة، والأخبار التقنية من GitHub API الرسمي تتطلب الإنترنت للتحديث وتبقى آخر بيانات محفوظة عند الانقطاع. تتضمن الحزمة ٢٥ لوحة ألوان والاسم الجديد وكل ميزات الإصدار السابق. راجع الجديد-٢٧.md.

لا تحذف مجلد data عند الترقية. لوحة الإدارة المحلية القديمة لا تتطلب تسجيل دخول، وتُستخدم فقط على شبكة المدرسة الموثوقة. رمز الأخبار يحمي نشر الأخبار عبر صفحتها ولا يحوّل الإدارة المحلية إلى نظام حسابات.

لم يُشغّل BAT في Windows داخل البيئة السحابية، لكن واجهة التطبيق والخادم المحلي اختُبرا. لم يُرفع شيء إلى GitHub.
''',encoding='utf-8-sig')
 assert not (dest/'data').exists()
 with zipfile.ZipFile(out/f'{dest.name}.zip','w',zipfile.ZIP_DEFLATED) as z:
  for p in dest.rglob('*'):
   if p.is_file():z.write(p,p.relative_to(out))
source=out/'Daily-Screen-v27-Source.zip';skip={'.git','node_modules','dist','dist-local','.netlify','data','__pycache__'}
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED) as z:
 for folder,dirs,files in os.walk(repo):
  dirs[:]=[d for d in dirs if d not in skip]
  for name in files:
   if name=='.DS_Store' or name.endswith('.tsbuildinfo') or (name.startswith('.env') and name!='.env.example'):continue
   p=Path(folder)/name;z.write(p,Path('Daily-Screen-v27-Source')/p.relative_to(repo))
for suffix in ('Mac','Windows','Source'):
 p=out/f'Daily-Screen-v27-{suffix}.zip'
 with zipfile.ZipFile(p) as z:
  assert z.testzip() is None
  assert not any('/data/' in n or n.endswith('/.env') or n.endswith('/news-access.json') for n in z.namelist())
 print(p,p.stat().st_size)
