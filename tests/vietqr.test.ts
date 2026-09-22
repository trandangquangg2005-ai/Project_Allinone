import { describe, expect, it } from "vitest";
import { buildVietQRPayload, crc16, toTransferNote } from "@/lib/vietqr";

describe("VietQR", () => {
  it("uses CRC-16/CCITT-FALSE", () => {
    // Standard check value for this CRC variant.
    expect(crc16("123456789")).toBe("29B1");
  });

  it("builds a dynamic payload with amount and note", () => {
    const payload = buildVietQRPayload({ bankBin: "970422", accountNumber: "0123456789", amount: 50_000, note: "HP Nguyễn An T9" });
    expect(payload.startsWith("000201010212")).toBe(true); // dynamic QR
    expect(payload).toContain("0010A000000727"); // NAPAS GUID
    expect(payload).toContain("0006970422"); // bank BIN
    expect(payload).toContain("01100123456789"); // account
    expect(payload).toContain("0208QRIBFTTA"); // transfer to account
    expect(payload).toContain("5303704"); // VND
    expect(payload).toContain("540550000"); // amount
    expect(payload).toContain("5802VN");
    expect(payload).toContain("HP NGUYEN AN T9");
    // The CRC covers everything before it, including "6304".
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it("builds a static payload without amount", () => {
    const payload = buildVietQRPayload({ bankBin: "970436", accountNumber: "123" });
    expect(payload.startsWith("000201010211")).toBe(true);
    expect(payload).not.toContain("54");
  });

  it("makes transfer notes ASCII and short", () => {
    expect(toTransferNote("Học phí Đặng Thị Ánh tháng 9")).toBe("HOC PHI DANG THI ANH THAN");
    expect(toTransferNote("a/b#c")).toBe("A B C");
  });
});
