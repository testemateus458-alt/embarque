"use client";

import { useEffect, useRef, useState } from "react";

type AnimatedNumberProps = {
  value: number;
  pad?: number;
};

/** Keeps the server render stable and animates later metric updates in place. */
export function AnimatedNumber({ value, pad = 0 }: AnimatedNumberProps) {
  const target = Number.isFinite(value) ? value : 0;
  const [displayed, setDisplayed] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | null = null;

    const cancel = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
    };

    const finish = () => {
      cancel();
      current.current = target;
      setDisplayed(target);
    };

    const onPreferenceChange = () => {
      if (preference.matches) finish();
    };

    preference.addEventListener("change", onPreferenceChange);

    if (preference.matches || current.current === target) {
      finish();
    } else {
      const startValue = current.current;
      let startedAt: number | null = null;

      const tick = (timestamp: number) => {
        if (startedAt === null) startedAt = timestamp;
        const progress = Math.min((timestamp - startedAt) / 480, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const next = startValue + (target - startValue) * eased;

        current.current = next;
        setDisplayed(progress === 1 ? target : Math.round(next));

        if (progress < 1) frame = window.requestAnimationFrame(tick);
        else frame = null;
      };

      frame = window.requestAnimationFrame(tick);
    }

    return () => {
      cancel();
      preference.removeEventListener("change", onPreferenceChange);
    };
  }, [target]);

  const digits = String(Math.abs(displayed)).padStart(Math.max(0, pad), "0");

  return <span className="animated-number" style={{ fontVariantNumeric: "tabular-nums" }}>{displayed < 0 ? "-" : ""}{digits}</span>;
}
