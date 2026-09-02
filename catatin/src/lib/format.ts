/** Utilitas format Rupiah, tanggal, dan angka — dipakai di seluruh aplikasi. */

export function formatIDR(value: number, opts?: { compact?: boolean; withSign?: boolean }): string {
  const n = Math.abs(Math.round(value || 0));
  const sign = opts?.withSign && value !== 0 ? (value > 0 ? '+' : '-') : value < 0 ? '-' : '';

  if (opts?.compact) {
    if (n >= 1_000_000_000) return `${sign}Rp ${trimZero(n / 1_000_000_000)} M`;
    if (n >= 1_000_000) return `${sign}Rp ${trimZero(n / 1_000_000)} jt`;
    if (n >= 1_000) return `${sign}Rp ${trimZero(n / 1_000)} rb`;
  }
  return `${sign}Rp ${n.toLocaleString('id-ID')}`;
}

function trimZero(n: number): string {
  const s = n.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2).replace('.', ',') : s.replace('.', ',');
}

/** "1250000" atau "1.250.000" -> 1250000 */
export function parseIDR(input: string): number {
  if (!input) return 0;
  const cleaned = String(input).replace(/[^0-9,-]/g, '').replace(/,/g, '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Format angka saat diketik di input: 1250000 -> "1.250.000" */
export function formatAmountInput(raw: string): string {
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('id-ID');
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function toDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatDateLong(dateStr: string): string {
  const d = toDate(dateStr);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(dateStr: string): string {
  const d = toDate(dateStr);
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDayHeader(dateStr: string): string {
  const d = toDate(dateStr);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return `Hari ini · ${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}`;
  if (isSameDay(d, yest)) return `Kemarin · ${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}`;
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]}`;
}

export function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${BULAN[(m || 1) - 1]} ${y}`;
}

export function formatPeriodShort(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${BULAN_PENDEK[(m || 1) - 1]} ${String(y).slice(2)}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function nowHM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function periodOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function daysInPeriod(period: string): number {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function percent(n: number, digits = 1): string {
  return `${n.toFixed(digits).replace('.', ',')}%`;
}
