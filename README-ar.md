# الشاشة اليومية — النسخة الأونلاين

لوحة إدارة من أي مكان + صفحة تلفزيون تُربط برمز من 6 أرقام. بلا خادم Node: الواجهة على Netlify، والبيانات والصور والمصادقة على Supabase.

## الهيكل

```
src/
  lib/        supabase.ts (العميل) · api.ts (كل العمليات) · media.ts (ضغط ورفع الصور)
              offline.ts (IndexedDB للتلفزيون) · auth.tsx · types.ts
  components/ Screen.tsx — العرض المشترك (المعاينة، القالب، التلفزيون)
  pages/      Login.tsx · Tv.tsx · admin/ (Admin, store, HomeTab, PresetsTab, ScheduleTab, TemplateTab, HistoryTab, Modals)
supabase/migrations/   0001_init.sql (الجداول + RLS + دوال الربط) · 0002_seed.sql (البذور)
scripts/import-legacy.mjs   ترحيل state.json والصور من النسخة المحلية
netlify.toml
```

## الإعداد (مرة واحدة)

### 1) Supabase
1. أنشئ مشروعًا جديدًا على supabase.com.
2. من **SQL Editor** نفّذ `supabase/migrations/0001_init.sql` ثم `0002_seed.sql` بالترتيب.
   (أو عبر CLI: `supabase db push`.)
3. **Authentication → Providers → Email**: عطّل **Enable sign ups** (التسجيل الذاتي). هذا المشروع لمدرسة واحدة: أي حساب مسجّل = مسؤول.
4. **Authentication → Users → Add user**: أنشئ حساب المسؤول (بريد + كلمة مرور، مع تفعيل Auto Confirm).
5. من **Project Settings → API** انسخ `Project URL` و`anon public key`.

### 2) محليًا
```bash
npm install
cp .env.example .env     # وضع المفاتيح فيه
npm run dev
```
- اللوحة: http://localhost:5173/admin
- التلفزيون: http://localhost:5173/tv

### 3) Netlify
1. اربط المستودع (أو اسحب مجلد المشروع).
2. Build command: `npm run build` · Publish directory: `dist` (موجودة في `netlify.toml`).
3. **Site settings → Environment variables**: أضف `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY`.
4. انشر. HTTPS ضروري لعمل Service Worker وملء الشاشة.

## ربط التلفزيون
1. افتح `https://موقعك/tv` على التلفزيون واضغط F11.
2. يظهر رمز من 6 أرقام (صالح لساعة).
3. من اللوحة: **إعداد الشاشة → ربط تلفزيون** وأدخل الرمز.
4. يعرض التلفزيون المحتوى فورًا، ويحتفظ بآخر نسخة عند انقطاع الإنترنت.
5. على التلفزيون: اضغط **S** أو انقر نقرًا مزدوجًا لعرض الحالة أو إلغاء الربط.

## ترحيل بيانات النسخة المحلية
```bash
SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/import-legacy.mjs /path/to/Daily-Screen-Arabic-v6
```
ينقل القالب والمسودة والمواضيع والسجل والجدولة والصور. الصور الأكبر من 5MB تُتجاوز (ارفعها من اللوحة ليُضغط حجمها). مفتاح `service_role` سرّي ولا يوضع في المتصفح أو Netlify.

## كيف تعمل الجدولة بلا Cron
لا يوجد عمود «حالة». كل منشور له `publish_at` (تاريخ). الشاشة تعرض دائمًا **أحدث منشور تاريخه ≤ اليوم بتوقيت الرياض**. المجدول = تاريخه في المستقبل. السجل = تاريخه في الماضي أو اليوم.

## التحديث الفوري
بعد كل نشر تبث اللوحة رسالة على قناة Realtime `screen:<id>`، والتلفزيون يعيد القراءة فورًا، مع استطلاع احتياطي كل 30 ثانية (يغطي انتقال منتصف الليل).

## الأمان
- RLS مفعّل على كل الجداول. المجهول (anon) لا يقرأ أي جدول مباشرة؛ التلفزيون يمرّ عبر دالتي `request_pairing` و`get_screen_by_token` فقط.
- حاوية `media` عامة القراءة (الشاشة تحتاجها بلا تسجيل دخول)، الرفع والحذف للمسجّلين فقط، حد 5MB وأنواع JPG/PNG/WEBP.
- حذف جهاز من «الأجهزة المربوطة» يُلغي وصوله فورًا.

## ما يلي (المرحلة 5)
عدة شاشات، تاريخ هجري، تنظيف الصور غير المستخدمة، دعوة مسؤولين إضافيين.
