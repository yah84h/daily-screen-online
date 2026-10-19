import { useState } from 'react';
import { ArrowUpRight, Copy, Monitor, Trash2, Upload, X } from 'lucide-react';
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
  return (
    <>
      <div className="modal-symbol">
        <Monitor />
      </div>
      <h2>ربط تلفزيون</h2>
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
      <button disabled={busy || code.length !== 6 || !data} className="button primary" onClick={() => run(() => api.pairDevice(code, data!.screen.id, label || undefined), 'تم ربط الشاشة. ستظهر المحتوى خلال ثوانٍ.').then(() => setModal('setup'))}>
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
  const { data, chooseImage, run, busy } = useAdmin();
  const [name, setName] = useState(data?.school.name || '');
  const [tagline, setTagline] = useState(data?.school.tagline || '');
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
      <p>
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
