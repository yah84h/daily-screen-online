export type ShowKind = 'image' | 'video' | 'deck' | 'break';
export type ShowItem = {
  id: string;
  kind: ShowKind;
  source: 'phone' | 'link';
  url: string;
  name: string;
  parts: number;
  size: number;
  /** After this file: follow auto-advance, go next, back to standby, or stay. */
  after: 'auto' | 'next' | 'standby' | 'stay';
  /** Videos: hand over this many seconds before the end (0 = at the end). */
  lead: number;
};
export type ShowPhase = 'standby' | 'live' | 'paused';
export type ShowSettings = {
  autoNext: boolean;
  imageSeconds: number;
  loop: boolean;
  /** Before the show starts, the TV shows what it is preparing (then the standby). */
  loadingPage: boolean;
};
export type Show = {
  title: string;
  items: ShowItem[];
  phase: ShowPhase;
  step: number;
  revision: number;
  blackout: boolean;
  settings: ShowSettings;
  background: { id: string; name: string; kind?: 'image' | 'video' | 'wallpaper' } | null;
  /** Background music: loops under the show, pauses itself while a video plays. */
  music?: ShowMusic | null;
};
export type ShowMusic = { id: string; name: string; playing: boolean; volume: number };
export type ShowStep = { item: string; part: number; kind: 'image' | 'video' | 'break' };
export type ShowCommand =
  | { op: 'title'; title: string }
  | { op: 'add'; item: Partial<ShowItem> }
  | { op: 'remove'; id: string }
  | { op: 'move'; id: string; by: 1 | -1 }
  | { op: 'clear' | 'start' | 'next' | 'previous' | 'standby' | 'resume' | 'end' | 'advance' }
  | { op: 'blackout'; value?: boolean }
  | { op: 'item'; id: string; options: Partial<Pick<ShowItem, 'after' | 'lead'>> }
  | { op: 'finish' }
  | { op: 'play'; id: string }
  | {
      op: 'background';
      item: { id: string; name: string; kind?: 'image' | 'video' | 'wallpaper' } | null;
    }
  | { op: 'music'; item: { id: string; name: string } | null }
  | { op: 'musicPlay'; value?: boolean }
  | { op: 'musicVolume'; value: number }
  | { op: 'settings'; settings: Partial<ShowSettings> }
  | { op: 'goto'; index: number };
export const SHOW_KINDS: ShowKind[];
export const MAX_ITEMS: number;
export const MAX_SLIDES: number;
export function showSteps(items: ShowItem[]): ShowStep[];
export function partKey(item: string, part?: number): string;
export function defaultSettings(): ShowSettings;
export function emptyShow(): Show;
export function cleanItem(raw: unknown): ShowItem;
export function showReduce(show: Show, command: ShowCommand): Show;
export const AFTER: ShowItem['after'][];
export function endRule(show: Show, item?: ShowItem): 'next' | 'standby' | 'stay';
export function findPartOwner(show: Show, id: string): ShowItem | null;
export function showReadiness(
  items: ShowItem[],
  stored: Record<string, boolean>,
): { total: number; ready: number; complete: boolean };
