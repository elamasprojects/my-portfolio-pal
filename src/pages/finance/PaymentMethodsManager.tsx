import { useState, useMemo } from "react";
import { useFinancialAccounts } from "@/hooks/useFinance";
import { FinancialAccount, AccountType, CurrencyCode } from "@/types/finance";
import { useProfile } from "@/hooks/useProfile";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { makeFormatters } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Wallet,
  Plus,
  Edit2,
  Trash2,
  Building,
  Coins,
  ArrowUpRight,
  ShieldCheck,
  X,
  Sparkles,
  Layers,
  Bitcoin,
  Boxes,
  QrCode,
  DollarSign,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

export default function PaymentMethodsManager() {
  const {
    accounts,
    isLoading: accLoading,
    addAccount,
    updateAccount,
    deleteAccount,
  } = useFinancialAccounts();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<FinancialAccount> | null>(null);
  const [newPattern, setNewPattern] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  const { profile } = useProfile();
  const { mepRate } = useDolarMEP();
  const displayCurrency = profile?.default_currency === "ARS" ? "ARS" : "USD";
  const { cx, currencySymbol, fmtCompact } = makeFormatters(displayCurrency, mepRate);

  // Consolidated Total Liquid Balance
  const totalLiquidBalanceUSD = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + Math.max(0, Number(acc.current_balance) || 0), 0);
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    if (!searchFilter.trim()) return accounts;
    const q = searchFilter.toLowerCase().trim();
    return accounts.filter((acc) => {
      const matchName = acc.name.toLowerCase().includes(q);
      const matchPatterns = (acc.detection_patterns || []).some((p) => p.toLowerCase().includes(q));
      return matchName || matchPatterns;
    });
  }, [accounts, searchFilter]);

  const handleOpenAdd = () => {
    setEditingAccount({
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
    setNewPattern("");
    setModalOpen(true);
  };

  const handleOpenEdit = (acc: FinancialAccount) => {
    setEditingAccount({ ...acc });
    setNewPattern("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingAccount?.name?.trim()) {
      toast.error("Ingresa un nombre para la cuenta financiera");
      return;
    }

    if (editingAccount.id) {
      await updateAccount.mutateAsync({
        id: editingAccount.id,
        updates: editingAccount,
      });
    } else {
      await addAccount.mutateAsync(editingAccount);
    }
    setModalOpen(false);
  };

  const handleAddPattern = () => {
    if (!newPattern.trim() || !editingAccount) return;
    const pat = newPattern.trim();
    if (!editingAccount.detection_patterns?.includes(pat)) {
      setEditingAccount({
        ...editingAccount,
        detection_patterns: [...(editingAccount.detection_patterns || []), pat],
      });
    }
    setNewPattern("");
  };

  const handleRemovePattern = (pat: string) => {
    if (!editingAccount) return;
    setEditingAccount({
      ...editingAccount,
      detection_patterns: (editingAccount.detection_patterns || []).filter((p) => p !== pat),
    });
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "bank":
        return <Building className="h-5 w-5" />;
      case "cash_wallet":
        return <Coins className="h-5 w-5" />;
      case "crypto":
        return <Bitcoin className="h-5 w-5" />;
      default:
        return <Wallet className="h-5 w-5" />;
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case "bank":
        return "Banco";
      case "cash_wallet":
        return "Efectivo";
      case "crypto":
        return "Cripto";
      case "broker_cash":
        return "Broker";
      default:
        return "Billetera Digital";
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-foreground">
            Cuentas Financieras
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Tus cuentas reales donde reside tu dinero. Cada cuenta engloba sus medios de pago y patrones de auto-detección OCR.
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 text-xs shadow-md"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          <span>Nueva Cuenta</span>
        </Button>
      </div>

      {/* Hero Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>🏦 Liquidez Total en Cuentas</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
            {currencySymbol}
            {cx(totalLiquidBalanceUSD).toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {accounts.length} cuentas financieras activas
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>⚡ Auto-detección OCR</span>
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-foreground">
            1-Paso <span className="text-xs font-sans text-muted-foreground">directo a cuenta</span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Los comprobantes (Pix, Global Card, Transferencias) deducen directamente de la cuenta correspondiente
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>🛡️ Consistencia Contable</span>
            <ShieldCheck className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-purple-300">
            100% <span className="text-xs font-sans text-muted-foreground">reconciliado</span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Sin balances negativos ficticios en tarjetas plásticas
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Buscar cuenta o palabra clave OCR (ej: Pix, Global Card, MERPAGO)..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="max-w-md font-mono text-xs"
        />
        <span className="text-xs text-muted-foreground font-mono">
          Mostrando {filteredAccounts.length} de {accounts.length} cuentas
        </span>
      </div>

      {/* Grid of Accounts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filteredAccounts.map((acc) => {
          const patterns = acc.detection_patterns || [];

          return (
            <div
              key={acc.id}
              className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl border bg-card hover:border-primary/50 transition-all shadow-sm space-y-4 group relative overflow-hidden"
            >
              {/* Header with Icon, Name & Type */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"
                    style={{ backgroundColor: acc.color || "#10b981" }}
                  >
                    {getAccountIcon(acc.type)}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground leading-tight">{acc.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.2 text-[9px] font-bold uppercase text-primary">
                        {getAccountTypeLabel(acc.type)}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        · {acc.currency}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => handleOpenEdit(acc)}
                    title="Editar cuenta"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar la cuenta '${acc.name}'?`)) {
                        deleteAccount.mutate(acc.id);
                      }
                    }}
                    title="Eliminar cuenta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Detection Patterns / Keywords Pill List */}
              <div className="space-y-1 bg-muted/20 rounded-xl p-3 border border-border/30">
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
                  <span>Detección en Comprobantes & Medios:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {patterns.length === 0 ? (
                    <span className="text-[10px] text-muted-foreground/60 italic">
                      Sin patrones (usa el nombre)
                    </span>
                  ) : (
                    patterns.map((pat) => (
                      <span
                        key={pat}
                        className="rounded-md bg-background/90 border border-border/40 px-2 py-0.5 text-[10px] font-mono font-medium text-foreground"
                      >
                        {pat}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Balance Footer */}
              <div className="border-t border-border/40 pt-3 flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground font-medium">Saldo Líquido:</span>
                <span
                  className={`font-black text-base sm:text-lg ${
                    Number(acc.current_balance) >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {currencySymbol}
                  {cx(Number(acc.current_balance) || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Account Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-primary flex items-center gap-2">
              <Building className="h-5 w-5 text-emerald-400" />
              <span>{editingAccount?.id ? "Editar Cuenta Financiera" : "Nueva Cuenta Financiera"}</span>
            </DialogTitle>
          </DialogHeader>

          {editingAccount && (
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nombre de la Cuenta</label>
                <Input
                  value={editingAccount.name || ""}
                  onChange={(e) => setEditingAccount({ ...editingAccount, name: e.target.value })}
                  placeholder="Ej: DolarApp, Mercado Pago, Bank USD, Binance..."
                  className="mt-1 font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tipo de Cuenta</label>
                  <select
                    value={editingAccount.type || "digital_wallet"}
                    onChange={(e) => setEditingAccount({ ...editingAccount, type: e.target.value as any })}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                  >
                    <option value="digital_wallet">Billetera Digital (DolarApp, MP)</option>
                    <option value="bank">Cuenta Bancaria (Bank ARS/USD)</option>
                    <option value="crypto">Custodia Cripto (Binance, Ledger)</option>
                    <option value="cash_wallet">Billetera Física (Efectivo)</option>
                    <option value="broker_cash">Efectivo Broker</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Moneda Nativa</label>
                  <select
                    value={editingAccount.currency || "USD"}
                    onChange={(e) => setEditingAccount({ ...editingAccount, currency: e.target.value as any })}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                  >
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                    <option value="EUR">EUR</option>
                    <option value="BRL">BRL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Saldo Inicial (Base)</label>
                <Input
                  type="number"
                  value={editingAccount.initial_balance ?? 0}
                  onChange={(e) =>
                    setEditingAccount({ ...editingAccount, initial_balance: parseFloat(e.target.value) || 0 })
                  }
                  className="mt-1 font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Color de Identificación</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={editingAccount.color || "#10b981"}
                    onChange={(e) => setEditingAccount({ ...editingAccount, color: e.target.value })}
                    className="h-8 w-10 cursor-pointer rounded border"
                  />
                  <Input
                    value={editingAccount.color || "#10b981"}
                    onChange={(e) => setEditingAccount({ ...editingAccount, color: e.target.value })}
                    className="font-mono text-xs h-8"
                  />
                </div>
              </div>

              {/* Detection Patterns & OCR Keywords */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Patrones de Auto-detección OCR (Keywords de comprobantes, tarjetas, Pix)
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
                    placeholder="Ej: Pix, Global Card, USDc, MERPAGO*, Visa..."
                    className="font-mono text-xs"
                  />
                  <Button size="sm" onClick={handleAddPattern} className="h-9">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">
                  {(editingAccount.detection_patterns || []).map((pat) => (
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
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" onClick={handleSave}>
              Guardar Cuenta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
