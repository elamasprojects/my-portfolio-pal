import { cn } from "@/lib/utils";

interface CurrencyToggleProps {
  value: "USD" | "ARS";
  onChange: (currency: "USD" | "ARS") => void;
  className?: string;
}

export function CurrencyToggle({ value, onChange, className }: CurrencyToggleProps) {
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 p-0.5", className)}>
      <button
        type="button"
        onClick={() => onChange("USD")}
        className={cn(
          "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all",
          value === "USD"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        🇺🇸 USD
      </button>
      <button
        type="button"
        onClick={() => onChange("ARS")}
        className={cn(
          "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all",
          value === "ARS"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        🇦🇷 ARS
      </button>
    </div>
  );
}
