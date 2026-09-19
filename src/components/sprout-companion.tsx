"use client";

import { useEffect, useState } from "react";

const MOODS = ["floating", "wandering", "hopping", "waving", "curious"] as const;
const LINES = [
  "growing between sessions",
  "stretching its little legs",
  "ready when you are",
  "cheering for future-you",
  "checking the next revision",
];

export function SproutCompanion() {
  const [mood, setMood] = useState(0);
  const activeMood = mood % MOODS.length;

  useEffect(() => {
    const timeout = window.setTimeout(() => setMood((current) => (current + 1 + Math.floor(Math.random() * 4)) % MOODS.length), 3600 + Math.random() * 4200);
    return () => window.clearTimeout(timeout);
  }, [mood]);

  return (
    <button
      type="button"
      className={`sprout-stage sprout-${MOODS[activeMood]}`}
      onClick={() => setMood((current) => (current + 1) % MOODS.length)}
      aria-label="Wave to your study companion"
    >
      <span className="sprout-glow" />
      <svg className="sprout-character" viewBox="0 0 180 160" role="img" aria-label="Animated sprout study companion">
        <ellipse className="sprout-shadow" cx="90" cy="145" rx="37" ry="7" />
        <g className="sprout-actor">
          <g className="sprout-top">
            <path className="sprout-stem" d="M90 43 C88 32 91 23 88 14" />
            <g className="sprout-leaf sprout-leaf-left">
              <path d="M87 25 C69 26 61 19 58 9 C71 7 84 11 89 20 Z" />
              <path d="M85 21 C77 17 70 14 63 13" />
            </g>
            <g className="sprout-leaf sprout-leaf-right">
              <path d="M91 21 C98 9 112 6 124 11 C120 23 107 29 91 26 Z" />
              <path d="M96 22 C104 17 112 14 119 13" />
            </g>
          </g>

          <g className="sprout-arm sprout-arm-left">
            <path d="M56 90 C45 94 42 106 48 114" />
            <circle cx="48" cy="115" r="4.5" />
          </g>
          <g className="sprout-arm sprout-arm-right">
            <path d="M124 90 C135 94 138 106 132 114" />
            <circle cx="132" cy="115" r="4.5" />
          </g>

          <rect className="sprout-head" x="47" y="42" width="86" height="68" rx="28" />
          <rect className="sprout-face" x="55" y="51" width="70" height="49" rx="22" />
          <g className="sprout-eyes">
            <ellipse cx="76" cy="75" rx="4.2" ry="6" />
            <ellipse cx="104" cy="75" rx="4.2" ry="6" />
          </g>
          <path className="sprout-mouth" d="M84 88 Q90 93 96 88" />
          <circle className="sprout-cheek" cx="67" cy="87" r="4" />
          <circle className="sprout-cheek" cx="113" cy="87" r="4" />

          <path className="sprout-body" d="M65 105 Q90 95 115 105 L111 136 Q90 145 69 136 Z" />
          <path className="sprout-belly" d="M78 111 Q90 106 102 111 L100 130 Q90 135 80 130 Z" />
          <path className="sprout-mark" d="M90 113 L94 120 L90 128 L86 120 Z" />
          <g className="sprout-leg sprout-leg-left"><path d="M79 135 L76 144" /><path d="M68 145 Q77 140 83 145" /></g>
          <g className="sprout-leg sprout-leg-right"><path d="M101 135 L104 144" /><path d="M97 145 Q104 140 112 145" /></g>
        </g>
      </svg>
      <span className="sprout-caption"><i />{LINES[activeMood]}</span>
    </button>
  );
}
