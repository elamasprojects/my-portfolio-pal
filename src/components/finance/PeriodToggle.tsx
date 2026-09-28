import { cn } from "@/lib/utils";
import { PERIOD_LABELS, PERIOD_SHORT_LABELS, type FinancePeriod } from "@/lib/financePeriods";

/**
 * Los períodos como botones juntos, no como un desplegable: son cuatro, y verlos todos a la
 * vez dice qué se está mirando sin abrir nada. Scroll horizontal en el teléfono en vez de
 * partirse en dos renglones.
 */
export function PeriodToggle({
  value,
  options,
  onChange,
  className,
}: {
  value: FinancePeriod;
  options: FinancePeriod[];
  onChange: (p: FinancePeriod) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Período"
      className={cn(
        "flex w-full items-center gap-0.5 rounded-lg sm:inline-flex sm:w-auto border border-border/70 bg-background/80 p-0.5",
        className,
      )}
    >
      {options.map((p) => {
        const active = p === value;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(p)}
            className={cn(
              "h-7 flex-1 whitespace-nowrap rounded-md px-2 sm:flex-none sm:px-2.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span className="sm:hidden">{PERIOD_SHORT_LABELS[p]}</span>
            <span className="hidden sm:inline">{PERIOD_LABELS[p]}</span>
          </button>
        );
      })}
    </div>
  );
}
