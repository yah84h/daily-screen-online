import { useState } from 'react';
import { ArrowUpRight, Copy, Monitor, Plus, Trash2, Upload, X, Eraser, Check } from 'lucide-react';
import { Screen } from '@/components/Screen';
import * as api from '@/lib/api';
import { riyadhToday, type Content } from '@/lib/types';
import { useAdmin } from './store';

const optionalRows: [keyof Content, string][] = [
  ['showSubtitle', 'العنوان الفرعي'],
  ['showBadge', 'شارة الإعلان'],
  ['showFooter', 'التذييل'],
  ['showSecondary', 'الصورة الإضافية'],
  ['showQR', 'رمز QR'],
];

export function Modals() {
  const { modal, setModal } = useAdmin();
  if (!modal) return null;
  return (
    <div className="modal-backdrop" onClick={() => setModal('')}>
      <div className={'modal ' + (modal === 'preview' ? 'wide' : '')} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close icon-button" aria-label="إغلاق" onClick={() => setModal('')}>
          <X size={20} />
        </button>
        {modal === 'preview' && <Preview />}
        {modal === 'pair' && <Pair />}
        {modal === 'schedule' && <ScheduleModal />}
        {modal === 'preset' && <PresetModal />}
        {modal === 'optional' && <Optional />}
        {modal === 'settings' && <SettingsModal />}
        {modal === 'setup' && <Setup />}
      </div>
    </div>
  );
}

function Preview() {
  const { content, template, data } = useAdmin();
  return (
    <>
      <h2>معاينة الشاشة</h2>
      <Screen content={content} template={template} school={data?.school} />
      <p>3840 × 2160 · 16:9 · توقيت الرياض</p>
      <a className="button primary" href="/tv" target="_blank">
        فتح صفحة التلفزيون <ArrowUpRight size={16} />
      </a>
    </>
  );
}

function Pair() {
  const { data, run, busy, setModal } = useAdmin();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [screenId, setScreenId] = useState(data?.screen.id || '');
  return (
    <>
      <div className="modal-symbol">
        <Monitor />
      </div>
      <h2>ربط تلفزيون</h2>
      {data && data.screens.length > 1 && (
        <label>
          الشاشة
          <select value={screenId} onChange={(e) => setScreenId(e.target.value)}>
            {data.screens.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <p>
        افتح <b dir="ltr">{location.origin}/tv</b> على التلفزيون، ثم أدخل الرمز المكوّن من ستة أرقام الظاهر عليه.
      </p>
      <label>
        رمز الشاشة
        <input inputMode="numeric" dir="ltr" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
      </label>
      <label>
        اسم الجهاز <small>اختياري</small>
        <input placeholder="تلفزيون البهو" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <button disabled={busy || code.length !== 6 || !data} className="button primary" onClick={() => run(() => api.pairDevice(code, screenId || data!.screen.id, label || undefined), 'تم ربط الشاشة. ستظهر المحتوى خلال ثوانٍ.').then(() => setModal('setup'))}>
        ربط الشاشة
      </button>
    </>
  );
}

function ScheduleModal() {
  const { content, data, run, busy } = useAdmin();
  const [date, setDate] = useState('');
  return (
    <>
      <h2>جدولة شاشة</h2>
      <p>ستُعرض مسودة اليوم عند منتصف الليل بتوقيت الرياض في اليوم الذي تختاره.</p>
      <div className="schedule-subject">{content.title || '— بلا عنوان —'}</div>
      <label>
        تاريخ النشر
        <input type="date" min={riyadhToday()} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <button className="button primary" disabled={!date || busy || !data || !content.title.trim()} onClick={() => run(() => api.schedulePost(data!.screen.id, content, date), 'تم حفظ الموعد.')}>
        حفظ الموعد
      </button>
    </>
  );
}

function PresetModal() {
  const { content, edit, run, busy, presetName, setPresetName, editingPreset } = useAdmin();
  return (
    <>
      <h2>{editingPreset ? 'تعديل الموضوع' : 'حفظ موضوع'}</h2>
      <p>احفظ العنوان والنص والصورة لاستخدامها في يوم آخر.</p>
      <label>
        اسم الموضوع
        <input value={presetName} onChange={(e) => setPresetName(e.target.value)} />
      </label>
      <label>
        العنوان
        <input value={content.title} onChange={(e) => edit('title', e.target.value)} />
      </label>
      <label>
        العنوان الفرعي
        <input value={content.subtitle} onChange={(e) => edit('subtitle', e.target.value)} />
      </label>
      <label>
        الرسالة
        <textarea rows={3} value={content.body} onChange={(e) => edit('body', e.target.value)} />
      </label>
      <button className="button primary" disabled={!presetName.trim() || busy} onClick={() => run(() => api.savePreset(presetName, content, editingPreset), 'تم حفظ الموضوع.')}>
        حفظ الموضوع
      </button>
    </>
  );
}

function Optional() {
  const { content, edit, chooseImage, setModal } = useAdmin();
  return (
    <>
      <h2>اللمسات الأخيرة</h2>
      <p>اختر العناصر التي تظهر على الشاشة.</p>
      {optionalRows.map(([key, label]) => (
        <div className="option-row" key={key}>
          <span>{label}</span>
          <button className={'toggle ' + (content[key] ? 'on' : '')} role="switch" aria-checked={!!content[key]} aria-label={label} onClick={() => edit(key, !content[key])}>
            <i />
          </button>
        </div>
      ))}
      {content.showBadge && (
        <label>
          الشارة
          <select value={content.badge} onChange={(e) => edit('badge', e.target.value)}>
            {['موضوع اليوم', 'مهم', 'تذكير', 'اليوم', 'فعالية'].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
      )}
      {content.showFooter && (
        <label>
          نص التذييل
          <input value={content.footer} onChange={(e) => edit('footer', e.target.value)} />
        </label>
      )}
      {content.showSecondary && (
        <button className="button white" onClick={() => chooseImage('secondary')}>
          رفع صورة إضافية
        </button>
      )}
      {content.showQR && (
        <button className="button white" onClick={() => chooseImage('qr')}>
          رفع صورة رمز QR
        </button>
      )}
      <button className="button primary" onClick={() => setModal('')}>
        تم
      </button>
    </>
  );
}

function SettingsModal() {
  const { data, chooseImage, run, busy, template, selectScreen, notify } = useAdmin();
  const [name, setName] = useState(data?.school.name || '');
  const [tagline, setTagline] = useState(data?.school.tagline || '');
  const [newScreen, setNewScreen] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  return (
    <>
      <h2>إعدادات المدرسة</h2>
      <label>
        اسم المدرسة
        <input maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        الشعار النصي
        <input maxLength={80} value={tagline} onChange={(e) => setTagline(e.target.value)} />
      </label>
      <label>
        شعار المدرسة
        <button className="button white" onClick={() => chooseImage('schoolLogo')}>
          <Upload size={16} />
          {data?.school.logo_url ? 'تغيير الشعار' : 'رفع الشعار'}
        </button>
      </label>
      <button className="button primary" disabled={busy || !name.trim()} onClick={() => run(() => api.saveSchool({ name: name.trim(), tagline: tagline.trim() }), 'تم حفظ الإعدادات.')}>
        حفظ
      </button>
      <h2 style={{ marginTop: 28 }}>الشاشات</h2>
      <p>لكل شاشة محتواها وقالبها وأجهزتها. تُربط أجهزة التلفزيون بالشاشة المطلوبة عند الربط.</p>
      <div className="screen-list">
        {data?.screens.map((s) => (
          <div className="list-row" key={s.id}>
            {renaming?.id === s.id ? (
              <>
                <input autoFocus value={renaming.name} onChange={(e) => setRenaming({ id: s.id, name: e.target.value })} />
                <button className="icon-button" aria-label="حفظ" onClick={() => run(() => api.renameScreen(s.id, renaming.name), 'تمت إعادة التسمية.').then(() => setRenaming(null))}>
                  <Check size={16} />
                </button>
              </>
            ) : (
              <>
                <span>
                  <b>{s.name}</b>
                  <small>{s.id === data.screen.id ? 'الشاشة الحالية' : ''}</small>
                </span>
                <button className="text-button" onClick={() => setRenaming({ id: s.id, name: s.name })}>
                  تسمية
                </button>
                {s.id !== data.screen.id && (
                  <button className="text-button" onClick={() => selectScreen(s.id)}>
                    تحديد
                  </button>
                )}
                <button className="icon-button" aria-label="حذف الشاشة" onClick={() => confirm(`حذف «${s.name}» مع كل منشوراتها وأجهزتها؟`) && run(() => api.deleteScreen(s.id), 'تم حذف الشاشة.')}>
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="list-row" style={{ borderBottom: 0 }}>
        <input placeholder="اسم شاشة جديدة (مثال: شاشة المعلمين)" value={newScreen} onChange={(e) => setNewScreen(e.target.value)} style={{ flex: 1, padding: '9px 10px', border: '1px solid #d6e0d8', borderRadius: 8 }} />
        <button
          className="button white"
          disabled={busy || !newScreen.trim()}
          onClick={() =>
            run(() => api.createScreen(newScreen, template), 'تمت إضافة الشاشة.').then((s) => {
              if (s) {
                setNewScreen('');
                selectScreen(s.id);
              }
            })
          }
        >
          <Plus size={15} /> إضافة
        </button>
      </div>

      <h2 style={{ marginTop: 28 }}>التخزين</h2>
      <p>يحذف الصور المرفوعة التي لم تعد مستخدمة في أي منشور أو موضوع أو قالب.</p>
      <button
        className="button white"
        disabled={busy}
        onClick={() => confirm('حذف الصور غير المستخدمة نهائيًا؟') && run(() => api.cleanupMedia()).then((r) => r && notify(`حُذفت ${r.deleted} صورة، وبقيت ${r.kept} مستخدمة.`))}
      >
        <Eraser size={15} /> تنظيف الصور غير المستخدمة
      </button>
      <p style={{ marginTop: 18 }}>
        المنطقة الزمنية: الرياض
        <br />
        دقة العرض: 4K UHD
      </p>
    </>
  );
}

function Setup() {
  const { data, setModal, run, notify } = useAdmin();
  const tvURL = location.origin + '/tv';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tvURL);
      notify('تم نسخ رابط التلفزيون');
    } catch {
      notify('حدّد الرابط وانسخه يدويًا');
    }
  };
  return (
    <>
      <h2>إعداد التلفزيون</h2>
      <div className="admin-link-card">
        <b>رابط صفحة التلفزيون</b>
        <input aria-label="رابط التلفزيون" dir="ltr" readOnly value={tvURL} onFocus={(e) => e.target.select()} />
        <button className="button white" onClick={copy}>
          <Copy size={16} />
          نسخ الرابط
        </button>
      </div>
      <ol>
        <li>افتح الرابط أعلاه في متصفح التلفزيون (أو جهاز متصل به) واضغط F11 لملء الشاشة.</li>
        <li>سيظهر رمز من ستة أرقام. اضغط «ربط تلفزيون» وأدخله.</li>
        <li>اترك الصفحة مفتوحة، وانشر التحديثات من هاتفك من أي مكان.</li>
      </ol>
      <p>اضغط S على لوحة مفاتيح التلفزيون (أو انقر نقرًا مزدوجًا) لعرض حالة الاتصال.</p>
      <button className="button primary" onClick={() => setModal('pair')}>
        <Monitor size={16} /> ربط تلفزيون
      </button>
      {!!data?.devices.length && (
        <div className="device-list">
          <b>الأجهزة المربوطة</b>
          {data.devices.map((d) => {
            const online = d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 90_000;
            return (
              <div className="list-row" key={d.token}>
                <span>
                  <b>{d.label || 'تلفزيون'}</b>
                  <small>{online ? 'متصل الآن' : d.last_seen_at ? 'آخر ظهور: ' + new Date(d.last_seen_at).toLocaleString('ar-SA-u-ca-gregory', { timeZone: 'Asia/Riyadh' }) : 'لم يتصل بعد'}</small>
                </span>
                <button className="icon-button" aria-label="إلغاء الربط" onClick={() => confirm('إلغاء ربط هذا الجهاز؟') && run(() => api.unpairDevice(d.token), 'تم إلغاء الربط.')}>
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
