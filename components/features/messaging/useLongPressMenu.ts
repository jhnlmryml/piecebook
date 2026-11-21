"use client";

import { useCallback, useEffect, useRef } from "react";

const LONG_PRESS_DELAY_MS = 550;

export function useLongPressMenu() {
  const timerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const start = useCallback(
    (onLongPress: () => void, suppressClick = false) => {
      cancel();
      suppressClickRef.current = false;
      timerRef.current = window.setTimeout(() => {
        onLongPress();
        suppressClickRef.current = suppressClick;
        timerRef.current = null;
      }, LONG_PRESS_DELAY_MS);
    },
    [cancel],
  );

  const wasLongPress = useCallback(
    () => suppressClickRef.current,
    [],
  );

  const consumeLongPress = useCallback(() => {
    const shouldSuppressClick = suppressClickRef.current;
    suppressClickRef.current = false;
    return shouldSuppressClick;
  }, []);

  const reset = useCallback(() => {
    suppressClickRef.current = false;
  }, []);

  useEffect(() => cancel, [cancel]);

  return { start, cancel, wasLongPress, consumeLongPress, reset };
}
