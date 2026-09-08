import { useEffect, useState } from "react";
import { Input } from "./input";
import { num } from "@/lib/utils";

/** Captura de montos: acepta "1,200.50" o "$1200" y entrega un número al salir del campo. */
export function MoneyInput({ value, onChange, placeholder = "0", autoFocus }: { value: number; onChange: (v: number) => void; placeholder?: string; autoFocus?: boolean }) {
  const [txt, setTxt] = useState(value ? String(value) : "");
  useEffect(() => { setTxt(value ? String(value) : ""); }, [value]);
  return <Input inputMode="decimal" autoFocus={autoFocus} placeholder={placeholder} value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={() => onChange(num(txt))} className="num" />;
}
