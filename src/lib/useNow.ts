import { useEffect, useState } from "react";

/**
 * Ticks on the minute boundary rather than every N seconds, so the displayed
 * clock changes the instant the minute does instead of drifting up to a tick
 * behind it. Also re-aligns after sleep/suspend, which a fixed interval won't.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const msToNextMinute = 60_000 - (Date.now() % 60_000);
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, msToNextMinute + 50);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return now;
}
