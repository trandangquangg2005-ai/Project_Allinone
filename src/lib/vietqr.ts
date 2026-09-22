// VietQR (NAPAS 247) payload, built locally per the EMVCo QR spec so no
// third-party service sees the account or amount.

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as EMVCo requires. */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(input)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Bank apps only accept plain ASCII in the transfer note. */
export function toTransferNote(text: string, maxLength = 25): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, maxLength)
    .trim();
}

export function buildVietQRPayload(input: {
  bankBin: string;
  accountNumber: string;
  amount?: number;
  note?: string;
}): string {
  const account = input.accountNumber.replace(/\s/g, "");
  const beneficiary = tlv("00", input.bankBin) + tlv("01", account);
  const merchant = tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA");
  const amount = input.amount && input.amount > 0 ? Math.round(input.amount) : undefined;
  const note = input.note ? toTransferNote(input.note) : "";

  let payload =
    tlv("00", "01") +
    tlv("01", amount ? "12" : "11") +
    tlv("38", merchant) +
    tlv("53", "704") +
    (amount ? tlv("54", String(amount)) : "") +
    tlv("58", "VN") +
    (note ? tlv("62", tlv("08", note)) : "");
  payload += "6304";
  return payload + crc16(payload);
}
