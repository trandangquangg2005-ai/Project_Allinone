// Swatches for wallets, categories and students. Each key maps to CSS
// variables defined in globals.css (--swatch-<key> / --swatch-<key>-soft),
// so light and dark themes stay in one place.
export const SWATCHES = ["blue", "green", "teal", "amber", "coral", "violet", "pink", "slate"] as const;
export type Swatch = (typeof SWATCHES)[number];

export function isSwatch(value: string): value is Swatch {
  return (SWATCHES as readonly string[]).includes(value);
}

export function swatchStyle(key: string) {
  const swatch = isSwatch(key) ? key : "slate";
  return {
    color: `var(--swatch-${swatch})`,
    backgroundColor: `var(--swatch-${swatch}-soft)`,
  } as const;
}

export const SWATCH_LABELS: Record<Swatch, string> = {
  blue: "Xanh dương",
  green: "Xanh lá",
  teal: "Xanh ngọc",
  amber: "Vàng",
  coral: "Cam đỏ",
  violet: "Tím",
  pink: "Hồng",
  slate: "Xám",
};
