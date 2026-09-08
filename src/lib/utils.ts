import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

let seq = 0;
export const uid = (p = "id") => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** Convierte texto capturado a número ("$1,200.50" → 1200.5). */
export const num = (v: unknown): number => {
  const x = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isNaN(x) ? 0 : x;
};
const mx0 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const mx2 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fm = (v?: number | null) => mx0.format(v || 0);
export const fm2 = (v?: number | null) => mx2.format(v || 0);
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
export const HOY = () => new Date().toISOString().slice(0, 10);
export const fecha = (s?: string | null) => { if (!s) return "—"; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const mesLabel = (ym: string) => { const [y, m] = ym.split("-"); return `${MESES[parseInt(m) - 1]} ${y.slice(2)}`; };
export const plural = (n: number, s: string, p = s + "s") => `${n} ${n === 1 ? s : p}`;
export const hostDe = (url: string) => { try { return new URL(url.startsWith("http") ? url : "https://" + url).hostname.replace("www.", ""); } catch { return url; } };

export const descargar = (blob: Blob, nombre: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
