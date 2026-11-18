// Presenting mode ("وضع التقديم"): pure rules shared by the TV, the admin remote and tests.
// The show lives on the TV only; the phone sends commands, the TV owns the state.

export const SHOW_KINDS = ['image', 'video', 'deck'];
export const MAX_ITEMS = 60;
export const MAX_SLIDES = 200;

/** Every item becomes one or more steps: a deck becomes one step per slide. */
export function showSteps(items) {
  const steps = [];
  for (const item of items || []) {
    if (item.kind === 'deck') {
      const count = Math.max(0, Math.min(MAX_SLIDES, Number(item.parts) || 0));
      for (let part = 0; part < count; part++) steps.push({ item: item.id, part, kind: 'image' });
    } else steps.push({ item: item.id, part: 0, kind: item.kind });
  }
  return steps;
}

/** Storage key of one stored file (a deck slide is a part of its item). */
export const partKey = (item, part = 0) => item + '#' + part;

export const defaultSettings = () => ({
  autoNext: false,
  imageSeconds: 10,
  loop: false,
  loadingPage: true,
});

export function emptyShow() {
  return {
    title: '',
    items: [],
    phase: 'standby',
    step: 0,
    revision: 0,
    blackout: false,
    settings: defaultSettings(),
    background: null,
  };
}

function cleanSettings(raw) {
  const base = defaultSettings();
  return {
    autoNext: typeof raw?.autoNext === 'boolean' ? raw.autoNext : base.autoNext,
    imageSeconds: Math.max(
      3,
      Math.min(600, Math.round(Number(raw?.imageSeconds) || base.imageSeconds)),
    ),
    loop: typeof raw?.loop === 'boolean' ? raw.loop : base.loop,
    loadingPage: typeof raw?.loadingPage === 'boolean' ? raw.loadingPage : base.loadingPage,
  };
}

const clean = (text, max) =>
  Array.from(String(text || ''))
    .filter((char) => char.charCodeAt(0) >= 32)
    .join('')
    .trim()
    .slice(0, max);

export function cleanItem(raw) {
  const kind = SHOW_KINDS.includes(raw?.kind) ? raw.kind : null;
  const id = /^[a-zA-Z0-9-]{6,64}$/.test(raw?.id || '') ? raw.id : null;
  if (!kind || !id) throw Error('عنصر غير صالح');
  const source = raw.source === 'link' ? 'link' : 'phone';
  const url = source === 'link' ? clean(raw.url, 2000) : '';
  if (source === 'link' && !/^https:\/\//.test(url)) throw Error('الرابط يجب أن يبدأ بـ https://');
  return {
    id,
    kind,
    source,
    url,
    name: clean(raw.name, 120) || 'ملف',
    parts: kind === 'deck' ? Math.max(1, Math.min(MAX_SLIDES, Number(raw.parts) || 1)) : 1,
    size: Math.max(0, Number(raw.size) || 0),
    ...itemOptions(raw),
  };
}

export const AFTER = ['auto', 'next', 'standby', 'stay'];
/** What happens when a file finishes, and how early (seconds) a video hands over. */
function itemOptions(raw) {
  return {
    after: AFTER.includes(raw?.after) ? raw.after : 'auto',
    lead: Math.max(0, Math.min(10, Math.round(Number(raw?.lead) || 0))),
  };
}

/** The end rule for a file: 'auto' follows the show's auto-advance setting. */
export function endRule(show, item) {
  const after = item?.after || 'auto';
  return after === 'auto' ? (show.settings?.autoNext ? 'next' : 'stay') : after;
}

/** Apply one remote command. Returns the new show (never mutates). */
export function showReduce(show, command) {
  const s = { ...emptyShow(), ...show, settings: cleanSettings(show?.settings) };
  const steps = showSteps(s.items);
  const last = Math.max(0, steps.length - 1);
  const bump = (next) => ({ ...s, ...next, revision: (s.revision || 0) + 1 });
  switch (command?.op) {
    case 'title':
      return bump({ title: clean(command.title, 80) });
    case 'add': {
      if (s.phase === 'live') throw Error('أنهِ العرض قبل تعديل الملفات');
      if (s.items.length >= MAX_ITEMS) throw Error('الحد الأقصى ' + MAX_ITEMS + ' ملفًا');
      const item = cleanItem(command.item);
      if (s.items.some((existing) => existing.id === item.id)) return s;
      return bump({ items: [...s.items, item] });
    }
    case 'remove':
      if (s.phase === 'live') throw Error('أنهِ العرض قبل تعديل الملفات');
      return bump({ items: s.items.filter((item) => item.id !== command.id), step: 0 });
    case 'move': {
      if (s.phase === 'live') throw Error('أنهِ العرض قبل تعديل الملفات');
      const from = s.items.findIndex((item) => item.id === command.id);
      const to = from + (command.by === -1 ? -1 : 1);
      if (from < 0 || to < 0 || to >= s.items.length) return s;
      const items = [...s.items];
      [items[from], items[to]] = [items[to], items[from]];
      return bump({ items, step: 0 });
    }
    case 'clear':
      return { ...emptyShow(), title: s.title, revision: (s.revision || 0) + 1 };
    case 'start':
      if (!steps.length) throw Error('أضف ملفًا واحدًا على الأقل');
      return bump({ phase: 'live', step: 0, blackout: false });
    case 'next':
      if (s.phase !== 'live') return s;
      return bump({ step: Math.min(last, s.step + 1) });
    case 'previous':
      if (s.phase !== 'live') return s;
      return bump({ step: Math.max(0, s.step - 1) });
    case 'goto': {
      const index = Number(command.index);
      if (!Number.isInteger(index) || index < 0 || index > last) throw Error('رقم غير صالح');
      return bump({ phase: 'live', step: index });
    }
    case 'advance':
      // Automatic step after a video ends or an image's time is up.
      if (s.phase !== 'live') return s;
      if (s.step < last) return bump({ step: s.step + 1 });
      return s.settings.loop ? bump({ step: 0 }) : s;
    case 'item': {
      // Per-file options; allowed during the show (no files change).
      const found = s.items.some((item) => item.id === command.id);
      if (!found) throw Error('الملف غير موجود');
      return bump({
        items: s.items.map((item) =>
          item.id === command.id
            ? { ...item, ...itemOptions({ ...item, ...command.options }) }
            : item,
        ),
      });
    }
    case 'finish': {
      // The current file ended (or reached its early hand-over point).
      if (s.phase !== 'live' || !steps.length) return s;
      const current = steps[s.step];
      const item = s.items.find((entry) => entry.id === current.item);
      const lastPart = !steps[s.step + 1] || steps[s.step + 1].item !== current.item;
      const rule = lastPart ? endRule(s, item) : s.settings.autoNext ? 'next' : 'stay';
      if (rule === 'stay') return s;
      if (rule === 'next') {
        if (s.step < last) return bump({ step: s.step + 1 });
        return s.settings.loop ? bump({ step: 0 }) : s;
      }
      // Back to the standby screen; «متابعة» continues with the next file.
      if (s.step < last) return bump({ phase: 'paused', step: s.step + 1 });
      return bump({ phase: s.settings.loop ? 'paused' : 'standby', step: 0 });
    }
    case 'play': {
      // Play a file now, out of order (first slide of a PowerPoint).
      const index = steps.findIndex((step) => step.item === command.id);
      if (index < 0) throw Error('الملف غير موجود');
      return bump({ phase: 'live', step: index, blackout: false });
    }
    case 'blackout':
      return bump({
        blackout: typeof command.value === 'boolean' ? command.value : !s.blackout,
      });
    case 'background': {
      // Standby background: a photo / GIF or a looping video sent from the phone like any file;
      // null = the school loop clip.
      if (!command.item) return bump({ background: null });
      const kind = command.item.kind === 'video' ? 'video' : 'image';
      const item = cleanItem({ ...command.item, kind, source: 'phone' });
      return bump({ background: { id: item.id, name: item.name, kind } });
    }
    case 'settings':
      return bump({ settings: cleanSettings({ ...s.settings, ...command.settings }) });
    case 'standby':
      return bump({ phase: s.phase === 'live' ? 'paused' : 'standby' });
    case 'resume':
      if (s.phase !== 'paused') return s;
      return bump({ phase: 'live' });
    case 'end':
      return bump({ phase: 'standby', step: 0, blackout: false });
    default:
      throw Error('أمر غير معروف');
  }
}

/** Ready = every part of every item is stored and checked on the TV. */
/** The file a part belongs to: a show item, or the standby background photo. */
export function findPartOwner(show, id) {
  const item = (show?.items || []).find((entry) => entry.id === id);
  if (item) return item;
  if (show?.background?.id === id)
    return {
      id,
      kind: show.background.kind === 'video' ? 'video' : 'image',
      source: 'phone',
      url: '',
      name: show.background.name,
      parts: 1,
      size: 0,
    };
  return null;
}

export function showReadiness(items, stored) {
  let total = 0,
    ready = 0;
  for (const item of items || [])
    for (let part = 0; part < (item.kind === 'deck' ? item.parts : 1); part++) {
      total++;
      if (stored?.[partKey(item.id, part)]) ready++;
    }
  return { total, ready, complete: total > 0 && ready === total };
}
