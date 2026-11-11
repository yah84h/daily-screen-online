import { useEffect, useRef, useState } from 'react';
import {
  Paperclip,
  Send,
  Sparkles,
  Plus,
  Copy,
  Check,
  X,
  FileText,
  LoaderCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { isLocalBackend } from '@/lib/supabase';
import { recognitionOf, timetableFor } from '@/lib/loop';
import {
  validateProposal,
  designKeys,
  type AdminProposal,
} from '../../../local-test/assistant-tools.mjs';
import { useAdmin } from './store';
import { MarkdownMessage } from './assistant/MarkdownMessage';
import { useConversations } from './assistant/useConversations';
import { ScheduleReview } from './assistant/ScheduleReview';
import '@/assistant.css';

type Connection = {
  connected: boolean;
  sharing: boolean;
  pending: boolean;
  error?: string;
  profiles?: { label: string }[];
  url?: string;
};
type Turn = {
  role: 'user' | 'assistant';
  content: string;
  proposal?: AdminProposal;
  baseline?: string;
  applied?: boolean;
  scheduleVersion?: string;
  scheduleRequestId?: string;
  scheduled?: boolean;
};
const textFields = ['title', 'subtitle', 'body', 'badge', 'footer'] as const;
const labels: Record<string, string> = {
  displayMode: 'طريقة العرض',
  schoolName: 'اسم المدرسة',
  loopSchoolName: 'اسم المدرسة في الخلفية',
  background: 'لون الخلفية',
  color: 'لون النص',
  accent: 'لون التمييز',
  fontSize: 'حجم النص',
  loopHidePhoto: 'إخفاء صورة الخلفية',
  showTechQuotes: 'إظهار الومضات التقنية',
  title: 'العنوان',
  subtitle: 'العنوان الفرعي',
  body: 'الرسالة',
  badge: 'الشارة',
  footer: 'التذييل',
  refreshSeconds: 'تحديث قدرات برو (ثانية)',
  clockTextScale: 'حجم نص الساعة',
  boardTextScale: 'حجم نص لوحة التميز',
};
function storedTurn(value: unknown): Turn | null {
  if (!value || typeof value !== 'object') return null;
  const turn = value as Turn;
  if (!['user', 'assistant'].includes(turn.role) || typeof turn.content !== 'string') return null;
  try {
    if (turn.baseline) JSON.parse(turn.baseline);
  } catch {
    return { role: turn.role, content: turn.content };
  }
  let proposal: AdminProposal | undefined;
  try {
    if (turn.proposal) proposal = validateProposal(turn.proposal, true);
  } catch {}
  return { ...turn, content: turn.content.slice(0, 20000), proposal };
}
export function AssistantTab() {
  const { data, content, template, setContent, setTemplate, notify, reload } = useAdmin();
  const { session, permissions } = useAuth();
  const [status, setStatus] = useState<Connection | null>(null),
    [models, setModels] = useState<{ id: string; name: string }[]>([]),
    [model, setModel] = useState('');
  const {
    turns,
    text,
    setTurns,
    setText,
    startNew,
    select,
    currentId,
    conversations,
    storageError,
  } = useConversations<Turn>((session?.user.id || 'anonymous') + ':' + data?.screen.id, storedTurn);
  const [files, setFiles] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [copied, setCopied] = useState<number | null>(null);
  const mounted = useRef(true),
    messages = useRef<HTMLDivElement>(null);
  const baseline = JSON.stringify({ screenId: data?.screen.id, content, template });
  const latest = useRef(baseline);
  latest.current = baseline;
  async function request<T>(input: Record<string, unknown>): Promise<T> {
    if (!isLocalBackend)
      throw Error(
        'ربط ChatGPT على Netlify يحتاج إعداد تسجيل تطبيق مستضاف. الاتصال المحلي متاح عبر npm run dev:local.',
      );
    const response = await fetch('/local/assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + session?.access_token,
      },
      body: JSON.stringify({ ...input, screenId: data?.screen.id }),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error?.message || result.error || 'تعذر الاتصال بالمساعد');
    return result;
  }
  async function refresh() {
    const connection = await request<Connection>({ action: 'status' });
    if (!mounted.current) return;
    setStatus(connection);
    if (connection.connected && connection.sharing) {
      const result = await request<{ models: { id: string; name: string }[] }>({
        action: 'models',
      });
      if (!mounted.current) return;
      setModels(result.models);
      setModel((previous) =>
        result.models.some((m) => m.id === previous) ? previous : result.models[0]?.id || '',
      );
    }
  }
  useEffect(() => {
    mounted.current = true;
    if (isLocalBackend) void refresh().catch((e) => setError(e.message));
    return () => {
      mounted.current = false;
    };
    // Connection belongs to the signed-in staff member; this workspace remounts on screen changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!status?.pending) return;
    const timer = setInterval(() => void refresh().catch((e) => setError(e.message)), 2000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.pending]);
  useEffect(
    () =>
      messages.current?.scrollTo({
        top: messages.current.scrollHeight,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      }),
    [turns, busy],
  );
  async function connect() {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setBusy(true);
    setError('');
    try {
      const next = await request<Connection>({ action: 'connect' });
      setStatus(next);
      if (next.url) {
        if (popup) popup.location.href = next.url;
        else setError('اسمح بالنوافذ المنبثقة ثم أعد تسجيل الدخول.');
      }
    } catch (e) {
      popup?.close();
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if ((!text.trim() && !files.length) || busy || !model) return;
    const question =
        text.trim() ||
        'اقرأ خطة الإذاعة الأسبوعية المرفقة، وحدد التواريخ والمواضيع. اسألني عن أي معلومات ناقصة قبل تجهيز اقتراح الجدولة.',
      attached = files,
      snapshot = baseline;
    setBusy(true);
    setError('');
    const history = turns.slice(-10).map(({ role, content }) => ({ role, content }));
    try {
      const attachments = await Promise.all(
        attached.map(
          (file) =>
            new Promise<{ name: string; data: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve({ name: file.name, data: String(reader.result) });
              reader.onerror = () => reject(Error('تعذر قراءة الملف'));
              reader.readAsDataURL(file);
            }),
        ),
      );
      const draft = {
        content: Object.fromEntries(textFields.map((key) => [key, content[key]])),
        previewDate: content.autoDate
          ? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' })
          : content.date,
        periods: timetableFor(template).periods,
        design: Object.fromEntries(
          designKeys.map((key) => [key, template[key as keyof typeof template]]),
        ),
        displayMode: template.displayMode,
        clockTextScale: template.clockTextScale,
        boardTextScale: template.boardTextScale,
        refreshSeconds: recognitionOf(template).qudratPro?.refreshSeconds,
      };
      const reply = await request<{
        text: string;
        proposal: unknown;
        screenId: string;
        scheduleVersion: string;
      }>({
        action: 'chat',
        text: question,
        model,
        files: attachments,
        history,
        draft,
      });
      if (!mounted.current) return;
      const proposal = reply.proposal
        ? validateProposal(reply.proposal, permissions.admin)
        : undefined;
      setTurns((previous) => [
        ...previous,
        {
          role: 'user',
          content:
            question +
            (attached.length ? '\n📎 ' + attached.map((file) => file.name).join('، ') : ''),
        },
        {
          role: 'assistant',
          content: reply.text,
          proposal,
          baseline: snapshot,
          scheduleVersion: reply.scheduleVersion,
          scheduleRequestId: crypto.randomUUID(),
        },
      ]);
      setText('');
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function saveSchedule(index: number) {
    const turn = turns[index];
    if (!turn.proposal?.schedule || turn.scheduled || busy) return;
    setBusy(true);
    setError('');
    try {
      await request({
        action: 'apply_schedule',
        requestId: turn.scheduleRequestId,
        scheduleVersion: turn.scheduleVersion,
        schedule: turn.proposal.schedule,
      });
      if (!mounted.current) return;
      setTurns((previous) =>
        previous.map((item, i) => (i === index ? { ...item, scheduled: true } : item)),
      );
      await reload();
      notify('تم حفظ خطة الإذاعة في الجدولة.');
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  function apply(index: number) {
    const turn = turns[index];
    if (turn.applied || !turn.proposal) return;
    if (turn.baseline !== latest.current) {
      setError('تغيرت المسودة منذ تجهيز الاقتراح. اطلب اقتراحًا جديدًا حتى لا تُستبدل تعديلاتك.');
      return;
    }
    try {
      const proposal = validateProposal(turn.proposal, permissions.admin);
      if (proposal.content) setContent({ ...content, ...proposal.content });
      if (
        proposal.design ||
        proposal.periods ||
        proposal.refreshSeconds ||
        proposal.clockTextScale ||
        proposal.boardTextScale
      )
        setTemplate((previous) => ({
          ...previous,
          ...proposal.design,
          ...(proposal.periods
            ? { timetable: { periods: proposal.periods }, timetableSeason: 'custom' as const }
            : {}),
          ...(proposal.refreshSeconds
            ? {
                recognition: {
                  ...recognitionOf(previous),
                  qudratPro: {
                    layout: 'podium',
                    exam: 'weekly',
                    pageSize: 3,
                    ...recognitionOf(previous).qudratPro,
                    refreshSeconds: proposal.refreshSeconds,
                  },
                },
              }
            : {}),
          ...(proposal.clockTextScale ? { clockTextScale: proposal.clockTextScale } : {}),
          ...(proposal.boardTextScale ? { boardTextScale: proposal.boardTextScale } : {}),
        }));
      setTurns((previous) =>
        previous.map((item, i) => (i === index ? { ...item, applied: true } : item)),
      );
      notify('تم تطبيق الاقتراح على المسودة. راجع المحتوى ثم انشره، واحفظ التصميم إذا عدّلته.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="assistant-workspace">
      <div className="assistant-toolbar">
        <div className="assistant-identity">
          <span>
            <Sparkles size={23} />
          </span>
          <div>
            <h2>مساعد المدرسة</h2>
            <p>الإذاعة الأسبوعية، المحتوى، والتصميم</p>
          </div>
        </div>
        <div className="assistant-toolbar-controls">
          <span
            className={'assistant-status' + (status?.sharing ? ' connected' : '')}
            role="status"
          >
            <i />
            {status?.pending
              ? 'بانتظار تسجيل الدخول'
              : status?.sharing
                ? 'متصل بـ ChatGPT'
                : 'غير متصل'}
          </span>
          {status?.sharing && (
            <label className="assistant-model">
              <span className="sr-only">النموذج</span>
              <select
                aria-label="نموذج ChatGPT"
                disabled={busy}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {models.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {isLocalBackend && !status?.sharing && (
            <button
              className="button primary"
              disabled={busy || status?.pending}
              onClick={() => void connect()}
            >
              Continue with ChatGPT
            </button>
          )}
          <button
            className="button white"
            disabled={busy || !turns.length}
            onClick={() => {
              startNew();
              setFiles([]);
              setText('');
              setError('');
            }}
          >
            <Plus size={17} />
            محادثة جديدة
          </button>
        </div>
        <label className="assistant-history-picker">
          المحادثات المحفوظة
          <select
            aria-label="المحادثات المحفوظة"
            disabled={busy}
            value={currentId}
            onChange={(event) => {
              select(event.target.value);
              setFiles([]);
              setError('');
            }}
          >
            {conversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.title}
              </option>
            ))}
          </select>
        </label>
        <details className="assistant-account-info">
          <summary>الحساب والخصوصية</summary>
          <div>
            {status?.profiles?.map((profile) => (
              <small key={profile.label}>{profile.label}</small>
            ))}
            <p>
              تُحفظ آخر ٢٠ محادثة في هذا المتصفح لكل حساب وشاشة. الملفات لا تُحفظ بعد تحديث الصفحة؛
              أعد إرفاقها عند الحاجة. تُرسل الملفات وسياق الشاشة المحددة إلى OpenAI مع كل طلب.
              الملفات المرفقة تبقى متاحة لأسئلتك التالية حتى تزيلها أو تبدأ محادثة جديدة. التغييرات
              تحتاج مراجعتك قبل التطبيق.
            </p>
            <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">
              إدارة استخدام ChatGPT ↗
            </a>
            {status?.connected && (
              <button
                className="button white"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void request<Connection>({ action: 'disconnect' })
                    .then((next) => {
                      setStatus(next);
                      setModels([]);
                      setModel('');
                      setFiles([]);
                    })
                    .catch((e) => setError(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                فصل الحساب
              </button>
            )}
          </div>
        </details>
        {!isLocalBackend && (
          <p className="assistant-notice">
            اتصال ChatGPT متاح في النسخة المحلية. تفعيله على Netlify يحتاج تسجيل التطبيق المستضاف
            لدى OpenAI.
          </p>
        )}
      </div>
      <div className="assistant-chat">
        <div className="assistant-messages" aria-live="polite" ref={messages}>
          {!turns.length && (
            <div className="assistant-welcome">
              <span className="assistant-welcome-icon">
                <Sparkles size={30} />
              </span>
              <h3>ماذا نجهّز لشاشتك؟</h3>
              <p>ارفع جدول الإذاعة كصورة أو ملف، وسأساعدك في تنظيم أيامه. أو اختر طلبًا:</p>
              {[
                'جهّز خطة الإذاعة للأسبوع القادم واسألني عن تاريخ البداية',
                'غيّر تحديث قدرات برو إلى كل دقيقة',
                'اكتب رسالة قصيرة عن الأمن السيبراني',
                'كبّر نص الساعة ولوحة التميز بنسبة 25٪',
              ].map((prompt) => (
                <button key={prompt} onClick={() => setText(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          )}
          {turns.map((turn, index) => (
            <article className={'assistant-turn ' + turn.role} key={index}>
              <div className="assistant-turn-heading">
                <b>{turn.role === 'user' ? 'أنت' : 'مساعد المدرسة'}</b>
                <button
                  type="button"
                  aria-label="نسخ الرسالة"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(turn.content)
                      .then(() => {
                        setCopied(index);
                        setTimeout(() => setCopied(null), 2000);
                      })
                      .catch(() => setError('تعذر النسخ في هذا المتصفح.'));
                  }}
                >
                  {copied === index ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
              {turn.role === 'assistant' ? (
                <MarkdownMessage text={turn.content} />
              ) : (
                <p>{turn.content}</p>
              )}
              {turn.proposal?.schedule && (
                <ScheduleReview
                  schedule={turn.proposal.schedule}
                  disabled={busy}
                  saved={!!turn.scheduled}
                  onSave={() => void saveSchedule(index)}
                />
              )}
              {turn.proposal &&
                Object.keys(turn.proposal).some(
                  (key) => !['summary', 'schedule'].includes(key),
                ) && (
                  <div className="assistant-proposal">
                    <h4>مراجعة التعديل</h4>
                    <dl>
                      {Object.entries(turn.proposal.content || {}).map(([key, value]) => (
                        <div key={key}>
                          <dt>{labels[key]}</dt>
                          <dd>
                            <del>{JSON.parse(turn.baseline || '{}').content?.[key] || '—'}</del>
                            <span>{value || '—'}</span>
                          </dd>
                        </div>
                      ))}
                      {Object.entries(turn.proposal.design || {}).map(([key, value]) => (
                        <div key={key}>
                          <dt>{labels[key] || key}</dt>
                          <dd>
                            {typeof value === 'boolean'
                              ? value
                                ? 'مفعّل'
                                : 'معطّل'
                              : value === 'daily'
                                ? 'المحتوى اليومي'
                                : value === 'loop'
                                  ? 'خلفية الحصص'
                                  : String(value)}
                          </dd>
                        </div>
                      ))}
                      {turn.proposal.periods && (
                        <div>
                          <dt>أوقات الحصص</dt>
                          <dd>
                            {turn.proposal.periods.map((period, i) => (
                              <span key={i}>
                                {i + 1}: {period.join(' – ')}
                              </span>
                            ))}
                          </dd>
                        </div>
                      )}
                      {(['refreshSeconds', 'clockTextScale', 'boardTextScale'] as const).map(
                        (key) =>
                          turn.proposal?.[key] !== undefined && (
                            <div key={key}>
                              <dt>{labels[key]}</dt>
                              <dd>{turn.proposal[key]}</dd>
                            </div>
                          ),
                      )}
                    </dl>
                    <button
                      className="button primary"
                      disabled={busy || turn.applied || turn.baseline !== baseline}
                      onClick={() => apply(index)}
                    >
                      {turn.applied ? 'تم التطبيق على المسودة' : 'تطبيق على المسودة'}
                    </button>
                    {!turn.applied && turn.baseline !== baseline && (
                      <small>تغيرت المسودة؛ اطلب اقتراحًا جديدًا.</small>
                    )}
                  </div>
                )}
            </article>
          ))}
          {busy && (
            <div className="assistant-thinking" role="status">
              <LoaderCircle size={18} />
              جارٍ تجهيز الرد…
            </div>
          )}
        </div>
        {storageError && (
          <p className="assistant-error" role="alert">
            {storageError}
          </p>
        )}
        {(error || status?.error) && (
          <p className="assistant-error" role="alert">
            {error || status?.error}
          </p>
        )}
        <form
          className="assistant-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="assistant-question">
            طلبك للمساعد
          </label>
          <textarea
            id="assistant-question"
            placeholder="ارفع جدول الإذاعة أو اكتب ما تريد تغييره…"
            value={text}
            maxLength={6000}
            onChange={(event) => setText(event.target.value)}
            disabled={busy}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                window.matchMedia('(min-width: 850px)').matches
              ) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <div className="assistant-file-chips">
            {files.map((file, i) => (
              <button
                type="button"
                key={i}
                disabled={busy}
                onClick={() => setFiles((previous) => previous.filter((_, j) => j !== i))}
              >
                <FileText size={16} />
                <span>
                  {file.name}
                  <small>{(file.size / 1024).toFixed(0)} KB</small>
                </span>
                <X size={14} />
              </button>
            ))}
          </div>
          <div>
            <label className="button white">
              <Paperclip size={17} /> إرفاق ملفات
              <input
                type="file"
                multiple
                hidden
                disabled={busy}
                accept=".pdf,.txt,.csv,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.webp"
                onChange={(event) => {
                  const selected = Array.from(event.target.files || []);
                  event.target.value = '';
                  if (
                    selected.length > 2 ||
                    selected.reduce((total, file) => total + file.size, 0) > 6 * 1024 * 1024
                  ) {
                    setError('اختر ملفين على الأكثر، بمجموع لا يتجاوز 6 ميغابايت.');
                    return;
                  }
                  setFiles(selected);
                }}
              />
            </label>
            <small>صور وملفات · ملفان · 6 MB</small>
            <button
              className="button primary"
              disabled={busy || !status?.sharing || !model || (!text.trim() && !files.length)}
            >
              <Send size={17} />
              إرسال
            </button>
          </div>
          <p className="assistant-composer-hint">
            راجع التواريخ والمحتوى قبل التأكيد. Enter للإرسال · Shift + Enter لسطر جديد.
          </p>
        </form>
      </div>
    </section>
  );
}
