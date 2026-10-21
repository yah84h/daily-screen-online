export type Content = {
  videoSound?: boolean;
  videoLoop?: boolean;
  videoControls?: boolean;
  fullMedia?: string;
  fullType?: 'image' | 'video';
  mediaFit?: 'cover' | 'contain' | 'fill';
  title: string;
  subtitle: string;
  body: string;
  badge: string;
  footer: string;
  image: string;
  secondary: string;
  qr: string;
  logo: string;
  autoDate: boolean;
  date: string;
  showSubtitle: boolean;
  showFooter: boolean;
  showBadge: boolean;
  showSecondary: boolean;
  showQR: boolean;
};

export type RecognitionStudent = { id: string; name: string; achievement: string; photo?: string };
export type RecognitionBoard = { enabled: boolean; title: string; subtitle: string; pageSeconds: number; width?: number; height?: number; style?: 'classic' | 'solo' | 'group'; groupSize?: 2 | 3 | 4; students: RecognitionStudent[] };
export type Timetable = { periods: [string, string][] };

export type Template = {
  displayMode?: 'daily' | 'loop' | 'media';
  schoolName?: string;
  schoolTagline?: string;
  schoolLogo?: string;
  schoolX?: number; schoolY?: number; schoolW?: number; schoolScale?: number;
  dismissalLabel?: string;
  dismissalDetail?: string;
  loopScale?: number;
  loopBranding?: 'paired' | 'school';
  loopSchoolName?: string;
  showTechQuotes?: boolean;
  animateClock?: boolean;
  recognition?: RecognitionBoard;
  timetable?: Timetable;
  background: string;
  backgroundImage?: string;
  color: string;
  accent: string;
  font: string;
  fontSize: number;
  radius: number;
  fit: 'cover' | 'contain' | 'fill';
  imageX: number;
  imageY: number;
  imageW: number;
  imageH: number;
  textX: number;
  textY: number;
  textW: number;
  spacing: number;
  align?: 'left' | 'center' | 'right';
  calendar?: 'gregory' | 'islamic' | 'both';
};

export type School = { name: string; tagline: string; logo_url: string | null };

export type Screen = {
  id: string;
  name: string;
  template: Partial<Template>;
  draft: Content | null;
  updated_at: string;
};

export type Post = {
  id: string;
  screen_id: string;
  content: Content;
  publish_at: string; // YYYY-MM-DD
  created_at: string;
};

export type Preset = { id: string; name: string; content: Content; sort_order: number };

export type Device = {
  token: string;
  code: string;
  screen_id: string | null;
  label: string | null;
  paired_at: string | null;
  last_seen_at: string | null;
};

export type TvState =
  | { status: 'unknown' }
  | { status: 'pending'; code: string }
  | {
      status: 'paired';
      screen: { id: string; name: string; template: Partial<Template>; updated_at: string };
      school: School;
      post: { id: string; content: Content; publish_at: string; created_at: string } | null;
      version: string;
    };

export const WORKSPACE_PHOTO = '/workspace.jpg';

export const initialContent: Content = {
  title: 'التوعية بالأمن السيبراني',
  subtitle: 'عادات بسيطة، حماية أكبر.',
  body: 'احمِ حساباتك، وفكّر قبل أن تضغط.\nحافظ على أمان عالمك الرقمي.',
  badge: 'موضوع اليوم',
  footer: 'تعلّم باستمرار، وتواصل بأمان.',
  image: WORKSPACE_PHOTO,
  secondary: '',
  qr: '',
  logo: '',
  autoDate: true,
  date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }),
  showSubtitle: true,
  showFooter: true,
  showBadge: true,
  showSecondary: false,
  showQR: false,
};

export const defaultTemplate: Template = {
  schoolX: 55, schoolY: 6, schoolW: 39, schoolScale: 100,
  background: '#f2f6ff',
  color: '#254d80',
  accent: '#4b91f7',
  font: 'SchoolArabic',
  fontSize: 100,
  radius: 18,
  fit: 'cover',
  imageX: 6,
  imageY: 21,
  imageW: 38,
  imageH: 64,
  textX: 49,
  textY: 30,
  textW: 45,
  spacing: 1,
  align: 'right',
  calendar: 'gregory',
};

export const defaultSchool: School = { name: 'مدارس الموهوبين التقنيه بجدة', tagline: 'علمٌ ينفع، وأثرٌ يبقى.', logo_url: null };

export const riyadhToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
