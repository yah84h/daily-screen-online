export type PresenterSnapshot = {
  deck: string;
  count: number;
  slide: number;
  black: boolean;
  revision: number;
  ready: boolean;
  error: string;
  pending: boolean;
};
export function createPresenter(options: {
  deck: string;
  count: number;
  send?:
    | ((input: { action: string; index: number; black: boolean }) => Promise<PresenterSnapshot>)
    | null;
  retryMs?: number;
}): {
  getSnapshot: () => PresenterSnapshot;
  subscribe: (fn: () => void) => () => void;
  receive: (data: PresenterSnapshot) => void;
  fail: (message: string) => void;
  apply: (action: string, index?: number) => void;
  dispose: () => void;
};
