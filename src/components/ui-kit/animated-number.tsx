"use client";

import { animate, useMotionValue, useReducedMotion, useTransform, motion } from "motion/react";
import { useEffect } from "react";
import { formatVND } from "@/lib/money";

/** Counts from the previous value to the new one; money stays tabular. */
export function AnimatedMoney({ value, className, sign }: { value: number; className?: string; sign?: boolean }) {
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(reduced ? value : 0);
  const text = useTransform(motionValue, (v) => formatVND(Math.round(v), { sign }));

  useEffect(() => {
    if (reduced) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.7, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, reduced, motionValue]);

  return (
    <motion.span className={className} data-money aria-label={formatVND(value, { sign })}>
      {text}
    </motion.span>
  );
}
