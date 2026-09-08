import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, ArchiveRestore, FolderOpen, LogOut, MoreHorizontal, Plus, Upload, KeyRound, Trash2 } from "lucide-react";
import * as api from "@/api";
import { supabase } from "@/lib/supabase";
import { importarProyecto, validarRespaldo } from "@/lib/importar";
import { fm, fecha } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Dialog, DialogActions, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Empty } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { AsistenteProyecto } from "@/components/AsistenteProyecto";
import { useSesion } from "@/hooks/useSesion";

export default function Proyectos() {
  const qc = useQueryClient();
  const sesion = useSesion();
  const { data, isLoading, error } = useQuery({ queryKey: ["proyectos"], queryFn: api.listaProyectos });
  const [vista, setVista] = useState<"activos" | "archivados">("activos");
  const [nuevo, setNuevo] = useState(false);
  const [pass, setPass] = useState(false);
  const [progreso, setProgreso] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const refrescar = () => qc.invalidateQueries({ queryKey: ["proyectos"] });

  const archivar = useMutation({ mutationFn: async ({ id, a }: { id: string; a: boolean }) => { await api.archivarProyecto(id, a); }, onSuccess: refrescar, onError: (e) => toast.error(e.message) });
  const borrar = useMutation({ mutationFn: async (id: string) => { await api.borrarProyecto(id); }, onSuccess: () => { refrescar(); toast.success("Proyecto borrado"); }, onError: (e) => toast.error(e.message) });

  const importar = async (f: File) => {
    try {
      const json = validarRespaldo(await f.text());
      setProgreso("Importando…");
      const id = await importarProyecto(json, setProgreso);
      setProgreso("");
      refrescar();
      toast.success(`Proyecto "${json.meta.nombre}" importado`);
      location.hash = `#/p/${id}`;
    } catch (e) { setProgreso(""); toast.error("No se pudo importar", { description: e instanceof Error ? e.message : String(e) }); }
  };

  const lista = (data || []).filter((x) => (vista === "archivados") === x.archivado);
  const yo = sesion?.user.id;
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold leading-tight">Mis proyectos</h1>
            <p className="text-xs text-muted-foreground">{sesion?.user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => file.current?.click()} disabled={!!progreso}><Upload />{progreso || "Importar respaldo"}</Button>
            <input ref={file} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ""; }} />
            <Button size="sm" onClick={() => setNuevo(true)}><Plus />Nuevo proyecto</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Más"><MoreHorizontal /></Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setPass(true)}><KeyRound />Cambiar contraseña</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => supabase.auth.signOut()}><LogOut />Cerrar sesión</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5 space-y-4">
        <Segmented value={vista} onChange={setVista} options={[["activos", "Activos"], ["archivados", "Archivados"]]} />
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {error && <p className="text-sm text-bad">{(error as Error).message}</p>}
        {!isLoading && lista.length === 0 && (
          <Empty>{vista === "activos" ? "Todavía no tienes proyectos. Crea uno o importa un respaldo JSON." : "No hay proyectos archivados."}</Empty>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((x) => (
            <Card key={x.id} className="p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/p/${x.id}`} className="min-w-0">
                  <div className="font-semibold truncate">{x.nombre}</div>
                  <div className="text-xs text-muted-foreground truncate">{x.clientes || "Sin clientes"}</div>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="-mr-2 -mt-1" aria-label="Opciones"><MoreHorizontal /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => archivar.mutate({ id: x.id, a: !x.archivado })}>{x.archivado ? <><ArchiveRestore />Restaurar</> : <><Archive />Archivar</>}</DropdownMenuItem>
                    {x.owner_id === yo && <DropdownMenuItem className="text-bad" onSelect={() => { if (confirm(`¿Borrar "${x.nombre}" con todo su contenido? No se puede deshacer.`)) borrar.mutate(x.id); }}><Trash2 />Borrar</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="num">{x.presupuesto_obra > 0 ? `Presupuesto ${fm(x.presupuesto_obra)}` : "Sin presupuesto"}</span>
                <span>{fecha(x.created_at.slice(0, 10))}</span>
              </div>
              <div className="flex items-center justify-between">
                {x.owner_id === yo ? <Badge variant="neutral">Propietario</Badge> : <Badge variant="info">Compartido</Badge>}
                <Button asChild variant="secondary" size="sm"><Link to={`/p/${x.id}`}><FolderOpen />Abrir</Link></Button>
              </div>
            </Card>
          ))}
        </div>
      </main>
      <AsistenteProyecto open={nuevo} onClose={() => setNuevo(false)} />
      <CambiarPass open={pass} onClose={() => setPass(false)} />
    </div>
  );
}

function CambiarPass({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pass, setPass] = useState("");
  const guardar = async () => {
    const { error } = await supabase.auth.updateUser({ password: pass });
    if (error) toast.error(error.message); else { toast.success("Contraseña actualizada"); setPass(""); onClose(); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Cambiar contraseña">
        <Field label="Nueva contraseña" hint="Mínimo 6 caracteres."><Input type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus /></Field>
        <DialogActions>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={pass.length < 6} onClick={guardar}>Guardar</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
