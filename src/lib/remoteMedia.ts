import { useEffect, useRef, useState } from 'react';
import { supabase, isLocalBackend } from './supabase';
export type RemoteTask = { label: string; loaded: number; total: number; error?: string };
export type ScreenReport = {
  label: string;
  at: number;
  paused: boolean;
  volume: number;
  position: number;
  duration: number;
  kind: 'video' | 'audio' | 'presentation' | 'photos' | 'none';
  index: number;
  tasks: RemoteTask[];
  blocked: boolean;
  audio?: { position: number; duration: number; paused: boolean } | null;
  video?: { position: number; duration: number; paused: boolean } | null;
};
export type RemoteMediaState = {
  revision: number;
  paused: boolean;
  volume: number;
  downloadsPaused: boolean;
  command: {
    id: string;
    action: 'seek' | 'next' | 'previous' | 'play' | 'pause';
    mode?: 'relative' | 'absolute';
    seconds?: number;
    target?: 'video' | 'audio' | 'all';
    at: number;
  } | null;
  reports: Record<string, ScreenReport>;
  watchUntil?: number;
};
export async function mediaControlRequest(
  screen: string,
  token: string,
  input: Record<string, unknown>,
): Promise<RemoteMediaState> {
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!isLocalBackend && !token) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.Authorization = 'Bearer ' + data.session.access_token;
  }
  const response = await fetch(
    isLocalBackend ? '/local/media-control' : '/.netlify/functions/media-control',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ screen, token, ...input }),
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    },
  );
  const payload = await response.json();
  if (!response.ok) throw Error(payload.error?.message || 'تعذر التحكم بالشاشة.');
  return payload;
}
export function useRemoteMedia(screen: string, token = '') {
  const [state, setState] = useState<RemoteMediaState | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const lastWatch = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chain = useRef(Promise.resolve());
  const writes = useRef(0);
  const alive = useRef(true);
  const accept = (next: RemoteMediaState) =>
    setState((previous) => (!previous || next.revision >= previous.revision ? next : previous));
  useEffect(() => {
    alive.current = true;
    let active = true,
      loading = false;
    const load = async () => {
      if (loading || !active) return;
      loading = true;
      try {
        const watch = !token && Date.now() - lastWatch.current > 20000;
        if (watch) lastWatch.current = Date.now();
        const next = await mediaControlRequest(screen, token, { action: 'state', watch });
        if (active) {
          accept(next);
          setError('');
          if (watch && channelRef.current?.state === 'joined')
            void channelRef.current
              .send({ type: 'broadcast', event: 'refresh', payload: {} })
              .catch(() => {});
        }
      } catch (error) {
        if (active) setError((error as Error).message);
      } finally {
        loading = false;
      }
    };
    const events = isLocalBackend ? new EventSource('/local/events') : null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (events) events.onmessage = () => void load();
    else
      channel = supabase
        .channel('media-control:' + screen)
        .on('broadcast', { event: 'refresh' }, () => void load())
        .subscribe();
    channelRef.current = channel;
    const timer = setInterval(load, isLocalBackend ? 5000 : 15000);
    void load();
    return () => {
      alive.current = false;
      active = false;
      clearInterval(timer);
      events?.close();
      void channel?.unsubscribe();
    };
  }, [screen, token]);
  const send = (input: Record<string, unknown>) => {
    writes.current++;
    setPending(true);
    const task = chain.current
      .catch(() => {})
      .then(async () => {
        try {
          const next = await mediaControlRequest(screen, token, input);
          if (alive.current) {
            accept(next);
            setError('');
          }
          if (!isLocalBackend) {
            const channel = channelRef.current;
            if (channel?.state === 'joined')
              void channel
                .send({ type: 'broadcast', event: 'refresh', payload: {} })
                .catch(() => {});
          }
          return next;
        } catch (error) {
          if (alive.current) setError((error as Error).message);
          throw error;
        } finally {
          writes.current--;
          if (alive.current) setPending(writes.current > 0);
        }
      });
    chain.current = task.then(
      () => {},
      () => {},
    );
    return task;
  };
  return { state, error, pending, send };
}
