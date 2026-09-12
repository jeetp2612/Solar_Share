export function formatInr(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Price per kWh, e.g. "₹8.50/kWh". */
export function formatInrPerKwh(value: number): string {
  return `${formatInr(value, 2)}/kWh`;
}

export function formatKwh(value: number, digits = 1): string {
  return `${value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} kWh`;
}

export function formatCompact(value: number, digits = 1): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function shortAddr(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function maskUpiId(upiId: string): string {
  const [name, handle] = upiId.split("@");
  if (!name || !handle) return upiId;
  const visible = name.length <= 3 ? name : `${name.slice(0, 3)}…${name.slice(-1)}`;
  return `${visible}@${handle}`;
}

/** IST clock (India Standard Time, UTC+5:30). */
export function formatClock(ts: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(ts));
}

export function mockTxHash(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function mockOrderId(): string {
  return `ord_${crypto.randomUUID().slice(0, 8)}`;
}
