export const defaultLoopSchoolName = "الموهوبين التقنية الثانوية بجدة - بنين";
import type { RecognitionBoard, Template, Timetable } from "./types";
export const periodNames = [
  "الأولى",
  "الثانية",
  "الثالثة",
  "الرابعة",
  "الخامسة",
  "السادسة",
  "السابعة",
];
export const defaultTimetable: Timetable = {
  periods: [
    ["07:00", "07:45"],
    ["07:46", "08:31"],
    ["08:32", "09:17"],
    ["09:18", "10:03"],
    ["10:04", "10:49"],
    ["10:50", "11:35"],
    ["11:36", "12:21"],
  ],
};
export const winterTimetable:Timetable={periods:defaultTimetable.periods.map(p=>p.map(v=>{const m=Number(v.slice(0,2))*60+Number(v.slice(3))+30;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}) as [string,string])};
export function timetableSeasonOf(t:Partial<Template>){if(t.timetableSeason)return t.timetableSeason;if(!t.timetable||JSON.stringify(t.timetable.periods)===JSON.stringify(defaultTimetable.periods))return 'summer';if(JSON.stringify(t.timetable.periods)===JSON.stringify(winterTimetable.periods))return 'winter';return 'custom';}
export function timetableFor(t:Partial<Template>):Timetable{return t.timetableSeason==='summer'?defaultTimetable:t.timetableSeason==='winter'?winterTimetable:t.timetable||defaultTimetable;}
export const defaultRecognition: RecognitionBoard = {
  enabled: false,
  title: "نجوم الأسبوع",
  subtitle: "نحتفي بالتعلم والتميز",
  pageSeconds: 10,
  style: 'classic', groupSize: 2,
  width: 27,
  height: 50,
  students: [],
};
export function recognitionOf(template: Partial<Template>): RecognitionBoard {
  const r = template.recognition;
  return {
    ...defaultRecognition,
    ...r,
    style: r?.style==='solo'||r?.style==='group'?r.style:'classic',
    groupSize: r?.groupSize===3||r?.groupSize===4?r.groupSize:2,
    width: Math.max(20,Math.min(34,Number(r?.width)||27)),
    height: Math.max(44,Math.min(53,Number(r?.height)||50)),
    students: Array.isArray(r?.students) ? r.students : [],
  };
}
const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function validTimetable(t: Timetable): boolean {
  if (!Array.isArray(t?.periods) || t.periods.length !== 7) return false;
  let end = -1;
  return t.periods.every((p) => {
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      p.some(
        (v) => typeof v !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v),
      )
    )
      return false;
    const [a, b] = p.map(minutes);
    if (a < end || b <= a) return false;
    end = b;
    return true;
  });
}
export function periodAt(now: Date, timetable = defaultTimetable, messages: {dismissalLabel?:string;dismissalDetail?:string} = {}) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (key: string) => parts.find((p) => p.type === key)?.value || "";
  const day = get("weekday"),
    minute = Number(get("hour")) * 60 + Number(get("minute"));
  if (day === "Fri" || day === "Sat")
    return { label: "حياكم الله", detail: "عطلة نهاية الأسبوع" };
  const periods = validTimetable(timetable)
      ? timetable.periods
      : defaultTimetable.periods,
    count = day === "Thu" ? 6 : 7;
  if (minute < minutes(periods[0][0]))
    return { label: "حياكم الله", detail: "يوم جديد، ومعرفة جديدة" };
  // Give the break its own interval before evaluating the next lesson.
  // Both bounds come from this screen's saved timetable; never add a fixed delay.
  if (minute >= minutes(periods[2][1]) && minute < minutes(periods[3][0]))
    return { label: "الفسحة", detail: periods[2][1] + " — " + periods[3][0] };
  for (let i = 0; i < count; i++) {
    if (minute >= minutes(periods[i][0]) && minute < minutes(periods[i][1]))
      return {
        label: "الحصة " + periodNames[i],
        detail: periods[i][0] + " — " + periods[i][1],
      };
    if (
      i < count - 1 &&
      minute >= minutes(periods[i][1]) &&
      minute < minutes(periods[i + 1][0])
    )
      return {
        label: i === 2 ? "الفسحة" : "بين الحصص",
        detail: periods[i][1] + " — " + periods[i + 1][0],
      };
  }
  return { label: messages.dismissalLabel?.trim() || "الصلاه / صرفه", detail: messages.dismissalDetail?.trim() || "نلقاكم بخير" };
}

/** Remaining real seconds in the current lesson; never show a lesson countdown during breaks. */
export function lessonCountdown(now:Date,timetable=defaultTimetable){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const part=(key:string)=>parts.find(p=>p.type===key)?.value||'';
 const day=part('weekday');if(day==='Fri'||day==='Sat')return null;
 const seconds=Number(part('hour'))*3600+Number(part('minute'))*60+Number(part('second'));
 const periods=(validTimetable(timetable)?timetable:defaultTimetable).periods.slice(0,day==='Thu'?6:7);
 const active=periods.find(([start,end])=>seconds>=minutes(start)*60&&seconds<minutes(end)*60);if(!active)return null;
 const duration=(minutes(active[1])-minutes(active[0]))*60,remaining=minutes(active[1])*60-seconds;
 return {remaining,duration,label:String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0')};
}
