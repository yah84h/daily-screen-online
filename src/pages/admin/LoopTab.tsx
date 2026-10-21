import { Award, ImagePlus, Plus, Save, Trash2, X } from "lucide-react";
import { Screen } from "@/components/Screen";
import {
  defaultTimetable,
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
    timetable = template.timetable || defaultTimetable;
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
    setTemplate((t) => ({ ...t, timetable: { periods } }));
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
        <h2>وضع الشاشة</h2>
        <label>حجم واجهة خلفية الحصص · {template.loopScale||100}%<input aria-label="حجم واجهة خلفية الحصص" type="range" min="75" max="110" step="1" value={template.loopScale||100} onChange={e=>setTemplate(t=>({...t,loopScale:+e.target.value}))}/></label>
        <p className="field-hint">يغيّر الساعة واللوحة والشعارات والنصوص معًا. الخلفية تبقى ممتدة على الشاشة.</p>
        <label>
          ما الذي يظهر على التلفزيون؟
          <select
            aria-label="وضع الشاشة"
            value={template.displayMode || "daily"}
            onChange={(e) =>
              setTemplate((t) => ({
                ...t,
                displayMode: e.target.value as "daily" | "loop" | "media",
              }))
            }
          >
            <option value="daily">المحتوى اليومي</option><option value="media">صورة / فيديو فقط</option>
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
          {([['classic','القائمة الحالية'],['solo','طالب واحد'],['group','مجموعة']] as const).map(([id,label])=><button key={id} role="tab" aria-selected={(board.style||'classic')===id} onClick={()=>setBoard({style:id,...(id==='group'?{width:32,height:40}:id==='solo'?{width:27,height:40}:{width:27,height:35})})}>{label}</button>)}
        </div>
        {board.style==='group'&&<label>عدد الطلاب في المجموعة<select aria-label="عدد الطلاب في المجموعة" value={board.groupSize||2} onChange={e=>setBoard({groupSize:Number(e.target.value) as 2|3|4})}><option value="2">طالبان</option><option value="3">ثلاثة طلاب</option><option value="4">أربعة طلاب</option></select></label>}
        <label>عرض لوحة التميز · {board.width}%<input aria-label="عرض لوحة التميز" type="range" min="20" max="34" step="1" value={board.width} onChange={e=>setBoard({width:+e.target.value})}/></label>
        <label>ارتفاع لوحة التميز · {board.height}%<input aria-label="ارتفاع لوحة التميز" type="range" min={board.style==='group'?38:28} max="43" step="1" value={board.height} onChange={e=>setBoard({height:+e.target.value})}/></label>
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
        <label className="loop-checkbox">
          <input
            type="checkbox"
            checked={template.showTechQuotes !== false}
            onChange={(e) =>
              setTemplate((t) => ({ ...t, showTechQuotes: e.target.checked }))
            }
          />
          إظهار الومضات والاقتباسات التقنية
        </label>
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
          <summary>أوقات الحصص · توقيت جدة</summary>
          <p className="field-hint">
            الخميس ينتهي بعد السادسة، وبقية أيام الدراسة بعد السابعة. الفاصل بين
            الثالثة والرابعة هو الفسحة. الأوقات بنظام ٢٤ ساعة.
          </p>
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
