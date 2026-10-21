export const defaultLoopSchoolName = "مدارس الموهوبين التقنيه بجدة";
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
export const defaultRecognition: RecognitionBoard = {
  enabled: false,
  title: "نجوم الأسبوع",
  subtitle: "نحتفي بالتعلم والتميز",
  pageSeconds: 10,
  style: 'classic', groupSize: 2,
  width: 27,
  height: 35,
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
    height: Math.max(r?.style==='group'?38:28,Math.min(43,Number(r?.height)||35)),
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
