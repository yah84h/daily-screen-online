export type QudratLeader = { name: string; rank: number; score: number };
export type QudratExam = {
  kind: string;
  title: string;
  kind_label: string;
  leaders: QudratLeader[];
};
export type QudratData = { week: number | null; updated_at: string | null; exams: QudratExam[] };
export type QudratOptions = {
  layout: 'podium' | 'list';
  exam: 'weekly' | 'gat' | 'all';
  pageSize: 2 | 3 | 4;
};
export type QudratPage = {
  exam: QudratExam;
  top: QudratLeader[];
  rows: QudratLeader[];
  page: number;
  pageCount: number;
};
export function normalizeLeaderboard(input: unknown): QudratData;
export function leaderboardOptions(value?: Partial<QudratOptions>): QudratOptions;
export function leaderboardPages(data: QudratData, options?: Partial<QudratOptions>): QudratPage[];
