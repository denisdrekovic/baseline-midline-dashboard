"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatter?: (n: number) => string;
}

export default function AnimatedNumber({
  value,
  duration = 1000,
  formatter = (n) => n.toFixed(0),
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);
  const startTime = useRef<number>(0);

  useEffect(() => {
    const start = ref.current;
    startTime.current = Date.now();
    let rafId: number;

    const animate = () => {
      const elapsed = Date.now() - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (value - start) * eased;
      setDisplay(current);
      ref.current = current;

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration]);

  return (
    <>
      {/* Visual animated value — hidden from screen readers */}
      <span aria-hidden="true">{formatter(display)}</span>
      {/* Stable value for screen readers — only announces final value */}
      <span className="sr-only">{formatter(value)}</span>
    </>
  );
}
