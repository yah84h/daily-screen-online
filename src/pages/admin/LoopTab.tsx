import {withDisplayMode} from '@/lib/slideshow';
import {defaultLoopAppearance,loopAppearance,loopPalettePresets} from '@/lib/loopAppearance';
import { SlideshowEditor } from './SlideshowEditor';
import { Award, ImagePlus, Plus, Save, Trash2, X } from "lucide-react";
import { Screen } from "@/components/Screen";
import {
  timetableFor,
  timetableSeasonOf,
  defaultLoopSchoolName,
  periodNames,
  recognitionOf,
  validTimetable,
} from "@/lib/loop";
import type {
  RecognitionBoard,
  RecognitionStudent,
  Timetable,
} from "@/lib/types";
import { useAdmin } from "./store";

function TimeField({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (v: string) => void;
}) {
  const [hour, minute] = value.split(":");
  return (
    <div className="loop-time-field" dir="ltr" role="group" aria-label={label}>
      <select
        aria-label={label + " — الساعة"}
        value={hour}
        onChange={(e) => onChange(e.target.value + ":" + minute)}
      >
        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map(
          (v) => (
            <option key={v}>{v}</option>
          ),
        )}
      </select>
      <span>:</span>
      <select
        aria-label={label + " — الدقيقة"}
        value={minute}
        onChange={(e) => onChange(hour + ":" + e.target.value)}
      >
        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map(
          (v) => (
            <option key={v}>{v}</option>
          ),
        )}
      </select>
    </div>
  );
}
export function LoopTab() {
  const {
    data,
    content,
    template,
    setTemplate,
    saveDesign,
    busy,
    templateDirty,
    chooseImage,
  } = useAdmin();
  const board = recognitionOf(template),
    timetable = timetableFor(template);
  const setBoard = (patch: Partial<RecognitionBoard>) =>
    setTemplate((t) => ({
      ...t,
      recognition: { ...recognitionOf(t), ...patch },
    }));
  const editStudent = (id: string, patch: Partial<RecognitionStudent>) =>
    setTemplate((t) => ({
      ...t,
      recognition: {
        ...recognitionOf(t),
        students: recognitionOf(t).students.map((s) =>
          s.id === id ? { ...s, ...patch } : s,
        ),
      },
    }));
  const updateTime = (i: number, part: 0 | 1, value: string) => {
    const periods = timetable.periods.map((p, j) =>
      j === i ? (part === 0 ? [value, p[1]] : [p[0], value]) : [...p],
    ) as Timetable["periods"];
    setTemplate((t) => ({ ...t, timetableSeason:'custom',timetable: { periods } }));
  };
  const validStudents =
    !board.enabled || board.students.every((s) => s.name.trim());
  return (
    <div className="loop-admin-grid">
      <section className="loop-preview-panel">
        <div className="section-heading">
          <h2>معاينة خلفية الحصص</h2>
          <span className="edit-tag">
            {templateDirty ? "غير محفوظ" : "محفوظ"} · 4K
          </span>
        </div>
        <div className="preview-card">
          <Screen
            content={content}
            template={{ ...template, displayMode: "loop" }}
            school={data?.school}
          />
        </div>
        <p className="template-tip">
          المعاينة تعرض الخلفية دائمًا. اختر وضع العرض واحفظه لتطبيقه على
          التلفزيون.
        </p>
        <div className="loop-help">
          <Award />
          <span>
            لوحة التميز تظهر أعلى اليمين، بجانب الساعة. اختر القائمة أو الطالب المنفرد أو المجموعة؛ بقية
            الأسماء تتبدل بهدوء.
          </span>
        </div>
      </section>
      <section className="editor-card loop-settings">
        <button className="button white" onClick={()=>setTemplate(t=>({...t,slideshow:t.slideshow?{...t.slideshow,enabled:false}:undefined}))}>استعادة الخلفية المتحركة</button><p className="field-hint">يوقف صور الخلفية فقط، ويحافظ على ألوانك وصور الوسط والطلاب. احفظ أو انشر لتطبيقه.</p><SlideshowEditor center/>
        <h2>أحجام عناصر الشاشة</h2><p className="field-hint">كبّر الصورة وصغّر الساعة ولوحة التميز بشكل مستقل. تتكيف الصورة مع المساحة المتاحة لمنع التداخل. المعاينة تتحدث مباشرة؛ احفظ أو انشر للتطبيق.</p>
        <label>حجم الساعة والحصة · {template.clockScale??100}%<input aria-label="حجم الساعة والحصة" type="range" min="65" max="115" value={template.clockScale??100} onChange={e=>setTemplate(t=>({...t,clockScale:+e.target.value}))}/></label>
        <label>حجم لوحة التميز · {template.boardScale??100}%<input aria-label="حجم لوحة التميز" type="range" min="65" max="115" value={template.boardScale??100} onChange={e=>setTemplate(t=>({...t,boardScale:+e.target.value}))}/></label>
        <label>عرض صورة الوسط · {template.centerPhoto?.width??34}%<input aria-label="عرض صورة الوسط" type="range" min="18" max="60" value={template.centerPhoto?.width??34} onChange={e=>setTemplate(t=>({...t,centerPhoto:{...t.centerPhoto,width:+e.target.value}}))}/></label>
        <div className="button-row"><button className="button white" onClick={()=>setTemplate(t=>({...t,clockScale:70,boardScale:70,centerPhoto:{...t.centerPhoto,width:50}}))}>صورة كبيرة وبطاقات أصغر</button><button className="button white" onClick={()=>setTemplate(t=>({...t,clockScale:100,boardScale:100,centerPhoto:{...t.centerPhoto,width:34}}))}>استعادة الأحجام</button></div>
        <h2>شكل صور الوسط</h2><label>نسبة أبعاد الصورة<select aria-label="نسبة أبعاد صور الوسط" value={template.centerPhoto?.ratio||'16:9'} disabled={template.centerPhoto?.shape==='circle'} onChange={e=>setTemplate(t=>({...t,centerPhoto:{...t.centerPhoto,ratio:e.target.value}}))}>{['16:9','4:3','3:2','1:1','9:16'].map(r=><option key={r} value={r}>{r}</option>)}</select></label>
        <label>شكل الإطار<select aria-label="شكل صور الوسط" value={template.centerPhoto?.shape||'rounded'} onChange={e=>setTemplate(t=>({...t,centerPhoto:{...t.centerPhoto,shape:e.target.value}}))}><option value="rounded">مستطيل بزوايا ناعمة</option><option value="rectangle">مستطيل مستقيم</option><option value="circle">دائرة · نسبة ١:١</option><option value="oval">بيضاوي</option></select></label>
        <details className="loop-palette"><summary>ألوان الخلفية والعناصر المتحركة</summary><div className="layout-grid loop-palette-presets">{loopPalettePresets.map(p=><button type="button" className="layout-option color-option" key={p.id} aria-label={'لوحة '+p.name} onClick={()=>setTemplate(t=>({...t,background:p.colors.background,color:p.colors.text,accent:p.colors.accent,loopAppearance:{...p.colors}}))}><div className="color-swatches" style={{background:p.colors.background}}><i style={{background:p.colors.widget}}/><i style={{background:p.colors.accent}}/><i style={{background:p.colors.text}}/><i style={{background:p.colors.meterFill}}/></div><b>{p.name}</b></button>)}</div><p className="field-hint">ألوان شاشة الحصص فقط؛ لا تغيّر ألوان لوحة الإدارة. الخطوط والمكعبات رسومات حية وليست فيديو.</p>{([['background','خلفية الشاشة'],['widget','خلفية البطاقات'],['text','النص الرئيسي'],['muted','النص الثانوي'],['accent','الساعة والرموز'],['meterFill','لون تعبئة مؤشر الحصة'],['meterTrack','لون مسار مؤشر الحصة'],['border','حدود البطاقات'],['line1','الخط الأزرق'],['line2','الخط السماوي'],['line3','الخط البنفسجي'],['cube1','المكعب الأزرق'],['cube2','المكعب السماوي'],['cube3','المكعب البنفسجي']] as const).map(([key,label])=><label key={key}>{label}<input type="color" aria-label={label} value={loopAppearance(template.loopAppearance)[key]} onChange={e=>setTemplate(t=>({...t,loopAppearance:{...loopAppearance(t.loopAppearance),[key]:e.target.value},...(key==='background'?{background:e.target.value}:key==='text'?{color:e.target.value}:key==='accent'?{accent:e.target.value}:{})}))}/></label>)}<button className="button white" onClick={()=>setTemplate(t=>({...t,background:defaultLoopAppearance.background,color:defaultLoopAppearance.text,accent:defaultLoopAppearance.accent,loopAppearance:{...defaultLoopAppearance}}))}>استعادة ألوان المدرسة</button></details>
        <h2>وضع الشاشة</h2>
        <label>حجم واجهة خلفية الحصص · {template.loopScale||100}%<input aria-label="حجم واجهة خلفية الحصص" type="range" min="75" max="110" step="1" value={template.loopScale||100} onChange={e=>setTemplate(t=>({...t,loopScale:+e.target.value}))}/></label>
        <p className="field-hint">يغيّر الساعة واللوحة والشعارات والنصوص معًا. الخلفية تبقى ممتدة على الشاشة.</p>
        <label>
          ما الذي يظهر على التلفزيون؟
          <select
            aria-label="وضع الشاشة"
            value={template.displayMode || "daily"}
            onChange={(e) =>
              setTemplate((t) => withDisplayMode(t,e.target.value as "daily" | "loop" | "media" | "slideshow"))
            }
          >
            <option value="slideshow">عرض شرائح الصور</option><option value="daily">المحتوى اليومي</option><option value="media">صورة / فيديو فقط</option>
            <option value="loop">الخلفية والساعة والحصص</option>
          </select>
        </label>
        <p className="field-hint">
          تشغيل يدوي فقط. لا يتغير الوضع مع بداية الحصص.
        </p>
        <label>
          اسم المدرسة في الخلفية
          <input
            maxLength={90}
            value={
              template.loopSchoolName ??
              (template.loopBranding === "school"
                ? (data?.school.name ?? defaultLoopSchoolName)
                : defaultLoopSchoolName)
            }
            onChange={(e) =>
              setTemplate((t) => ({ ...t, loopSchoolName: e.target.value }))
            }
          />
        </label>
        <label>
          شعارات الخلفية
          <select
            aria-label="شعارات الخلفية"
            value={template.loopBranding || "paired"}
            onChange={(e) =>
              setTemplate((t) => ({
                ...t,
                loopBranding: e.target.value as "paired" | "school",
              }))
            }
          >
            <option value="paired">وزارة التعليم | أكاديمية طويق</option>
            <option value="school">شعار المدرسة المرفوع</option>
          </select>
        </label>
        <div className="loop-section-heading">
          <h2>لوحة التميز</h2>
          <label className="loop-checkbox">
            <input
              type="checkbox"
              checked={board.enabled}
              onChange={(e) => setBoard({ enabled: e.target.checked })}
            />
            إظهار اللوحة
          </label>
        </div>
        <p className="field-hint">
          أخفِ اللوحة متى أردت؛ الأسماء والصور تبقى محفوظة.
        </p>
        <label>
          عنوان اللوحة
          <input
            maxLength={70}
            value={board.title}
            onChange={(e) => setBoard({ title: e.target.value })}
            placeholder="أفضل طلاب الأسبوع في الدرجات"
          />
        </label>
        <label>
          العبارة التعريفية
          <input
            maxLength={120}
            value={board.subtitle}
            onChange={(e) => setBoard({ subtitle: e.target.value })}
          />
        </label>
        <div className="board-style-tabs" role="tablist" aria-label="نمط لوحة التميز">
          {([['classic','القائمة الحالية'],['solo','طالب واحد'],['group','مجموعة']] as const).map(([id,label])=><button key={id} role="tab" aria-selected={(board.style||'classic')===id} onClick={()=>setBoard({style:id,...(id==='group'?{width:32,height:50}:id==='solo'?{width:27,height:50}:{width:27,height:50})})}>{label}</button>)}
        </div>
        {board.style==='group'&&<label>عدد الطلاب في المجموعة<select aria-label="عدد الطلاب في المجموعة" value={board.groupSize||2} onChange={e=>setBoard({groupSize:Number(e.target.value) as 2|3|4})}><option value="2">طالبان</option><option value="3">ثلاثة طلاب</option><option value="4">أربعة طلاب</option></select></label>}
        <label>عرض لوحة التميز · {board.width}%<input aria-label="عرض لوحة التميز" type="range" min="20" max="34" step="1" value={board.width} onChange={e=>setBoard({width:+e.target.value})}/></label>
        <label>ارتفاع لوحة التميز · {board.height}%<input aria-label="ارتفاع لوحة التميز" type="range" min="44" max="53" step="1" value={board.height} onChange={e=>setBoard({height:+e.target.value})}/></label>
        <p className="field-hint">النسب من مساحة الشاشة. تظهر المعاينة مباشرة؛ احفظ لتطبيق الحجم على التلفزيون.</p>
        <div className="recognition-editor-list">
          {board.students.map((s, i) => (
            <section className="student-editor" key={s.id}>
              <div className="student-editor-heading">
                <b>الطالب {i + 1}</b>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={"حذف الطالب " + (s.name || i + 1)}
                  disabled={busy}
                  onClick={() =>
                    setBoard({
                      students: board.students.filter((row) => row.id !== s.id),
                    })
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <label>
                اسم الطالب
                <input
                  aria-label={"اسم الطالب " + (i + 1)}
                  maxLength={80}
                  value={s.name}
                  onChange={(e) => editStudent(s.id, { name: e.target.value })}
                />
              </label>
              <label>
                الإنجاز أو الصف
                <input
                  aria-label={"إنجاز الطالب " + (i + 1)}
                  maxLength={120}
                  value={s.achievement}
                  onChange={(e) =>
                    editStudent(s.id, { achievement: e.target.value })
                  }
                  placeholder="الأول في الدرجات · الصف الأول"
                />
              </label>
              <div className="student-photo-editor">
                {s.photo && (
                  <img src={s.photo} alt={"صورة " + (s.name || "الطالب")} />
                )}
                <button
                  className="button white"
                  disabled={busy}
                  onClick={() => chooseImage(`studentPhoto:${s.id}`)}
                >
                  <ImagePlus size={17} />
                  {s.photo ? "تغيير الصورة" : "صورة اختيارية · PNG مدعوم"}
                </button>
                {s.photo && (
                  <button
                    className="icon-button"
                    aria-label={"إزالة صورة الطالب " + (i + 1)}
                    disabled={busy}
                    onClick={() => editStudent(s.id, { photo: "" })}
                  >
                    <X size={17} />
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
        <button
          className="button white"
          disabled={busy || board.students.length >= 30}
          onClick={() =>
            setBoard({
              students: [
                ...board.students,
                {
                  id: crypto.randomUUID(),
                  name: "",
                  achievement: "",
                  photo: "",
                },
              ],
            })
          }
        >
          <Plus size={17} />
          إضافة طالب
        </button>
        <p className="field-hint">
          حتى ٣٠ طالبًا. الاسم مطلوب لكل طالب مضاف، والصورة اختيارية. الصور
          المرفوعة محفوظة في حاوية المدرسة الحالية.
        </p>
        {board.students.length > (board.style==='solo'?1:board.style==='group'?(board.groupSize||2):2) && (
          <label>
            مدة عرض كل صفحة
            <select
              aria-label="مدة عرض صفحة الطلاب"
              value={board.pageSeconds}
              onChange={(e) =>
                setBoard({ pageSeconds: Number(e.target.value) })
              }
            >
              {[6, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>
                  {n} ثوانٍ
                </option>
              ))}
            </select>
          </label>
        )}
        {!board.enabled && board.students.length > 0 && (
          <p className="loop-info">
            اللوحة مخفية على التلفزيون. بيانات الطلاب محفوظة عند حفظ الإعدادات.
          </p>
        )}
        <hr />
        <a className="button white" href="/news">إدارة شريط الأخبار</a>
        <label className="loop-checkbox">
          <input
            type="checkbox"
            checked={template.animateClock !== false}
            onChange={(e) =>
              setTemplate((t) => ({ ...t, animateClock: e.target.checked }))
            }
          />
          انتقالات هادئة للساعة والحصة
        </label>
        <p className="field-hint">
          انتقال قصير بلا وميض. تُحترم إعدادات تقليل الحركة في الجهاز.
        </p>
        <label>عبارة نهاية اليوم<input aria-label="عبارة نهاية اليوم" maxLength={70} value={template.dismissalLabel??'الصلاه / صرفه'} onChange={e=>setTemplate(t=>({...t,dismissalLabel:e.target.value}))}/></label>
        <label>العبارة أسفل نهاية اليوم<input aria-label="العبارة أسفل نهاية اليوم" maxLength={120} value={template.dismissalDetail??'نلقاكم بخير'} onChange={e=>setTemplate(t=>({...t,dismissalDetail:e.target.value}))}/></label>
        <details className="loop-timetable">
          <summary>أوقات الحصص · توقيت جدة</summary><label>نظام التوقيت<select aria-label="نظام توقيت الحصص" value={timetableSeasonOf(template)} onChange={e=>setTemplate(t=>({...t,timetableSeason:e.target.value as 'summer'|'winter'|'custom',...(e.target.value==='custom'?{timetable:t.timetable||timetableFor(t)}:{})}))}><option value="summer">الوقت الصيفي</option><option value="winter">الوقت الشتوي · بعد ٣٠ دقيقة</option><option value="custom">أوقات مخصصة</option></select></label>
          <p className="field-hint">
            الخميس ينتهي بعد السادسة، وبقية أيام الدراسة بعد السابعة. الفاصل بين
            الثالثة والرابعة هو الفسحة. الأوقات بنظام ٢٤ ساعة.
          </p>
          <div className="break-summary" role="note"><b>الفسحة · بين الثالثة والرابعة</b><p dir="ltr">{timetable.periods[2][1]} — {timetable.periods[3][0]}</p><small>تبدأ عند نهاية الثالثة وتنتهي عند بداية الرابعة حسب الأوقات المحفوظة؛ دون تأخير إضافي.</small>{(()=>{const m=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3));const duration=m(timetable.periods[3][0])-m(timetable.periods[2][1]);return duration<=1?<p className="field-hint">{duration<=0?'لا توجد فسحة في الأوقات الحالية.':'الفسحة في الأوقات الحالية دقيقة واحدة فقط.'} عدّل نهاية الثالثة وبداية الرابعة أدناه إذا كان الجدول مختلفًا.</p>:null;})()}</div>
          {timetable.periods.map((p, i) => (
            <div className="loop-period-row" key={i}>
              <b>الحصة {periodNames[i]}</b>
              <div>
                <label>
                  من
                  <TimeField
                    label={"بداية الحصة " + periodNames[i]}
                    value={p[0]}
                    onChange={(v) => updateTime(i, 0, v)}
                  />
                </label>
                <label>
                  إلى
                  <TimeField
                    label={"نهاية الحصة " + periodNames[i]}
                    value={p[1]}
                    onChange={(v) => updateTime(i, 1, v)}
                  />
                </label>
              </div>
            </div>
          ))}
          {!validTimetable(timetable) && (
            <p role="alert">أدخل أوقاتًا مرتبة دون تداخل.</p>
          )}
        </details>
        {!validStudents && (
          <p role="alert" className="loop-validation">
            أضف اسمًا لكل طالب، أو احذف الخانة الفارغة قبل الحفظ.
          </p>
        )}
        <button
          className="button primary loop-save"
          disabled={
            busy || !data || !validStudents || !validTimetable(timetable)
          }
          onClick={saveDesign}
        >
          <Save size={18} />
          حفظ الخلفية ولوحة التميز
        </button>
        <p className="field-hint">
          تُحفظ اللوحة في قالب هذه الشاشة، وتصل إلى أجهزتها المرتبطة دون إعادة
          نشر موضوع اليوم.
        </p>
      </section>
    </div>
  );
}
