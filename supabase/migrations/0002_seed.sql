-- بذور: إعدادات المدرسة، الشاشة الرئيسية، المواضيع الافتراضية

insert into public.school_settings (id) values (1) on conflict do nothing;

insert into public.screens (id, name, template) values (
  '00000000-0000-0000-0000-000000000001',
  'شاشة البهو الرئيسية',
  '{"background":"#e9eee8","color":"#193e35","accent":"#126952","font":"Noto Sans Arabic","fontSize":100,"radius":8,"fit":"cover","imageX":6,"imageY":17,"imageW":38,"imageH":69,"textX":49,"textY":30,"textW":45,"spacing":1,"align":"right"}'::jsonb
) on conflict do nothing;

insert into public.presets (name, content, sort_order) values
  ('الأمن السيبراني', '{"title": "التوعية بالأمن السيبراني", "subtitle": "عادات بسيطة، حماية أكبر.", "body": "احمِ حساباتك، وفكّر قبل أن تضغط.\nحافظ على أمان عالمك الرقمي.", "badge": "موضوع اليوم", "footer": "تعلّم باستمرار، وتواصل بأمان.", "image": "/workspace.jpg", "secondary": "", "qr": "", "logo": "", "autoDate": true, "showSubtitle": true, "showFooter": true, "showBadge": true, "showSecondary": false, "showQR": false}'::jsonb, 0),
  ('المهارات الرقمية', '{"title": "طوّر مهاراتك الرقمية", "subtitle": "تعلّم شيئًا جديدًا كل يوم.", "body": "اكتشف أدوات جديدة، وأبدع بثقة.", "badge": "موضوع اليوم", "footer": "تعلّم باستمرار، وتواصل بأمان.", "image": "/workspace.jpg", "secondary": "", "qr": "", "logo": "", "autoDate": true, "showSubtitle": true, "showFooter": true, "showBadge": true, "showSecondary": false, "showQR": false}'::jsonb, 1),
  ('إعلان مدرسي', '{"title": "يوم جديد وفرص جديدة", "subtitle": "مدرستك، مجتمعك.", "body": "تعرّف مع معلميك على أخبار اليوم.", "badge": "موضوع اليوم", "footer": "تعلّم باستمرار، وتواصل بأمان.", "image": "/workspace.jpg", "secondary": "", "qr": "", "logo": "", "autoDate": true, "showSubtitle": true, "showFooter": true, "showBadge": true, "showSecondary": false, "showQR": false}'::jsonb, 2),
  ('رسالة الصباح', '{"title": "اجعل ليومك أثرًا", "subtitle": "بداية جديدة معًا.", "body": "كن لطيفًا، واسأل، وجرّب شيئًا جديدًا.", "badge": "موضوع اليوم", "footer": "تعلّم باستمرار، وتواصل بأمان.", "image": "/workspace.jpg", "secondary": "", "qr": "", "logo": "", "autoDate": true, "showSubtitle": true, "showFooter": true, "showBadge": true, "showSecondary": false, "showQR": false}'::jsonb, 3),
  ('اليوم الوطني', '{"title": "نحتفل بوطننا", "subtitle": "معًا نبني المستقبل.", "body": "شاركنا الاحتفاء بثقافتنا ومجتمعنا.", "badge": "موضوع اليوم", "footer": "تعلّم باستمرار، وتواصل بأمان.", "image": "/workspace.jpg", "secondary": "", "qr": "", "logo": "", "autoDate": true, "showSubtitle": true, "showFooter": true, "showBadge": true, "showSecondary": false, "showQR": false}'::jsonb, 4),
  ('تذكير بالاختبارات', '{"title": "استعد، وركّز، وقدّم أفضل ما لديك.", "subtitle": "أنت قادر على النجاح.", "body": "راجع جدول اختباراتك واحضر في الموعد.", "badge": "موضوع اليوم", "footer": "تعلّم باستمرار، وتواصل بأمان.", "image": "/workspace.jpg", "secondary": "", "qr": "", "logo": "", "autoDate": true, "showSubtitle": true, "showFooter": true, "showBadge": true, "showSecondary": false, "showQR": false}'::jsonb, 5);
