import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, useFarms, usePurchases } from "@/hooks/use-agro";
import { FarmPicker } from "@/components/FarmPicker";
import { AudioMessageButton } from "@/components/AudioMessageButton";
import { useServerFn } from "@tanstack/react-start";
import { parsePurchaseFromVoice } from "@/lib/compras-voice.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UNITS, eur, monthKey, monthLabel, monthRange, todayISO } from "@/lib/agro";

export const Route = createFileRoute("/_authenticated/compras")({
  head: () => ({
    meta: [
      { title: "Compras de insumos · Gestión Agrícola" },
      {
        name: "description",
        content:
          "Registra compras de fertilizantes, fitosanitarios, herramientas y combustible con factura adjunta.",
      },
      { property: "og:title", content: "Compras de insumos · Gestión Agrícola" },
      { property: "og:description", content: "Control de gasto en insumos y materiales por finca." },
    ],
  }),
  component: ComprasPage,
});

const empty = {
  purchase_date: todayISO(),
  item: "",
  category_id: "",
  quantity: "1",
  unit: UNITS[0]!,
  cost: "",
  supplier: "",
};

function ComprasPage() {
  const qc = useQueryClient();
  const { data: farms = [] } = useFarms();
  const { data: categories = [] } = useCategories();
  const [farmId, setFarmId] = useState<string | undefined>();
  const [month, setMonth] = useState(monthKey());
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [dictating, setDictating] = useState(false);
  const parsePurchase = useServerFn(parsePurchaseFromVoice);

  async function handleDictation(text: string) {
    setDictating(true);
    try {
      const { parsed } = await parsePurchase({
        data: {
          transcript: text,
          categories: categories.map((c) => c.name),
          units: [...UNITS],
          today: todayISO(),
        },
      });
      setEditingId(null);
      setForm((f) => ({
        ...f,
        purchase_date: parsed.purchase_date ?? f.purchase_date,
        item: parsed.item ?? f.item,
        category_id:
          (parsed.category && categories.find((c) => c.name === parsed.category)?.id) ||
          f.category_id,
        quantity: parsed.quantity != null ? String(parsed.quantity) : f.quantity,
        unit: parsed.unit ?? f.unit,
        cost: parsed.cost != null ? String(parsed.cost) : f.cost,
        supplier: parsed.supplier ?? f.supplier,
      }));
      toast.success("Dictado interpretado — revisa y registra");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo interpretar el dictado");
    } finally {
      setDictating(false);
    }
  }

  useEffect(() => {
    if (!farmId && farms.length) setFarmId(farms[0]!.id);
  }, [farms, farmId]);

  const { data: purchases = [] } = usePurchases(farmId);
  const range = monthRange(month);
  const monthPurchases = useMemo(
    () => purchases.filter((p) => p.purchase_date >= range.from && p.purchase_date <= range.to),
    [purchases, range.from, range.to],
  );
  const total = monthPurchases.reduce((s, p) => s + Number(p.cost), 0);
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Sin categoría";

  async function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    const { error } = await supabase.from("supply_categories").insert({ name });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewCategory("");
    qc.invalidateQueries({ queryKey: ["categories"] });
    toast.success("Categoría añadida");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    setSaving(true);
    try {
      let attachment_path: string | null = null;
      if (file) {
        const path = `${farmId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("facturas").upload(path, file);
        if (upErr) throw upErr;
        attachment_path = path;
      }
      const payload = {
        farm_id: farmId,
        purchase_date: form.purchase_date,
        item: form.item,
        category_id: form.category_id || null,
        quantity: Number(form.quantity),
        unit: form.unit,
        cost: Number(form.cost),
        supplier: form.supplier || null,
        ...(attachment_path ? { attachment_path } : {}),
      };

      const { error } = editingId
        ? await supabase.from("purchases").update(payload).eq("id", editingId)
        : await supabase.from("purchases").insert(payload);
      if (error) throw error;
      toast.success(editingId ? "Compra actualizada" : "Compra registrada");
      setForm({ ...empty, purchase_date: form.purchase_date });
      setFile(null);
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["purchases"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["purchases"] });
    toast.success("Compra eliminada");
  }

  async function openAttachment(path: string) {
    const { data, error } = await supabase.storage.from("facturas").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("No se pudo abrir la factura");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Compras de insumos y materiales</h1>
      <FarmPicker farms={farms} value={farmId} onChange={setFarmId} />

      <div className="surface mb-3 flex items-center gap-3 p-3">
        <AudioMessageButton disabled={dictating} onTranscript={handleDictation} />
        <p className="text-xs text-muted-foreground">
          {dictating
            ? "Interpretando el dictado…"
            : 'Dicta la compra: "20 sacos de abono NPK en Agrotecnia, 450 euros, ayer".'}
        </p>
      </div>

      <form onSubmit={save} className="surface mb-5 space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pdate">Fecha</Label>
            <Input
              id="pdate"
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat">Categoría</Label>
            <select
              id="cat"
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="item">Insumo / material</Label>
          <Input
            id="item"
            required
            value={form.item}
            onChange={(e) => setForm({ ...form, item: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="qty">Cantidad</Label>
            <Input
              id="qty"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unit">Unidad</Label>
            <select
              id="unit"
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cost">Coste (€)</Label>
            <Input
              id="cost"
              type="number"
              step="0.01"
              inputMode="decimal"
              required
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="supplier">Proveedor (opcional)</Label>
          <Input
            id="supplier"
            value={form.supplier}
            onChange={(e) => setForm({ ...form, supplier: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="file">Factura o nota (imagen o PDF, opcional)</Label>
          <Input
            id="file"
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            <Plus className="mr-1.5 size-4" />
            {editingId ? "Guardar cambios" : "Registrar compra"}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setForm(empty);
              }}
            >
              Cancelar
            </Button>
          )}
        </div>

        <div className="flex gap-2 border-t border-border pt-3">
          <Input
            placeholder="Nueva categoría de insumo"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <Button type="button" variant="outline" onClick={addCategory}>
            Añadir
          </Button>
        </div>
      </form>

      <div className="mb-3 flex items-center justify-between gap-3">
        <Input
          type="month"
          className="w-40"
          value={month}
          onChange={(e) => setMonth(e.target.value || monthKey())}
        />
        <p className="text-sm text-muted-foreground">
          {eur(total)} en {monthLabel(month)}
        </p>
      </div>

      <div className="space-y-2">
        {monthPurchases.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin compras este mes.</p>
        )}
        {monthPurchases.map((p) => (
          <div key={p.id} className="surface flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.item}</p>
              <p className="text-xs text-muted-foreground">
                {p.purchase_date} · {catName(p.category_id)} · {Number(p.quantity)} {p.unit}
                {p.supplier ? ` · ${p.supplier}` : ""}
              </p>
            </div>
            {p.attachment_path && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Ver factura"
                onClick={() => openAttachment(p.attachment_path!)}
              >
                <FileText className="size-4" />
              </Button>
            )}
            <span className="rounded-md bg-accent px-2 py-1 text-sm font-semibold text-accent-foreground">
              {eur(Number(p.cost))}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Editar"
              onClick={() => {
                setEditingId(p.id);
                setForm({
                  purchase_date: p.purchase_date,
                  item: p.item,
                  category_id: p.category_id ?? "",
                  quantity: String(p.quantity),
                  unit: p.unit,
                  cost: String(p.cost),
                  supplier: p.supplier ?? "",
                });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Eliminar" onClick={() => remove(p.id)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
