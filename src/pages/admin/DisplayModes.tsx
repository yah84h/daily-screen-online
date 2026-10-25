import {useAuth} from '@/lib/auth';
import {withDisplayMode} from '@/lib/slideshow';
import { Clock, Images, Image as ImageIcon, PanelsTopLeft, Upload, X } from 'lucide-react';
import { SlideshowEditor } from './SlideshowEditor';
import { useAdmin } from './store';
const modes = [['daily', 'المحتوى اليومي', 'رسالة وصورة بهوية المدرسة', PanelsTopLeft], ['media', 'صورة / فيديو فقط', 'ملء الشاشة دون أي عناصر', ImageIcon], ['slideshow', 'عرض شرائح الصور', 'صور متتابعة بملء الشاشة', Images], ['loop', 'خلفية الحصص', 'خلفية متحركة، ساعة وحصة', Clock]] as const;
export function DisplayModes() {
    const { template, setTemplate, saveDesign, busy, data } = useAdmin();
    return <><div className="mode-cards">{modes.map(([id, name, description, Icon]) => <button key={id} disabled={busy||!data} className={'mode-card ' + ((template.displayMode || 'daily') === id ? 'selected' : '')} onClick={() => setTemplate(t => withDisplayMode(t,id))}><span className="mode-icon"><Icon size={23}/></span><span><b>{name}</b><small>{description}</small></span><i /></button>)}</div><div className="mode-save"><span>اختَر الوضع ثم انشر من زر «نشر على الشاشة». زر التطبيق يغيّر الوضع والإعدادات فقط.</span><button className="button primary" disabled={busy || !data} onClick={saveDesign}>تطبيق وضع العرض</button></div></>;
}
export function FullMediaEditor() {
    const { content, edit, chooseImage, busy } = useAdmin();
    return <section className="full-media-editor"><h2>صورة / فيديو بملء الشاشة</h2><p className="field-hint">MP4 أو WEBM أو GIF متحرك، أو صورة PNG / JPG / WEBP. بلا حد حجم ثابت داخل التطبيق؛ حدود التخزين السحابي ومساحة الجهاز تظل مطبّقة.</p><button className="button white" disabled={busy} onClick={() => chooseImage('fullMedia')}><Upload size={18}/>{content.fullMedia ? 'تغيير الوسائط' : 'رفع صورة أو فيديو'}</button>{content.fullMedia && <><p className="field-hint">{content.fullType === 'video' ? 'الفيديو جاهز' : 'الصورة جاهزة'} · انشر المحتوى لتطبيقه.</p><button className="text-button" onClick={() => edit('fullMedia', '')}><X size={16}/>إزالة الوسائط</button></>}<label className="loop-checkbox"><input type="checkbox" checked={content.videoSound!==false} onChange={e=>edit('videoSound',e.target.checked)}/>تشغيل الصوت على التلفزيون</label><p className="field-hint">قد يطلب المتصفح ضغطة واحدة على شاشة التلفزيون للسماح بالصوت. المعاينة صامتة.</p><label>بعد انتهاء الفيديو<select aria-label="بعد انتهاء الفيديو" value={content.videoLoop===false?'stop':'loop'} onChange={e=>edit('videoLoop',e.target.value==='loop')}><option value="loop">تكرار الفيديو</option><option value="stop">إيقاف عند آخر إطار</option></select></label><label className="loop-checkbox"><input type="checkbox" checked={!!content.videoControls} onChange={e=>edit('videoControls',e.target.checked)}/>إظهار أزرار تشغيل وإيقاف الفيديو</label><label>ملاءمة الوسائط<select value={content.mediaFit || 'cover'} onChange={e => edit('mediaFit', e.target.value)}><option value="contain">احتواء · عرض الملف كاملًا</option><option value="cover">تغطية · ملء الشاشة مع القص</option><option value="fill">تمدد</option></select></label></section>;
}


/** One entry point for single media and fullscreen photo playlists. Existing playlists are retained. */
export function MediaOnlyEditor() {
 const {template,setTemplate,busy}=useAdmin();const {permissions}=useAuth();
 const multiple=template.displayMode==='slideshow';
 return <section className="media-only-panel"><h2>وسائط بملء الشاشة</h2>{permissions.admin&&<div className="segmented media-source-tabs" role="tablist" aria-label="نوع وسائط ملء الشاشة"><button type="button" role="tab" aria-selected={!multiple} disabled={busy} onClick={()=>setTemplate(t=>withDisplayMode(t,'media'))}>صورة واحدة / فيديو</button><button type="button" role="tab" aria-selected={multiple} disabled={busy} onClick={()=>setTemplate(t=>withDisplayMode(t,'slideshow'))}>صور متعددة · عرض شرائح</button></div>}{multiple?<SlideshowEditor fullscreen/>:<FullMediaEditor/>}</section>;
}
