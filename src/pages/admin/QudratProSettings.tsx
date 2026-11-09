import type {RecognitionBoard} from '@/lib/types';
import {leaderboardOptions,useLeaderboard} from '@/lib/qudratPro';
export function QudratProSettings({board,onChange}:{board:RecognitionBoard;onChange:(patch:Partial<RecognitionBoard>)=>void}){
 const options=leaderboardOptions(board.qudratPro),state=useLeaderboard();
 const change=(patch:Partial<typeof options>)=>onChange({qudratPro:{...options,...patch}});
 return <section className="qudrat-settings">
  <div className="qudrat-settings-brand"><img src="/branding/qudrat-pro.png" alt="شعار قدرات برو"/><div><h3>قدرات برو</h3><p>نتائج أسبوعية من المصدر، دون إدخال الأسماء يدويًا.</p></div></div>
  <label>الاختبار المعروض<select aria-label="اختبار قدرات برو" value={options.exam} onChange={event=>change({exam:event.target.value as typeof options.exam})}><option value="weekly">قدرات عربي</option><option value="gat">قدرات إنجليزي (GAT)</option><option value="all">التبديل بين جميع الاختبارات</option></select></label>
  <label className="loop-checkbox"><input type="checkbox" checked={options.layout==='podium'} onChange={event=>change({layout:event.target.checked?'podium':'list'})}/>إبراز الثلاثة الأوائل في الأعلى</label>
  <label>طلاب في كل صفحة من القائمة<select aria-label="طلاب صفحة قدرات برو" value={options.pageSize} onChange={event=>change({pageSize:Number(event.target.value) as 2|3|4})}><option value="2">طالبان</option><option value="3">ثلاثة طلاب</option><option value="4">أربعة طلاب</option></select></label>
  <label>مدة عرض الصفحة<select aria-label="مدة صفحة قدرات برو" value={board.pageSeconds} onChange={event=>onChange({pageSeconds:Number(event.target.value)})}>{[6,10,15,20,30].map(seconds=><option key={seconds} value={seconds}>{seconds} ثوانٍ</option>)}</select></label>
  <p className="field-hint">يبقى الثلاثة الأوائل ظاهرين، وتتنقل بقية القائمة تلقائيًا. تُجلب النتائج عند إعادة تحميل الصفحة، وتبقى آخر نتائج محفوظة عند انقطاع المصدر.</p>
  <div className="qudrat-source-status" role="status">{state.loading?'جارٍ التحقق من المصدر…':state.data?state.data.exams.map(exam=>`${exam.kind_label}: ${exam.leaders.length} طلاب`).join(' · '):state.error==='OFFLINE_ONLY'?'الخادم في وضع دون اتصال؛ مصدر قدرات برو يحتاج إلى الإنترنت.':state.error==='NOT_CONFIGURED'?'يحتاج مصدر قدرات برو إلى إعداد على الخادم. تواصل مع المسؤول.':'تعذر الوصول إلى نتائج قدرات برو. حاول التحديث لاحقًا.'}{state.stale&&' · تُعرض آخر نتائج محفوظة.'}</div>
  <button type="button" className="button white" onClick={state.refresh}>تحديث النتائج الآن</button>
 </section>;
}
