export const loopElements = {
  news: 'شريط العناوين والأخبار',
  clock: 'الساعة والحصة',
  board: 'لوحة التميز',
  photo: 'صورة الوسط',
  school: 'اسم المدرسة',
  tuwaiq: 'شعار طويق',
  ministry: 'شعار الوزارة',
  logo: 'شعار المدرسة',
} as const;
export type LoopElement = keyof typeof loopElements;
export type LoopPosition = { x: number; y: number; w: number; h: number };
export const loopSelectors: Record<LoopElement, string> = {
  news: '.news-ribbon',
  clock: '.loop-clock-panel',
  board: '.recognition-board',
  photo: '.loop-center-slideshow',
  school: '.native-school-name',
  tuwaiq: '.tuwaiq-brand',
  ministry: '.ministry-brand',
  logo: '.native-custom-logo,.native-logo',
};
export function fitLoopPosition(r: LoopPosition): LoopPosition {
  const finite = (n: number, fallback: number) => (Number.isFinite(n) ? n : fallback);
  const w = Math.max(5, Math.min(95, finite(r.w, 20)));
  const h = Math.max(4, Math.min(85, finite(r.h, 15)));
  return {
    x: Math.max(0, Math.min(100 - w, finite(r.x, 0))),
    y: Math.max(0, Math.min(100 - h, finite(r.y, 0))),
    w,
    h,
  };
}
