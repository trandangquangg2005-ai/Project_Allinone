// VND has no minor unit: every amount is a whole number of đồng.

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

export function formatNumber(value: number): string {
  return numberFormat.format(Math.round(value));
}

/** 1500000 → "1.500.000 ₫"; negative values use a true minus sign. */
export function formatVND(value: number, options: { sign?: boolean } = {}): string {
  const abs = formatNumber(Math.abs(value));
  const sign = value < 0 ? "−" : options.sign && value > 0 ? "+" : "";
  return `${sign}${abs} ₫`;
}

function oneDecimal(value: number): string {
  return (Math.round(value * 10) / 10).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

/** Short labels for charts and chips: 150k, 1,5 tr, 2 tỷ. */
export function formatCompactVND(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}${oneDecimal(abs / 1e9)} tỷ`;
  if (abs >= 1e6) return `${sign}${oneDecimal(abs / 1e6)} tr`;
  if (abs >= 1e3) return `${sign}${oneDecimal(abs / 1e3)}k`;
  return `${sign}${abs}`;
}

const UNITS: Record<string, number> = {
  k: 1e3,
  n: 1e3,
  ng: 1e3,
  nghin: 1e3,
  "nghìn": 1e3,
  ngan: 1e3,
  "ngàn": 1e3,
  tr: 1e6,
  trieu: 1e6,
  "triệu": 1e6,
  m: 1e6,
  ty: 1e9,
  "tỷ": 1e9,
  "tỉ": 1e9,
  ti: 1e9,
  b: 1e9,
};

/**
 * Parses the ways people type money in Vietnamese:
 * "150000", "150.000", "150,000", "150k", "1.5tr", "1,5 triệu", "2tr5" (2,5 tr),
 * "1 tỷ 2" (1,2 tỷ), "200.000đ". Returns null for anything else.
 */
export function parseVND(input: string): number | null {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/(vnđ|vnd|đồng|đ|₫)$/u, "");
  if (!s) return null;

  const withUnit = s.match(/^(\d+(?:[.,]\d+)?)([a-zà-ỹ]+)(\d+)?$/u);
  if (withUnit) {
    const [, rawBase, rawUnit, rawTail] = withUnit;
    const unit = UNITS[rawUnit];
    if (!unit) return null;
    // "2tr5" only makes sense with an integer head.
    if (rawTail && /[.,]/.test(rawBase)) return null;
    const base = parseFloat(rawBase.replace(",", "."));
    const tail = rawTail ? parseFloat(`0.${rawTail}`) : 0;
    const value = Math.round((base + tail) * unit);
    return Number.isSafeInteger(value) ? value : null;
  }

  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return parseInt(s.replace(/[.,]/g, ""), 10);
  if (/^\d+$/.test(s)) {
    const value = parseInt(s, 10);
    return Number.isSafeInteger(value) ? value : null;
  }
  return null;
}

/** "150000" while typing → "150.000" (digits only). */
export function formatDigitsInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits ? formatNumber(Number(digits)) : "";
}

/** Quick picks while typing a short number: 15 → 15.000 / 150.000 / 1.500.000. */
export function amountSuggestions(raw: string, max = 10_000_000_000): number[] {
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits.length > 4) return [];
  const n = Number(digits);
  if (n === 0) return [];
  return [n * 1_000, n * 10_000, n * 100_000].filter((v) => v <= max);
}

export const MAX_AMOUNT = 100_000_000_000; // 100 tỷ, far above any personal entry
