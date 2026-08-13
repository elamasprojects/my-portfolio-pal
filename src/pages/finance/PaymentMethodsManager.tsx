import { useState } from "react";
import { usePaymentMethods } from "@/hooks/useFinance";
import { PaymentMethod } from "@/types/finance";
import { useProfile } from "@/hooks/useProfile";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { makeFormatters } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wallet, Plus, Edit2, Trash2, CreditCard, Building, Coins, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

export default function PaymentMethodsManager() {
  const { paymentMethods, isLoading, addPaymentMethod, updatePaymentMethod, deletePaymentMethod } =
    usePaymentMethods();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPm, setEditingPm] = useState<Partial<PaymentMethod> | null>(null);
  const [newPattern, setNewPattern] = useState("");

  const { profile } = useProfile();
  const { mepRate } = useDolarMEP();
  const displayCurrency = profile?.default_currency === "ARS" ? "ARS" : "USD";
  const { cx, currencySymbol } = makeFormatters(displayCurrency, mepRate);

  const handleOpenAdd = () => {
    setEditingPm({
      name: "",
      type: "digital_wallet",
      currency: "USD",
      color: "#10b981",
      icon: "Wallet",
      aliases: [],
      detection_patterns: [],
      initial_balance: 0,
      current_balance: 0,
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (pm: PaymentMethod) => {
    setEditingPm({ ...pm });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingPm?.name?.trim()) {
      toast.error("Ingresa un nombre para la cuenta o medio de pago");
      return;
    }

    if (editingPm.id) {
      await updatePaymentMethod.mutateAsync({
        id: editingPm.id,
        updates: editingPm,
      });
    } else {
      await addPaymentMethod.mutateAsync(editingPm);
    }
    setModalOpen(false);
  };

  const handleAddPattern = () => {
    if (!newPattern.trim() || !editingPm) return;
    const pat = newPattern.trim();
    if (!editingPm.detection_patterns?.includes(pat)) {
      setEditingPm({
        ...editingPm,
        detection_patterns: [...(editingPm.detection_patterns || []), pat],
      });
    }
    setNewPattern("");
  };

  const handleRemovePattern = (pat: string) => {
    if (!editingPm) return;
    setEditingPm({
      ...editingPm,
      detection_patterns: (editingPm.detection_patterns || []).filter((p) => p !== pat),
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-foreground">
            Medios de Pago & Cuentas
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configura tus tarjetas, bancos y billeteras con patrones de auto-detección en comprobantes.
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          <span>Nuevo Medio de Pago</span>
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {paymentMethods.map((pm) => (
          <div
            key={pm.id}
            className="flex flex-col justify-between p-4 rounded-2xl border bg-card hover:border-primary/40 transition-colors shadow-sm space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-white shadow-sm"
                  style={{ backgroundColor: pm.color || "#10b981" }}
                >
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">{pm.name}</h3>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    {pm.type} · {pm.currency}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => handleOpenEdit(pm)}
                  title="Editar medio de pago"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (window.confirm(`¿Eliminar el medio de pago '${pm.name}'?`)) {
                      deletePaymentMethod.mutate(pm.id);
                    }
                  }}
                  title="Eliminar medio de pago"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* OCR Detection Patterns */}
            <div>
              <span className="text-[10px] text-muted-foreground block font-mono">Detección en comprobantes:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(pm.detection_patterns || []).length === 0 ? (
                  <span className="text-[10px] text-muted-foreground/60 italic">Sin patrones regex</span>
                ) : (
                  (pm.detection_patterns || []).slice(0, 3).map((pat) => (
                    <span
                      key={pat}
                      className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                    >
                      {pat}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Balance */}
            <div className="border-t border-border/40 pt-2 flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">Saldo actual:</span>
              <span className="font-bold text-foreground">
                {currencySymbol}
                {cx(Number(pm.current_balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Create Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-primary">
              {editingPm?.id ? "Editar Medio de Pago" : "Nuevo Medio de Pago"}
            </DialogTitle>
          </DialogHeader>

          {editingPm && (
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nombre</label>
                <Input
                  value={editingPm.name || ""}
                  onChange={(e) => setEditingPm({ ...editingPm, name: e.target.value })}
                  placeholder="Ej: DolarApp Global, Mercado Pago, Bank ARS..."
                  className="mt-1 font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                  <select
                    value={editingPm.type || "digital_wallet"}
                    onChange={(e) => setEditingPm({ ...editingPm, type: e.target.value as any })}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                  >
                    <option value="digital_wallet">Billetera Digital</option>
                    <option value="bank">Cuenta Bancaria</option>
                    <option value="card">Tarjeta de Crédito</option>
                    <option value="broker_cash">Efectivo Broker</option>
                    <option value="crypto">Billetera Cripto</option>
                    <option value="cash">Efectivo</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Moneda Nativa</label>
                  <select
                    value={editingPm.currency || "USD"}
                    onChange={(e) => setEditingPm({ ...editingPm, currency: e.target.value as any })}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                  >
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                    <option value="EUR">EUR</option>
                    <option value="MULTI">Multi-moneda</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Color de la Tarjeta</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={editingPm.color || "#10b981"}
                    onChange={(e) => setEditingPm({ ...editingPm, color: e.target.value })}
                    className="h-8 w-10 cursor-pointer rounded border"
                  />
                  <Input
                    value={editingPm.color || "#10b981"}
                    onChange={(e) => setEditingPm({ ...editingPm, color: e.target.value })}
                    className="font-mono text-xs h-8"
                  />
                </div>
              </div>

              {/* Detection patterns */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Patrones de Detección OCR en Comprobantes (Texto/Keywords)
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={newPattern}
                    onChange={(e) => setNewPattern(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddPattern();
                      }
                    }}
                    placeholder="Ej: MERPAGO*, Dinero disponible, USDc, ARQ..."
                    className="font-mono text-xs"
                  />
                  <Button size="sm" onClick={handleAddPattern} className="h-9">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">
                  {(editingPm.detection_patterns || []).map((pat) => (
                    <span
                      key={pat}
                      className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-mono"
                    >
                      <span>{pat}</span>
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => handleRemovePattern(pat)}
                      />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-primary text-primary-foreground" onClick={handleSave}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
