import { CalendarDays, Layers, Monitor, Radio, Sparkles } from 'lucide-react';
import type { Tab } from './store';

export const navigation = [
  { label: 'المحتوى', icon: Monitor, tabs: ['الرئيسية'] },
  { label: 'التحكم المباشر', icon: Radio, tabs: ['التحكم'] },
  { label: 'التصميم', icon: Layers, tabs: ['طريقة العرض', 'القوالب', 'خلفية الحصص'], admin: true },
  { label: 'ChatGPT', icon: Sparkles, tabs: ['المساعد'] },
  { label: 'الجدولة والسجل', icon: CalendarDays, tabs: ['الجدولة', 'السجل'] },
] satisfies { label: string; icon: typeof Monitor; tabs: Tab[]; admin?: boolean }[];
export const sectionLabels: Partial<Record<Tab, string>> = {
  'طريقة العرض': 'نوع العرض',
  القوالب: 'تصميم اليومي',
  'خلفية الحصص': 'الخلفية والساعة',
  الجدولة: 'المواعيد القادمة',
  السجل: 'سجل النشر',
};
