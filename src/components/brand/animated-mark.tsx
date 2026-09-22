"use client";

import { motion } from "motion/react";

// Same geometry as public/brand/aio-mark.svg (keep the two in sync).
// The facets assemble once when the sign-in page opens; with reduced motion
// MotionConfig renders the final state immediately.
const FACETS: { d: string; fill: string; from: [number, number] }[] = [
  { d: "M9 28 50 5 24.88 52H9z", fill: "#3D95D7", from: [-6, -4] },
  { d: "M9 52h15.88l-4.8 9H9z", fill: "#2E7FC4", from: [-8, 0] },
  { d: "M9 61h11.08L13 74.24 9 72z", fill: "#2568A9", from: [-8, 4] },
  { d: "M40.1 52H50v9H35.41z", fill: "#2E7FC4", from: [-3, 2] },
  { d: "M35.41 61H50v34L25 80.98z", fill: "#2568A9", from: [-3, 6] },
  { d: "M91 28 50 5l25.12 47H91z", fill: "#4DBB8C", from: [6, -4] },
  { d: "M91 52H75.12l4.8 9H91z", fill: "#36AA87", from: [8, 0] },
  { d: "M91 61H79.92L87 74.24 91 72z", fill: "#21967F", from: [8, 4] },
  { d: "M59.9 52H50v9h14.59z", fill: "#36AA87", from: [3, 2] },
  { d: "M64.59 61H50v34l25-14.02z", fill: "#21967F", from: [3, 6] },
  // The A strokes land last.
  { d: "M50 5 13 74.24l12 6.74L50 33z", fill: "#4DAAE4", from: [0, -8] },
  { d: "m50 5 37 69.24-12 6.74L50 33z", fill: "#66CB99", from: [0, -8] },
];

export function AnimatedMark({ size = 72 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <defs>
        <mask id="aio-cuts-anim" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="#fff" />
          <g fill="none" stroke="#000" strokeWidth="2.1">
            <path d="M50 5 11.4 77.24M50 5l38.6 72.24" />
            <path d="M50 33 23.6 83.64M50 33l26.4 50.64" />
            <path d="M50 2v31M50 52v46" />
            <path d="M4 52h20.88M75.12 52H96M4 61h16.08M79.92 61H96" />
            <path d="M40.1 52h19.8M35.41 61h29.18" />
          </g>
          <path d="M50 33 40.1 52h19.8z" fill="#000" />
        </mask>
      </defs>
      <g mask="url(#aio-cuts-anim)">
        {FACETS.map((facet, i) => (
          <motion.path
            key={facet.d}
            d={facet.d}
            fill={facet.fill}
            initial={{ opacity: 0, x: facet.from[0], y: facet.from[1] }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 + i * 0.035, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </g>
      <motion.g
        fill="none"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.55 }}
      >
        <path d="m15.3 40.4 3.6 3.5 6.3-7.3" />
        <path d="M76.8 35.2h4.3l3.3 3.4v6.9a1 1 0 0 1-1 1h-6.6a1 1 0 0 1-1-1v-9.3a1 1 0 0 1 1-1ZM78.4 41.2h4.4M78.4 43.8h2.9" />
        <rect x="38" y="69.4" width="7.4" height="6.8" rx="1.2" />
        <path d="M38 72h7.4M40.2 68v2.4M43.2 68v2.4" />
        <circle cx="58.9" cy="70.6" r="1.85" />
        <path d="M55.7 76.6a3.2 3.2 0 0 1 6.4 0" />
      </motion.g>
    </svg>
  );
}
