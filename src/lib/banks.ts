// NAPAS BIN codes used by VietQR (source: api.vietqr.io/v2/banks).
export const BANKS = [
  { bin: "970436", short: "Vietcombank" },
  { bin: "970418", short: "BIDV" },
  { bin: "970415", short: "VietinBank" },
  { bin: "970405", short: "Agribank" },
  { bin: "970407", short: "Techcombank" },
  { bin: "970422", short: "MBBank" },
  { bin: "970416", short: "ACB" },
  { bin: "970432", short: "VPBank" },
  { bin: "970423", short: "TPBank" },
  { bin: "970403", short: "Sacombank" },
  { bin: "970437", short: "HDBank" },
  { bin: "970441", short: "VIB" },
  { bin: "970443", short: "SHB" },
  { bin: "970426", short: "MSB" },
  { bin: "970448", short: "OCB" },
  { bin: "970431", short: "Eximbank" },
  { bin: "970440", short: "SeABank" },
  { bin: "970449", short: "LPBank" },
  { bin: "970428", short: "NamABank" },
  { bin: "970409", short: "BacABank" },
  { bin: "970425", short: "ABBANK" },
  { bin: "970454", short: "VietCapitalBank" },
  { bin: "970412", short: "PVcomBank" },
  { bin: "970429", short: "SCB" },
  { bin: "970452", short: "KienLongBank" },
  { bin: "970438", short: "BaoVietBank" },
  { bin: "970419", short: "NCB" },
  { bin: "970427", short: "VietABank" },
  { bin: "970430", short: "PGBank" },
  { bin: "970400", short: "SaigonBank" },
  { bin: "970424", short: "ShinhanBank" },
  { bin: "422589", short: "CIMB" },
  { bin: "546034", short: "CAKE by VPBank" },
  { bin: "963388", short: "Timo" },
] as const;

export function bankName(bin: string | null | undefined): string | null {
  if (!bin) return null;
  return BANKS.find((b) => b.bin === bin)?.short ?? null;
}
