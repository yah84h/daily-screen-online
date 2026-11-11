import { useEffect, useState, type SetStateAction } from 'react';

type TextTurn = { role: 'user' | 'assistant'; content: string };
type Conversation<T> = { id: string; title: string; turns: T[]; draft: string; updatedAt: number };
/** Only messages/proposal metadata are persisted; File objects and OAuth tokens never enter storage. */
export function useConversations<T extends TextTurn>(
  scope: string,
  validate: (value: unknown) => T | null,
) {
  const key = 'school-assistant-chats-v1:' + scope;
  const [state, setState] = useState<{ active: string; items: Conversation<T>[] }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (Array.isArray(saved?.items)) {
        const items: Conversation<T>[] = saved.items
          .slice(0, 20)
          .filter(
            (item: Conversation<T>) =>
              typeof item.id === 'string' &&
              typeof item.title === 'string' &&
              Array.isArray(item.turns),
          )
          .map((item: Conversation<T>) => ({
            ...item,
            title: item.title.slice(0, 80),
            draft: typeof item.draft === 'string' ? item.draft.slice(0, 6000) : '',
            turns: item.turns
              .slice(-80)
              .map(validate)
              .filter((turn): turn is T => !!turn),
          }));
        if (items.length)
          return {
            active: items.some((item) => item.id === saved.active) ? saved.active : items[0].id,
            items,
          };
      }
    } catch {}
    const id = crypto.randomUUID();
    return {
      active: id,
      items: [{ id, title: 'محادثة جديدة', turns: [], draft: '', updatedAt: Date.now() }],
    };
  });
  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    try {
      const encoded = JSON.stringify(state);
      if (encoded.length > 2 * 1024 * 1024) throw Error('size');
      localStorage.setItem(key, encoded);
      setStorageError('');
    } catch {
      setStorageError('تعذر حفظ المحادثات على هذا المتصفح. انسخ الرسائل المهمة قبل إغلاق الصفحة.');
    }
  }, [key, state]);
  const current = state.items.find((item) => item.id === state.active)!;
  const setTurns = (action: SetStateAction<T[]>) =>
    setState((previous) => ({
      ...previous,
      items: previous.items.map((item) => {
        if (item.id !== previous.active) return item;
        const turns = (typeof action === 'function' ? action(item.turns) : action).slice(-80);
        return {
          ...item,
          turns,
          title:
            turns
              .find((turn) => turn.role === 'user')
              ?.content.split('\n')[0]
              .slice(0, 70) || item.title,
          updatedAt: Date.now(),
        };
      }),
    }));
  const setText = (draft: string) =>
    setState((previous) => ({
      ...previous,
      items: previous.items.map((item) =>
        item.id === previous.active ? { ...item, draft } : item,
      ),
    }));
  const startNew = () =>
    setState((previous) => {
      const empty = previous.items.find((item) => !item.turns.length && !item.draft);
      if (empty) return { ...previous, active: empty.id };
      const id = crypto.randomUUID();
      return {
        active: id,
        items: [
          { id, title: 'محادثة جديدة', turns: [], draft: '', updatedAt: Date.now() },
          ...previous.items,
        ].slice(0, 20),
      };
    });
  const select = (id: string) =>
    setState((previous) =>
      previous.items.some((item) => item.id === id) ? { ...previous, active: id } : previous,
    );
  return {
    turns: current.turns,
    text: current.draft,
    setTurns,
    setText,
    startNew,
    select,
    currentId: state.active,
    conversations: state.items,
    storageError,
  };
}
