import type { Gastos, ParteGasto } from "@/lib/types";

const cent = (v: number) => Math.round(v * 100);

/** Reparte un monto en partes iguales al centavo; los centavos sobrantes van a los primeros. */
export function repartirIgual(monto: number, userIds: string[]): ParteGasto[] {
  if (!userIds.length) return [];
  const total = cent(monto), base = Math.floor(total / userIds.length), resto = total - base * userIds.length;
  return userIds.map((userId, i) => ({ userId, monto: (base + (i < resto ? 1 : 0)) / 100 }));
}

export interface Saldo { userId: string; pagado: number; consumo: number; neto: number }
export interface Transferencia { deId: string; aId: string; monto: number }

/**
 * Saldo de cada persona: lo que pagó de su bolsa menos lo que le tocaba, más lo que
 * ya liquidó a otros y menos lo que otros le liquidaron. Positivo: le deben. Negativo: debe.
 */
export function saldos(g: Gastos): Saldo[] {
  const m = new Map<string, { pagado: number; consumo: number; neto: number }>();
  const de = (u: string) => { let s = m.get(u); if (!s) m.set(u, (s = { pagado: 0, consumo: 0, neto: 0 })); return s; };
  for (const p of g.participantes) de(p.userId);
  for (const x of g.gastos) {
    de(x.pagadoPor).pagado += cent(x.monto);
    de(x.pagadoPor).neto += cent(x.monto);
    for (const pt of x.partes) { de(pt.userId).consumo += cent(pt.monto); de(pt.userId).neto -= cent(pt.monto); }
  }
  for (const l of g.liquidaciones) { de(l.deId).neto += cent(l.monto); de(l.aId).neto -= cent(l.monto); }
  return [...m].map(([userId, s]) => ({ userId, pagado: s.pagado / 100, consumo: s.consumo / 100, neto: s.neto / 100 }));
}

/** Mínimas transferencias para quedar a mano: el que más debe le paga al que más le deben. */
export function aMano(s: Saldo[]): Transferencia[] {
  const deudores = s.filter((x) => x.neto < -0.004).map((x) => ({ id: x.userId, c: -cent(x.neto) })).sort((a, b) => b.c - a.c);
  const acreedores = s.filter((x) => x.neto > 0.004).map((x) => ({ id: x.userId, c: cent(x.neto) })).sort((a, b) => b.c - a.c);
  const out: Transferencia[] = [];
  let i = 0, j = 0;
  while (i < deudores.length && j < acreedores.length) {
    const c = Math.min(deudores[i].c, acreedores[j].c);
    if (c > 0) out.push({ deId: deudores[i].id, aId: acreedores[j].id, monto: c / 100 });
    deudores[i].c -= c; acreedores[j].c -= c;
    if (!deudores[i].c) i++;
    if (!acreedores[j].c) j++;
  }
  return out;
}
