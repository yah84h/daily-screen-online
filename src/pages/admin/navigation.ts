import {
  Bot,
  CalendarDays,
  History,
  House,
  LayoutGrid,
  Palette,
  Radio,
  Settings,
} from 'lucide-react';
import type { Tab } from './store';

/** Bottom bar on phones, top bar on wide screens. Four everyday jobs; everything else lives in "More". */
export const navigation = [
  { label: 'اليوم', icon: House, tabs: ['الرئيسية'] },
  { label: 'الشاشة', icon: Radio, tabs: ['التحكم'] },
  { label: 'التصميم', icon: Palette, tabs: ['طريقة العرض', 'القوالب', 'خلفية الحصص'], admin: true },
  { label: 'المزيد', icon: LayoutGrid, tabs: ['المزيد', 'المساعد', 'الجدولة', 'السجل', 'الشاشات'] },
] satisfies { label: string; icon: typeof House; tabs: Tab[]; admin?: boolean }[];

/** Pages that open from the "More" list, with a back arrow instead of a sub-menu. */
export const moreItems = [
  {
    tab: 'الجدولة',
    icon: CalendarDays,
    title: 'المواعيد القادمة',
    hint: 'محتوى يُنشر تلقائيًا لاحقًا',
  },
  { tab: 'السجل', icon: History, title: 'سجل النشر', hint: 'استعد أي محتوى نشرته سابقًا' },
  { tab: 'المساعد', icon: Bot, title: 'المساعد الذكي', hint: 'اطلب تعديلًا بكلماتك' },
  {
    tab: 'الشاشات',
    icon: Settings,
    title: 'الأجهزة والإعدادات',
    hint: 'الشاشات، الأجهزة وهوية المدرسة',
    admin: true,
  },
] satisfies { tab: Tab; icon: typeof House; title: string; hint: string; admin?: boolean }[];

export const sectionLabels: Partial<Record<Tab, string>> = {
  'طريقة العرض': 'نوع العرض',
  القوالب: 'تصميم اليومي',
  'خلفية الحصص': 'الخلفية والساعة',
  الجدولة: 'المواعيد القادمة',
  السجل: 'سجل النشر',
  المساعد: 'المساعد الذكي',
  الشاشات: 'الأجهزة والإعدادات',
};
