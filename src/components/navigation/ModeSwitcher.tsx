import { Briefcase, Wallet } from "lucide-react";
import { useAppMode } from "@/hooks/useAppMode";
import { useLanguage } from "@/i18n";
import { motion } from "motion/react";

export function ModeSwitcher({ className = "" }: { className?: string }) {
  const { mode, setMode } = useAppMode();
  const { t } = useLanguage();

  return (
    <div
      className={`relative flex items-center rounded-full border border-border/40 bg-muted/40 p-1 backdrop-blur-md ${className}`}
    >
      {/* Investments Tab */}
      <button
        type="button"
        onClick={() => setMode("investments")}
        className={`relative z-10 flex items-center gap-1.5 px-3 py-1 text-xs font-semibold transition-colors ${
          mode === "investments"
            ? "text-primary-foreground font-bold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {mode === "investments" && (
          <motion.div
            layoutId="mode-pill-active"
            className="absolute inset-0 rounded-full bg-primary shadow-sm"
            transition={{ type: "spring", stiffness: 450, damping: 35 }}
          />
        )}
        <span className="relative z-20 flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5" />
          <span>Inversiones</span>
        </span>
      </button>

      {/* Finance Tab */}
      <button
        type="button"
        onClick={() => setMode("finance")}
        className={`relative z-10 flex items-center gap-1.5 px-3 py-1 text-xs font-semibold transition-colors ${
          mode === "finance"
            ? "text-primary-foreground font-bold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {mode === "finance" && (
          <motion.div
            layoutId="mode-pill-active"
            className="absolute inset-0 rounded-full bg-primary shadow-sm"
            transition={{ type: "spring", stiffness: 450, damping: 35 }}
          />
        )}
        <span className="relative z-20 flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5" />
          <span>Finanzas</span>
        </span>
      </button>
    </div>
  );
}
