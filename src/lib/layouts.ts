export const layouts = [
    { name: 'أخضر هادئ', description: 'نص وصورة متوازنان', patch: { background: '#e9eee8', color: '#193e35', accent: '#126952', textX: 49, textY: 30, textW: 45, imageX: 6, imageY: 21, imageW: 38, imageH: 64, fontSize: 100 } },
    { name: 'أزرق المعرفة', description: 'لمسة أكاديمية', patch: { background: '#e6eef9', color: '#152d53', accent: '#326ed5', textX: 49, textY: 30, textW: 45, imageX: 6, imageY: 21, imageW: 38, imageH: 64, fontSize: 100 } },
    { name: 'دفء الرمل', description: 'ألوان سعودية دافئة', patch: { background: '#f3eadc', color: '#593f2b', accent: '#99632f', textX: 49, textY: 29, textW: 45, imageX: 6, imageY: 21, imageW: 38, imageH: 64, fontSize: 100 } },
    { name: 'ليل بنفسجي', description: 'تباين واضح من بعيد', patch: { background: '#23213c', color: '#faf6ff', accent: '#c1acf8', textX: 49, textY: 30, textW: 45, imageX: 6, imageY: 21, imageW: 38, imageH: 64, fontSize: 100 } },
    { name: 'الصورة أولًا', description: 'مساحة أكبر للصور', patch: { background: '#f7f5ef', color: '#24352c', accent: '#7d8d52', textX: 65, textY: 30, textW: 30, imageX: 5, imageY: 21, imageW: 55, imageH: 64, fontSize: 78 } },
    { name: 'رسالة كبيرة', description: 'الكلمات في المقدمة', patch: { background: '#f8e8d9', color: '#5b2f21', accent: '#ba653d', textX: 36, textY: 28, textW: 59, imageX: 5, imageY: 28, imageW: 26, imageH: 52, fontSize: 115 } },
    { name: 'نافذة مضيئة', description: 'صورة على اليمين', patch: { background: '#e5f1ed', color: '#174b43', accent: '#248875', textX: 6, textY: 30, textW: 40, imageX: 51, imageY: 22, imageW: 43, imageH: 63, fontSize: 95 } },
    { name: 'إعلان نظيف', description: 'تصميم دون صورة', patch: { background: '#f8f8f5', color: '#202d28', accent: '#b07935', textX: 12, textY: 29, textW: 76, imageW: 0, imageH: 0, fontSize: 115, align: 'center' } },
    { name: 'ورد الصباح', description: 'رسائل ودّية', patch: { background: '#f6e6eb', color: '#643d4d', accent: '#b75b7e', textX: 49, textY: 30, textW: 45, imageX: 6, imageY: 21, imageW: 38, imageH: 64, fontSize: 100 } },
    { name: 'ذهبي رسمي', description: 'إعلانات ومناسبات', patch: { background: '#142c29', color: '#f9efd3', accent: '#dfbd76', textX: 49, textY: 30, textW: 45, imageX: 6, imageY: 21, imageW: 38, imageH: 64, fontSize: 100 } }
];
// Geometry only: these never replace a school's chosen colors, identity or images.
export const arrangementLayouts = [
    { name: 'متوازن · الصورة يسار', description: 'النص يمين والصورة يسار', patch: { textX: 49, textY: 30, textW: 45, imageX: 6, imageY: 21, imageW: 38, imageH: 64, fontSize: 100, align: 'right' } },
    { name: 'متوازن · الصورة يمين', description: 'نفس التوازن باتجاه معاكس', patch: { textX: 6, textY: 30, textW: 40, imageX: 51, imageY: 21, imageW: 43, imageH: 64, fontSize: 95, align: 'right' } },
    { name: 'الصورة بطلة المشهد', description: 'صورة كبيرة ورسالة جانبية', patch: { textX: 67, textY: 30, textW: 28, imageX: 5, imageY: 21, imageW: 57, imageH: 64, fontSize: 75, align: 'right' } },
    { name: 'رسالة بارزة', description: 'نص أكبر وصورة جانبية صغيرة', patch: { textX: 37, textY: 28, textW: 57, imageX: 6, imageY: 28, imageW: 26, imageH: 52, fontSize: 110, align: 'right' } },
    { name: 'الصورة بالأعلى', description: 'صورة عريضة والتعليق أسفلها', patch: { textX: 8, textY: 57, textW: 84, imageX: 6, imageY: 19, imageW: 88, imageH: 33, fontSize: 70, spacing: .6, align: 'center' } },
    { name: 'الصورة بالأسفل', description: 'رسالة فوق شريط الصور', patch: { textX: 8, textY: 24, textW: 84, imageX: 6, imageY: 60, imageW: 88, imageH: 25, fontSize: 70, spacing: .6, align: 'center' } },
    { name: 'رسالة في المنتصف', description: 'الكلمات وحدها دون صورة', patch: { textX: 12, textY: 28, textW: 76, imageX: 6, imageY: 21, imageW: 0, imageH: 0, fontSize: 110, align: 'center' } },
    { name: 'صورة مربعة', description: 'صورة مدمجة ومساحة أوسع للنص', patch: { textX: 48, textY: 28, textW: 46, imageX: 8, imageY: 26, imageW: 32, imageH: 57, fontSize: 95, align: 'right' } }
];

