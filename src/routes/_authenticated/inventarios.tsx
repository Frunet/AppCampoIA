import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useCompanies,
  useFarms,
  useFruits,
  useLaborCostRates,
  useTaskTypes,
  useUsersAdmin,
  useVarieties,
  useWorkers,
} from "@/hooks/use-agro";
import type { AppRole, Company, Farm, Fruit, LaborCostRate, TaskType, UserRow, Variety, Worker } from "@/lib/agro";
import { eur, todayISO } from "@/lib/agro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/inventarios")({
  // Protegido tambien a nivel de ruta (no solo ocultando la pestaña): si un
  // usuario no-admin navega directo a /inventarios, se le redirige.
  beforeLoad: async () => {
    const { data: userRes, error } = await supabase.auth.getUser();
    if (error || !userRes.user) throw redirect({ to: "/auth" });
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw redirect({ to: "/horas" });
  },
  head: () => ({
    meta: [
      { title: "Inventarios · Gestión Agrícola" },
      {
        name: "description",
        content:
          "Catálogos de fincas, trabajadores, empresas, tipos de tarea, frutas, variedades, coste de personal y usuarios.",
      },
    ],
  }),
  component: InventariosPage,
});

function InventariosPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Inventarios</h1>
      <Tabs defaultValue="trabajadores">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="trabajadores">Trabajadores</TabsTrigger>
          <TabsTrigger value="fincas">Fincas</TabsTrigger>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="tareas">Tipos de tarea</TabsTrigger>
          <TabsTrigger value="frutas">Frutas</TabsTrigger>
          <TabsTrigger value="variedades">Variedades</TabsTrigger>
          <TabsTrigger value="coste">Coste hora</TabsTrigger>
          <TabsTrigger value="responsables">Responsables</TabsTrigger>
        </TabsList>

        <TabsContent value="trabajadores">
          <WorkersTab />
        </TabsContent>
        <TabsContent value="fincas">
          <FarmsTab />
        </TabsContent>
        <TabsContent value="empresas">
          <CompaniesTab />
        </TabsContent>
        <TabsContent value="tareas">
          <TaskTypesTab />
        </TabsContent>
        <TabsContent value="frutas">
          <FruitsTab />
        </TabsContent>
        <TabsContent value="variedades">
          <VarietiesTab />
        </TabsContent>
        <TabsContent value="coste">
          <LaborCostTab />
        </TabsContent>
        <TabsContent value="responsables">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  );
}

function DeleteButton({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Eliminar">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Si hay registros que dependen de este elemento, la
            base de datos rechazará el borrado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Eliminar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------

function CompaniesTab() {
  const qc = useQueryClient();
  const { data: companies = [], isLoading } = useCompanies();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [name, setName] = useState("");

  function openNew() {
    setEditing(null);
    setName("");
    setOpen(true);
  }
  function openEdit(c: Company) {
    setEditing(c);
    setName(c.name);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = editing
      ? await supabase.from("companies").update({ name: name.trim() }).eq("id", editing.id)
      : await supabase.from("companies").insert({ name: name.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Empresa actualizada" : "Empresa creada");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["companies"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Empresa eliminada");
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["farms"] });
  }

  return (
    <div className="surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Empresas</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1.5 size-4" /> Nueva
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar empresa" : "Nueva empresa"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="company-name">Nombre</Label>
                <Input id="company-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead className="w-24 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && companies.length === 0 && <EmptyRow colSpan={2} text="Sin empresas todavía." />}
          {companies.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(c)}>
                  <Pencil className="size-4" />
                </Button>
                <DeleteButton label={`la empresa "${c.name}"`} onConfirm={() => remove(c.id)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Frutas
// ---------------------------------------------------------------------------

function FruitsTab() {
  const qc = useQueryClient();
  const { data: fruits = [], isLoading } = useFruits();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Fruit | null>(null);
  const [name, setName] = useState("");

  function openNew() {
    setEditing(null);
    setName("");
    setOpen(true);
  }
  function openEdit(f: Fruit) {
    setEditing(f);
    setName(f.name);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = editing
      ? await supabase.from("fruits").update({ name: name.trim() }).eq("id", editing.id)
      : await supabase.from("fruits").insert({ name: name.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Fruta actualizada" : "Fruta creada");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["fruits"] });
    qc.invalidateQueries({ queryKey: ["farms"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("fruits").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Fruta eliminada");
    qc.invalidateQueries({ queryKey: ["fruits"] });
  }

  return (
    <div className="surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Frutas</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1.5 size-4" /> Nueva
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar fruta" : "Nueva fruta"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="fruit-name">Nombre</Label>
                <Input id="fruit-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead className="w-24 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && fruits.length === 0 && <EmptyRow colSpan={2} text="Sin frutas todavía." />}
          {fruits.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="font-medium capitalize">{f.name}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(f)}>
                  <Pencil className="size-4" />
                </Button>
                <DeleteButton label={`la fruta "${f.name}"`} onConfirm={() => remove(f.id)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variedades
// ---------------------------------------------------------------------------

function VarietiesTab() {
  const qc = useQueryClient();
  const { data: varieties = [], isLoading } = useVarieties();
  const { data: fruits = [] } = useFruits();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Variety | null>(null);
  const [name, setName] = useState("");
  const [fruitId, setFruitId] = useState("");

  function openNew() {
    setEditing(null);
    setName("");
    setFruitId(fruits[0]?.id ?? "");
    setOpen(true);
  }
  function openEdit(v: Variety) {
    setEditing(v);
    setName(v.name);
    setFruitId(v.fruit_id);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !fruitId) return;
    const payload = { name: name.trim(), fruit_id: fruitId };
    const { error } = editing
      ? await supabase.from("varieties").update(payload).eq("id", editing.id)
      : await supabase.from("varieties").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Variedad actualizada" : "Variedad creada");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["varieties"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("varieties").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Variedad eliminada");
    qc.invalidateQueries({ queryKey: ["varieties"] });
  }

  const fruitName = (id: string) => fruits.find((f) => f.id === id)?.name ?? "?";

  return (
    <div className="surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Variedades</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew} disabled={fruits.length === 0}>
              <Plus className="mr-1.5 size-4" /> Nueva
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar variedad" : "Nueva variedad"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="variety-fruit">Fruta</Label>
                <select
                  id="variety-fruit"
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={fruitId}
                  onChange={(e) => setFruitId(e.target.value)}
                >
                  {fruits.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="variety-name">Nombre</Label>
                <Input id="variety-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Fruta</TableHead>
            <TableHead className="w-24 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && varieties.length === 0 && <EmptyRow colSpan={3} text="Sin variedades todavía." />}
          {varieties.map((v) => (
            <TableRow key={v.id}>
              <TableCell className="font-medium">{v.name}</TableCell>
              <TableCell className="capitalize text-muted-foreground">{fruitName(v.fruit_id)}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(v)}>
                  <Pencil className="size-4" />
                </Button>
                <DeleteButton label={`la variedad "${v.name}"`} onConfirm={() => remove(v.id)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tipos de tarea
// ---------------------------------------------------------------------------

function TaskTypesTab() {
  const qc = useQueryClient();
  const { data: taskTypes = [], isLoading } = useTaskTypes();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskType | null>(null);
  const [name, setName] = useState("");
  const [hint, setHint] = useState("");
  const [isHarvest, setIsHarvest] = useState(false);

  function openNew() {
    setEditing(null);
    setName("");
    setHint("");
    setIsHarvest(false);
    setOpen(true);
  }
  function openEdit(t: TaskType) {
    setEditing(t);
    setName(t.name);
    setHint(t.hint ?? "");
    setIsHarvest(t.is_harvest);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      hint: hint.trim() || null,
      is_harvest: isHarvest,
      sort_order: editing?.sort_order ?? taskTypes.length + 1,
    };
    const { error } = editing
      ? await supabase.from("task_types").update(payload).eq("id", editing.id)
      : await supabase.from("task_types").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Tipo de tarea actualizado" : "Tipo de tarea creado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["task_types"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("task_types").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tipo de tarea eliminado");
    qc.invalidateQueries({ queryKey: ["task_types"] });
  }

  return (
    <div className="surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Tipos de tarea</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1.5 size-4" /> Nuevo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar tipo de tarea" : "Nuevo tipo de tarea"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tt-name">Nombre</Label>
                <Input id="tt-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tt-hint">Ayuda (se muestra junto al nombre)</Label>
                <Input id="tt-hint" value={hint} onChange={(e) => setHint(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isHarvest} onCheckedChange={(v) => setIsHarvest(v === true)} />
                Es cosecha/recolección (pide variedad y kg)
              </label>
              <DialogFooter>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Ayuda</TableHead>
            <TableHead>Cosecha</TableHead>
            <TableHead className="w-24 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && taskTypes.length === 0 && (
            <EmptyRow colSpan={4} text="Sin tipos de tarea todavía." />
          )}
          {taskTypes.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.name}</TableCell>
              <TableCell className="text-muted-foreground">{t.hint ?? "—"}</TableCell>
              <TableCell>{t.is_harvest ? "Sí" : "No"}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(t)}>
                  <Pencil className="size-4" />
                </Button>
                <DeleteButton label={`el tipo de tarea "${t.name}"`} onConfirm={() => remove(t.id)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coste de hora de personal (solo alta; el histórico no se edita)
// ---------------------------------------------------------------------------

function LaborCostTab() {
  const qc = useQueryClient();
  const { data: rates = [], isLoading } = useLaborCostRates();
  const [hourlyRate, setHourlyRate] = useState("");
  const [validFrom, setValidFrom] = useState(todayISO());

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const rate = Number(hourlyRate);
    if (!rate || rate <= 0) {
      toast.error("Indica un importe válido");
      return;
    }
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("labor_cost_rates")
      .insert({ hourly_rate: rate, valid_from: validFrom, created_by: userRes.user?.id ?? null });
    if (error) {
      toast.error(
        error.message.includes("duplicate")
          ? "Ya hay un importe cargado para esa fecha."
          : error.message,
      );
      return;
    }
    toast.success("Coste añadido");
    setHourlyRate("");
    qc.invalidateQueries({ queryKey: ["labor_cost_rates"] });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="surface space-y-3 p-4">
        <h2 className="text-sm font-semibold">Añadir nuevo coste de hora</h2>
        <p className="text-xs text-muted-foreground">
          El histórico no se edita: cada cambio de tarifa se añade con su fecha de vigencia. Los
          informes usan la tarifa vigente en la fecha de cada registro de horas.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="lc-date">Vigente desde</Label>
            <Input
              id="lc-date"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lc-rate">Coste (€/hora)</Label>
            <Input
              id="lc-rate"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              required
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
          </div>
        </div>
        <Button type="submit">
          <Plus className="mr-1.5 size-4" /> Añadir
        </Button>
      </form>

      <div className="surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Histórico</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vigente desde</TableHead>
              <TableHead className="text-right">€/hora</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && rates.length === 0 && <EmptyRow colSpan={2} text="Sin costes cargados todavía." />}
            {rates.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.valid_from}</TableCell>
                <TableCell className="text-right font-medium">{eur(r.hourly_rate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trabajadores
// ---------------------------------------------------------------------------

function WorkersTab() {
  const qc = useQueryClient();
  const { data: farms = [] } = useFarms();
  const [farmFilter, setFarmFilter] = useState("");
  const { data: workers = [], isLoading } = useWorkers(farmFilter || undefined);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [name, setName] = useState("");
  const [idrh, setIdrh] = useState("");
  const [farmId, setFarmId] = useState("");
  const [active, setActive] = useState(true);

  function openNew() {
    setEditing(null);
    setName("");
    setIdrh("");
    setFarmId(farmFilter || farms[0]?.id || "");
    setActive(true);
    setOpen(true);
  }
  function openEdit(w: Worker) {
    setEditing(w);
    setName(w.name);
    setIdrh(w.idrh ?? "");
    setFarmId(w.farm_id);
    setActive(w.active);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !farmId) return;
    const payload = { name: name.trim(), idrh: idrh.trim() || null, farm_id: farmId, active };
    const { error } = editing
      ? await supabase.from("workers").update(payload).eq("id", editing.id)
      : await supabase.from("workers").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Trabajador actualizado" : "Trabajador creado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["workers"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("workers").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Trabajador eliminado");
    qc.invalidateQueries({ queryKey: ["workers"] });
  }

  const farmName = (id: string) => farms.find((f) => f.id === id)?.name ?? "?";

  return (
    <div className="surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Trabajadores</h2>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border border-input bg-card px-2 text-sm"
            value={farmFilter}
            onChange={(e) => setFarmFilter(e.target.value)}
          >
            <option value="">Todas las fincas</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}>
                <Plus className="mr-1.5 size-4" /> Nuevo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar trabajador" : "Nuevo trabajador"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={save} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="w-name">Nombre</Label>
                  <Input id="w-name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="w-idrh">ID RRHH (opcional)</Label>
                  <Input id="w-idrh" value={idrh} onChange={(e) => setIdrh(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="w-farm">Finca</Label>
                  <select
                    id="w-farm"
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={farmId}
                    onChange={(e) => setFarmId(e.target.value)}
                  >
                    {farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />
                  Activo
                </label>
                <DialogFooter>
                  <Button type="submit">Guardar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Finca</TableHead>
            <TableHead>ID RRHH</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-24 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && workers.length === 0 && <EmptyRow colSpan={5} text="Sin trabajadores todavía." />}
          {workers.map((w) => (
            <TableRow key={w.id}>
              <TableCell className="font-medium">{w.name}</TableCell>
              <TableCell className="text-muted-foreground">{farmName(w.farm_id)}</TableCell>
              <TableCell className="text-muted-foreground">{w.idrh ?? "—"}</TableCell>
              <TableCell>{w.active ? "Activo" : "Inactivo"}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(w)}>
                  <Pencil className="size-4" />
                </Button>
                <DeleteButton label={`al trabajador "${w.name}"`} onConfirm={() => remove(w.id)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fincas
// ---------------------------------------------------------------------------

function FarmsTab() {
  const qc = useQueryClient();
  const { data: farms = [], isLoading } = useFarms();
  const { data: companies = [] } = useCompanies();
  const { data: fruits = [] } = useFruits();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Farm | null>(null);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [fruitId, setFruitId] = useState("");
  const [surface, setSurface] = useState("");

  function openNew() {
    setEditing(null);
    setName("");
    setCompanyId("");
    setFruitId(fruits[0]?.id ?? "");
    setSurface("");
    setOpen(true);
  }
  function openEdit(f: Farm) {
    setEditing(f);
    setName(f.name);
    setCompanyId(f.company_id ?? "");
    setFruitId(f.fruit_id);
    setSurface(f.surface_m2 == null ? "" : String(f.surface_m2));
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !fruitId) return;
    const payload = {
      name: name.trim(),
      company_id: companyId || null,
      fruit_id: fruitId,
      surface_m2: surface === "" ? null : Number(surface),
    };
    const { error } = editing
      ? await supabase.from("farms").update(payload).eq("id", editing.id)
      : await supabase.from("farms").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Finca actualizada" : "Finca creada");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["farms"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("farms").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Finca eliminada");
    qc.invalidateQueries({ queryKey: ["farms"] });
  }

  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Fincas</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew} disabled={fruits.length === 0}>
              <Plus className="mr-1.5 size-4" /> Nueva
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar finca" : "Nueva finca"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="f-name">Nombre</Label>
                <Input id="f-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="f-fruit">Fruta</Label>
                  <select
                    id="f-fruit"
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={fruitId}
                    onChange={(e) => setFruitId(e.target.value)}
                  >
                    {fruits.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-surface">Superficie (m²)</Label>
                  <Input
                    id="f-surface"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={surface}
                    onChange={(e) => setSurface(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-company">Empresa (opcional)</Label>
                <select
                  id="f-company"
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                >
                  <option value="">Sin empresa</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Fruta</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="text-right">Superficie</TableHead>
              <TableHead className="w-24 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && farms.length === 0 && <EmptyRow colSpan={5} text="Sin fincas todavía." />}
            {farms.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell className="capitalize text-muted-foreground">{f.fruit_name}</TableCell>
                <TableCell className="text-muted-foreground">{companyName(f.company_id)}</TableCell>
                <TableCell className="text-right">
                  {f.surface_m2 == null ? "—" : `${Number(f.surface_m2).toLocaleString("es-ES")} m²`}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(f)}>
                    <Pencil className="size-4" />
                  </Button>
                  <DeleteButton label={`la finca "${f.name}"`} onConfirm={() => remove(f.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Responsables (usuarios)
// ---------------------------------------------------------------------------

function UsersTab() {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useUsersAdmin();
  const { data: farms = [] } = useFarms();
  const [open, setOpen] = useState(false);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["users-admin"] });
  }

  return (
    <div className="surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Responsables</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 size-4" /> Nuevo usuario
            </Button>
          </DialogTrigger>
          <NewUserDialog
            farms={farms}
            onCreated={() => {
              setOpen(false);
              refresh();
            }}
          />
        </Dialog>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Fincas</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && users.length === 0 && <EmptyRow colSpan={4} text="Sin usuarios todavía." />}
            {users.map((u) => (
              <UserRowEditor key={u.id} user={u} farms={farms} onSaved={refresh} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function UserRowEditor({
  user,
  farms,
  onSaved,
}: {
  user: UserRow;
  farms: Farm[];
  onSaved: () => void;
}) {
  const [role, setRole] = useState<AppRole>(user.role ?? "manager");
  const [farmIds, setFarmIds] = useState<string[]>(user.farm_ids);
  const [saving, setSaving] = useState(false);
  const dirty = role !== (user.role ?? "manager") || JSON.stringify([...farmIds].sort()) !== JSON.stringify([...user.farm_ids].sort());

  function toggleFarm(id: string) {
    setFarmIds((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  async function save() {
    setSaving(true);
    try {
      // Rol: user_roles tiene UNIQUE(user_id, role), asi que se borra el
      // anterior y se inserta el nuevo en vez de "actualizar" la fila.
      if (role !== (user.role ?? "manager")) {
        await supabase.from("user_roles").delete().eq("user_id", user.id);
        const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role });
        if (error) throw error;
      }
      // Fincas: se reemplaza el conjunto completo (borrar + insertar las
      // seleccionadas), mas simple y seguro que calcular el diff.
      await supabase.from("farm_managers").delete().eq("user_id", user.id);
      if (farmIds.length > 0) {
        const { error } = await supabase
          .from("farm_managers")
          .insert(farmIds.map((farm_id) => ({ user_id: user.id, farm_id })));
        if (error) throw error;
      }
      toast.success("Usuario actualizado");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{user.full_name ?? user.email}</p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </TableCell>
      <TableCell>
        <select
          className="h-9 rounded-md border border-input bg-card px-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as AppRole)}
        >
          <option value="manager">Encargado</option>
          <option value="admin">Administrador</option>
        </select>
      </TableCell>
      <TableCell>
        {role === "admin" ? (
          <span className="text-xs text-muted-foreground">Todas (es admin)</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {farms.map((f) => {
              const on = farmIds.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleFarm(f.id)}
                  className={
                    on
                      ? "rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                      : "rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                  }
                >
                  {f.name}
                </button>
              );
            })}
          </div>
        )}
      </TableCell>
      <TableCell className="text-right">
        {dirty && (
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "..." : "Guardar"}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function NewUserDialog({ farms, onCreated }: { farms: Farm[]; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("manager");
  const [farmIds, setFarmIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ email: string; temp_password: string } | null>(null);

  function toggleFarm(id: string) {
    setFarmIds((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sesión no válida, vuelve a entrar.");

      const res = await fetch(
        `${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/create-user`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            email: email.trim(),
            full_name: fullName.trim(),
            role,
            farm_ids: role === "manager" ? farmIds : [],
          }),
        },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo crear el usuario");
      setResult({ email: body.email, temp_password: body.temp_password });
      toast.success("Usuario creado");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el usuario");
    } finally {
      setCreating(false);
    }
  }

  if (result) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usuario creado</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          Entrégale estas credenciales — la contraseña no se puede volver a consultar:
        </p>
        <div className="surface space-y-1 p-3 text-sm">
          <p>
            <span className="text-muted-foreground">Email: </span>
            <span className="font-mono">{result.email}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Contraseña temporal: </span>
            <span className="font-mono">{result.temp_password}</span>
          </p>
        </div>
      </DialogContent>
    );
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nuevo usuario</DialogTitle>
      </DialogHeader>
      <form onSubmit={create} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="nu-name">Nombre completo</Label>
          <Input id="nu-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nu-email">Email</Label>
          <Input
            id="nu-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nu-role">Rol</Label>
          <select
            id="nu-role"
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
          >
            <option value="manager">Encargado</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        {role === "manager" && (
          <div className="space-y-1.5">
            <Label>Fincas asignadas</Label>
            <div className="flex flex-wrap gap-1.5">
              {farms.map((f) => {
                const on = farmIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleFarm(f.id)}
                    className={
                      on
                        ? "rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                        : "rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                    }
                  >
                    {f.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="submit" disabled={creating}>
            {creating ? "Creando…" : "Crear usuario"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
