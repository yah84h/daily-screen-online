import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import * as api from '@/lib/api';
import { uploadImage } from '@/lib/media';
import { defaultTemplate, initialContent, type Content, type Template } from '@/lib/types';

export type Tab = 'الرئيسية' | 'المواضيع المحفوظة' | 'الجدولة' | 'القوالب' | 'السجل';
export type Modal = '' | 'preview' | 'pair' | 'schedule' | 'preset' | 'optional' | 'settings' | 'setup';
export type UploadTarget = 'image' | 'secondary' | 'qr' | 'logo' | 'backgroundImage' | 'schoolLogo';

type Store = {
  data: api.AdminData | null;
  loadError: string;
  reload: () => Promise<void>;
  selectScreen: (id: string) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  modal: Modal;
  setModal: (m: Modal) => void;
  content: Content;
  edit: (key: keyof Content, value: Content[keyof Content]) => void;
  setContent: (c: Content, dirty?: boolean) => void;
  template: Template;
  setTemplate: (t: Template | ((t: Template) => Template)) => void;
  dirty: boolean;
  busy: boolean;
  toast: string;
  notify: (m: string) => void;
  run: <T>(fn: () => Promise<T>, success?: string) => Promise<T | undefined>;
  chooseImage: (target: UploadTarget) => void;
  fileInput: ReactNode;
  presetName: string;
  setPresetName: (n: string) => void;
  editingPreset: string | null;
  openPresetEditor: (id: string | null, name: string) => void;
};

const Ctx = createContext<Store | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<api.AdminData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('الرئيسية');
  const [modal, setModal] = useState<Modal>('');
  const [content, setContentState] = useState<Content>(initialContent);
  const [template, setTemplate] = useState<Template>(defaultTemplate);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<UploadTarget>('image');
  const loadedFor = useRef<string | null>(null);
  const screenId = useRef<string | null>(localStorage.getItem('admin-screen'));

  const notify = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 4000);
  }, []);

  const reload = useCallback(async () => {
    try {
      const d = await api.loadAdmin(screenId.current);
      setData(d);
      setLoadError('');
      if (loadedFor.current !== d.screen.id) {
        loadedFor.current = d.screen.id;
        screenId.current = d.screen.id;
        localStorage.setItem('admin-screen', d.screen.id);
        setTemplate({ ...defaultTemplate, ...d.screen.template });
        setContentState({ ...initialContent, ...(d.screen.draft || d.current?.content || {}) });
        setDirty(!!d.screen.draft);
      }
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 20_000); // لتحديث حالة التلفزيون «متصلة/غير متصلة»
    return () => clearInterval(t);
  }, [reload]);

  const selectScreen = (id: string) => {
    if (dirty && !confirm('لديك تعديلات غير محفوظة. الانتقال إلى شاشة أخرى سيتجاهلها. متابعة؟')) return;
    screenId.current = id;
    reload();
  };

  const edit: Store['edit'] = (key, value) => {
    setContentState((c) => ({ ...c, [key]: value }));
    setDirty(true);
  };
  const setContent: Store['setContent'] = (c, d = true) => {
    setContentState(c);
    setDirty(d);
  };

  const run: Store['run'] = async (fn, success) => {
    setBusy(true);
    try {
      const r = await fn();
      if (success) notify(success);
      await reload();
      return r;
    } catch (e) {
      notify((e as Error).message || 'حدث خطأ.');
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const chooseImage = (t: UploadTarget) => {
    target.current = t;
    fileRef.current?.click();
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const t = target.current;
      const url = await uploadImage(file, t === 'backgroundImage' ? 'backgrounds' : t === 'schoolLogo' || t === 'logo' ? 'logos' : 'content');
      if (t === 'backgroundImage') setTemplate((tp) => ({ ...tp, backgroundImage: url }));
      else if (t === 'schoolLogo') {
        await api.saveSchool({ logo_url: url });
        await reload();
      } else edit(t, url);
      notify(t === 'schoolLogo' ? 'تم حفظ الشعار.' : 'الصورة جاهزة. اضغط «نشر على الشاشة» لعرضها على التلفزيون.');
    } catch (e) {
      notify((e as Error).message || 'تعذّر الرفع.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
      setBusy(false);
    }
  };

  const fileInput = <input ref={fileRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />;

  const [presetName, setPresetName] = useState('');
  const [editingPreset, setEditingPreset] = useState<string | null>(null);
  const openPresetEditor = (id: string | null, name: string) => {
    setEditingPreset(id);
    setPresetName(name);
    setModal('preset');
  };

  return (
    <Ctx.Provider
      value={{ data, loadError, reload, selectScreen, tab, setTab, modal, setModal, content, edit, setContent, template, setTemplate, dirty, busy, toast, notify, run, chooseImage, fileInput, presetName, setPresetName, editingPreset, openPresetEditor }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAdmin() {
  const s = useContext(Ctx);
  if (!s) throw Error('useAdmin outside provider');
  return s;
}

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('ar-SA-u-ca-gregory', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' });
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('ar-SA-u-ca-gregory', { timeZone: 'Asia/Riyadh' });
export const fmtDate = (ymd: string) => new Date(ymd + 'T00:00:00+03:00').toLocaleDateString('ar-SA-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' });
