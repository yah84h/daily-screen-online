import { Component, type ReactNode } from 'react';
import { recordError } from '@/lib/tvHealth';
import { createWindowCounter } from '@/lib/tvWatchdog';

const RECOVER_MS = 4_000;
// Too many crashes in a short time → reload the whole page instead of remounting forever.
const crashes = createWindowCounter(10 * 60_000);
const MAX_CRASHES = 4;

type Props = { children: ReactNode; fallback?: ReactNode; onReload?: () => void };
type State = { failed: boolean; attempt: number };

/** Catches render errors on the TV, keeps a dark screen (never white) and recovers on its own. */
export class TvErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, attempt: 0 };
  private timer = 0;

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    recordError(error);
    if (crashes.add() >= MAX_CRASHES) {
      (this.props.onReload ?? (() => location.reload()))();
      return;
    }
    clearTimeout(this.timer);
    this.timer = window.setTimeout(
      () => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 })),
      RECOVER_MS,
    );
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  render() {
    if (this.state.failed)
      return (
        this.props.fallback ?? (
          <div className="tv-recovering" role="status">
            جارٍ استعادة العرض…
          </div>
        )
      );
    // A new key forces a clean remount of the subtree after recovery.
    return (
      <div key={this.state.attempt} style={{ display: 'contents' }}>
        {this.props.children}
      </div>
    );
  }
}
