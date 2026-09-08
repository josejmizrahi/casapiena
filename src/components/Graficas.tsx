import { Bar, BarChart, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useProyecto } from "@/hooks/useProyecto";
import { fm } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Se carga bajo demanda: recharts pesa y solo se usa en Resumen.
export default function Graficas() {
  const { calc } = useProyecto();
  const data = calc.partidas.filter((x) => x.candadoEf > 0 || x.comprometido > 0).map((x) => ({ nombre: x.nombre, candado: x.candadoEf, comprometido: x.comprometido, excedido: x.excedido }));
  const pico = calc.flujo.length ? calc.flujo.reduce((a, b) => (b.pagado + b.previsto > a.pagado + a.previsto ? b : a)) : null;
  const prox = calc.flujo.find((m) => m.previsto > 0);
  return (
    <>
      {calc.flujo.length > 0 && (
        <Card>
          <CardHeader><div><CardTitle>Flujo de caja por mes</CardTitle><CardDescription>Lo previsto usa la fecha límite de cada relación.</CardDescription></div></CardHeader>
          <CardContent>
            <div className="h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calc.flujo} margin={{ left: -14, right: 6, top: 4, bottom: 0 }}>
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <Tooltip formatter={(v: number, k: string) => [fm(v), k === "pagado" ? "Pagado" : "Previsto"]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => (v === "pagado" ? "Pagado" : "Previsto")} />
                  <Bar dataKey="pagado" stackId="a" fill="#2F7D4E" />
                  <Bar dataKey="previsto" stackId="a" fill="#E0B457" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {pico && <p className="text-xs text-muted-foreground mt-2 num">Mes más pesado: {pico.mes} con {fm(pico.pagado + pico.previsto)}.{prox ? ` Próxima salida prevista: ${prox.mes}, ${fm(prox.previsto)}.` : ""}</p>}
          </CardContent>
        </Card>
      )}
      {data.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Comprometido vs candado</CardTitle></CardHeader>
          <CardContent>
            <div style={{ height: Math.max(160, data.length * 34) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }} barCategoryGap={8}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="nombre" width={118} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, k: string) => [fm(v), k === "candado" ? "Candado" : "Comprometido"]} />
                  <Bar dataKey="candado" fill="#E8D7A6" radius={3} />
                  <Bar dataKey="comprometido" radius={3}>{data.map((d, i) => <Cell key={i} fill={d.excedido ? "#B23A32" : "#2F7D4E"} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
