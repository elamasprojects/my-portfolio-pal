import { useState } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingDown } from "lucide-react";
import { Holding } from "@/hooks/usePortfolio";

interface HoldingWithPnl extends Holding {
  currentPrice?: number | null;
  mktVal?: number | null;
  uPnl?: number | null;
  uPnlPct?: number | null;
}

interface MobileSwipeableHoldingCardProps {
  holding: HoldingWithPnl;
  pricesLoading: boolean;
  currencySymbol: string;
  cx: (val: number) => number;
  fmtCompact: (val: number) => string;
  onNavigate: (symbol: string) => void;
  onQuickSell: (holding: Holding, price?: number | null) => void;
}

export function MobileSwipeableHoldingCard({
  holding,
  pricesLoading,
  currencySymbol,
  cx,
  fmtCompact,
  onNavigate,
  onQuickSell,
}: MobileSwipeableHoldingCardProps) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-80, -20, 0], [1, 0.5, 0]);

  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (info.offset.x < -50 || info.velocity.x < -200) {
      onQuickSell(holding, holding.currentPrice);
    }
    x.set(0);
    setTimeout(() => setIsDragging(false), 150);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Background action layer (revealed on swipe left) */}
      <div className="absolute inset-0 bg-destructive/90 flex items-center justify-end pr-4 text-destructive-foreground font-semibold text-xs gap-1.5 pointer-events-auto">
        <motion.div style={{ opacity }} className="flex items-center gap-1.5">
          <TrendingDown className="h-4 w-4" />
          <span>Vender</span>
        </motion.div>
      </div>

      {/* Foreground Card */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -90, right: 0 }}
        dragElastic={0.1}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (!isDragging) onNavigate(holding.symbol);
        }}
        className="relative z-10 flex items-center justify-between p-3.5 bg-card hover:bg-accent/20 transition-colors cursor-pointer"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary text-sm tracking-wide">
              {holding.symbol}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
            {holding.net_quantity.toFixed(2)} @ {currencySymbol}
            {cx(holding.avg_cost).toFixed(2)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            {pricesLoading ? (
              <Skeleton className="h-5 w-16 ml-auto" />
            ) : (
              <>
                <p className="font-mono text-sm font-bold">
                  {holding.mktVal !== null
                    ? fmtCompact(cx(holding.mktVal))
                    : fmtCompact(cx(holding.total_invested))}
                </p>
                {holding.uPnlPct !== null && (
                  <p
                    className={`text-[11px] font-mono font-semibold ${
                      holding.uPnl! >= 0 ? "text-gain" : "text-loss"
                    }`}
                  >
                    {holding.uPnl! >= 0 ? "+" : ""}
                    {holding.uPnlPct.toFixed(1)}%
                  </p>
                )}
              </>
            )}
          </div>

          {/* Quick sell button icon */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 ml-1"
            title={`Vender ${holding.symbol}`}
            onClick={(e) => {
              e.stopPropagation();
              onQuickSell(holding, holding.currentPrice);
            }}
          >
            <TrendingDown className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
