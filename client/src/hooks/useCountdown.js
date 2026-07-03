import { useState, useEffect, useRef, useCallback } from 'react';

/** Simple countdown timer in seconds. Call start(n) to (re)start. */
export function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef(null);

  const start = useCallback((s) => {
    clearInterval(ref.current);
    setSeconds(s);
    ref.current = setInterval(() => {
      setSeconds((v) => {
        if (v <= 1) { clearInterval(ref.current); return 0; }
        return v - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => clearInterval(ref.current), []);
  return { seconds, start };
}
