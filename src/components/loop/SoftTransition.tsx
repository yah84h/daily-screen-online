import {displayClock} from '@/lib/clock';
import { useLayoutEffect, useState } from "react";
/** Changes only when the value changes; polling/one-second clock ticks do not restart it. */
export function SoftTransition({
  value,
  className = "",
  animate = true,
}: {
  value: string;
  className?: string;
  animate?: boolean;
}) {
  const [frame, setFrame] = useState<{
    current: string;
    previous: string | null;
  }>({ current: value, previous: null });
  useLayoutEffect(() => {
    setFrame((current) =>
      current.current === value
        ? current
        : { current: value, previous: current.current },
    );
    const timer = setTimeout(
      () =>
        setFrame((current) =>
          current.previous === null ? current : { ...current, previous: null },
        ),
      460,
    );
    return () => clearTimeout(timer);
  }, [value]);
  return (
    <span
      className={
        "soft-transition " + className + (animate ? "" : " motion-disabled")
      }
    >
      {frame.previous !== null && animate && (
        <span
          key={"old:" + frame.previous}
          className="soft-out"
          aria-hidden="true"
        >
          {frame.previous}
        </span>
      )}
      <span
        key={"new:" + frame.current}
        className={frame.previous !== null && animate ? "soft-in" : ""}
      >
        {frame.current}
      </span>
    </span>
  );
}
export function AnimatedClock({
  now,
  animate = true,
}: {
  now: Date;
  animate?: boolean;
}) {
  const time = displayClock(now);
  return (
    <span className="animated-clock" dir="ltr" role="timer" aria-label={time}>
      {time.split("").map((digit, i) =>
        digit === ":" ? (
          <span className="clock-colon" key={i} aria-hidden="true">
            :
          </span>
        ) : (
          <span className="clock-digit" key={i} aria-hidden="true">
            <SoftTransition value={digit} animate={animate} />
          </span>
        ),
      )}
    </span>
  );
}
