import type { CSSProperties } from "react";

/** Inline `--od-gap` (plus other styles or custom properties) for the layout primitives (.od-stack, .od-row, .od-grid…). */
export const gap = (px: number, extra?: Record<string, string | number>) =>
    ({ "--od-gap": `${px}px`, ...extra }) as CSSProperties;
