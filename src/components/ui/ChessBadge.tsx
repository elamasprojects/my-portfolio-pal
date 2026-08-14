import React from "react";
import { cn } from "@/lib/utils";

export type ChessEvaluationType =
  | "brillante"
  | "brilliant"
  | "gran_jugada"
  | "great"
  | "correcta"
  | "best"
  | "buena"
  | "good"
  | "imprecision"
  | "imprecisión"
  | "inaccuracy"
  | "error"
  | "mistake"
  | "blunder"
  | "libro"
  | "book";

export type ChessMovementEventType =
  | "buy"
  | "sell"
  | "income"
  | "expense"
  | "dividend"
  | "transfer"
  | "trade";

export interface ChessBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  evaluation?: ChessEvaluationType | string;
  eventType?: ChessMovementEventType | string;
  label?: string;
  showLabel?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  circleOnly?: boolean;
}

interface BadgeStyleConfig {
  glyph: string;
  label: string;
  bgGradient: string;
  shadowColor: string;
  textColor: string;
  pillBg: string;
  pillBorder: string;
}

const EVALUATION_CONFIGS: Record<string, BadgeStyleConfig> = {
  brillante: {
    glyph: "!!",
    label: "Brillante",
    bgGradient: "from-[#26c2a3] to-[#16968c]",
    shadowColor: "#0e6962",
    textColor: "#ffffff",
    pillBg: "bg-[#16968c]/15 text-[#26c2a3] border-[#16968c]/30",
    pillBorder: "border-[#16968c]/40",
  },
  brilliant: {
    glyph: "!!",
    label: "Brillante",
    bgGradient: "from-[#26c2a3] to-[#16968c]",
    shadowColor: "#0e6962",
    textColor: "#ffffff",
    pillBg: "bg-[#16968c]/15 text-[#26c2a3] border-[#16968c]/30",
    pillBorder: "border-[#16968c]/40",
  },
  gran_jugada: {
    glyph: "!",
    label: "Gran Jugada",
    bgGradient: "from-[#3894e6] to-[#206eb5]",
    shadowColor: "#144f85",
    textColor: "#ffffff",
    pillBg: "bg-[#206eb5]/15 text-[#3894e6] border-[#206eb5]/30",
    pillBorder: "border-[#206eb5]/40",
  },
  great: {
    glyph: "!",
    label: "Gran Jugada",
    bgGradient: "from-[#3894e6] to-[#206eb5]",
    shadowColor: "#144f85",
    textColor: "#ffffff",
    pillBg: "bg-[#206eb5]/15 text-[#3894e6] border-[#206eb5]/30",
    pillBorder: "border-[#206eb5]/40",
  },
  correcta: {
    glyph: "✓",
    label: "Correcta",
    bgGradient: "from-[#96bc4b] to-[#81a63c]",
    shadowColor: "#5c7929",
    textColor: "#ffffff",
    pillBg: "bg-[#81a63c]/15 text-[#96bc4b] border-[#81a63c]/30",
    pillBorder: "border-[#81a63c]/40",
  },
  best: {
    glyph: "★",
    label: "Mejor",
    bgGradient: "from-[#96bc4b] to-[#81a63c]",
    shadowColor: "#5c7929",
    textColor: "#ffffff",
    pillBg: "bg-[#81a63c]/15 text-[#96bc4b] border-[#81a63c]/30",
    pillBorder: "border-[#81a63c]/40",
  },
  buena: {
    glyph: "✓",
    label: "Buena",
    bgGradient: "from-[#a8cf54] to-[#95bb4a]",
    shadowColor: "#6c8834",
    textColor: "#ffffff",
    pillBg: "bg-[#95bb4a]/15 text-[#a8cf54] border-[#95bb4a]/30",
    pillBorder: "border-[#95bb4a]/40",
  },
  good: {
    glyph: "✓",
    label: "Buena",
    bgGradient: "from-[#a8cf54] to-[#95bb4a]",
    shadowColor: "#6c8834",
    textColor: "#ffffff",
    pillBg: "bg-[#95bb4a]/15 text-[#a8cf54] border-[#95bb4a]/30",
    pillBorder: "border-[#95bb4a]/40",
  },
  imprecision: {
    glyph: "?!",
    label: "Imprecisión",
    bgGradient: "from-[#f5c767] to-[#e5a93c]",
    shadowColor: "#ab7a22",
    textColor: "#ffffff",
    pillBg: "bg-[#e5a93c]/15 text-[#f5c767] border-[#e5a93c]/30",
    pillBorder: "border-[#e5a93c]/40",
  },
  "imprecisión": {
    glyph: "?!",
    label: "Imprecisión",
    bgGradient: "from-[#f5c767] to-[#e5a93c]",
    shadowColor: "#ab7a22",
    textColor: "#ffffff",
    pillBg: "bg-[#e5a93c]/15 text-[#f5c767] border-[#e5a93c]/30",
    pillBorder: "border-[#e5a93c]/40",
  },
  inaccuracy: {
    glyph: "?!",
    label: "Imprecisión",
    bgGradient: "from-[#f5c767] to-[#e5a93c]",
    shadowColor: "#ab7a22",
    textColor: "#ffffff",
    pillBg: "bg-[#e5a93c]/15 text-[#f5c767] border-[#e5a93c]/30",
    pillBorder: "border-[#e5a93c]/40",
  },
  error: {
    glyph: "?",
    label: "Error",
    bgGradient: "from-[#f09338] to-[#db7718]",
    shadowColor: "#a3530a",
    textColor: "#ffffff",
    pillBg: "bg-[#db7718]/15 text-[#f09338] border-[#db7718]/30",
    pillBorder: "border-[#db7718]/40",
  },
  mistake: {
    glyph: "?",
    label: "Error",
    bgGradient: "from-[#f09338] to-[#db7718]",
    shadowColor: "#a3530a",
    textColor: "#ffffff",
    pillBg: "bg-[#db7718]/15 text-[#f09338] border-[#db7718]/30",
    pillBorder: "border-[#db7718]/40",
  },
  blunder: {
    glyph: "??",
    label: "Blunder",
    bgGradient: "from-[#fa4f39] to-[#dc331e]",
    shadowColor: "#9c1d0d",
    textColor: "#ffffff",
    pillBg: "bg-[#dc331e]/15 text-[#fa4f39] border-[#dc331e]/30",
    pillBorder: "border-[#dc331e]/40",
  },
  libro: {
    glyph: "📖",
    label: "Libro",
    bgGradient: "from-[#c4935b] to-[#a8743a]",
    shadowColor: "#754e20",
    textColor: "#ffffff",
    pillBg: "bg-[#a8743a]/15 text-[#c4935b] border-[#a8743a]/30",
    pillBorder: "border-[#a8743a]/40",
  },
  book: {
    glyph: "📖",
    label: "Libro",
    bgGradient: "from-[#c4935b] to-[#a8743a]",
    shadowColor: "#754e20",
    textColor: "#ffffff",
    pillBg: "bg-[#a8743a]/15 text-[#c4935b] border-[#a8743a]/30",
    pillBorder: "border-[#a8743a]/40",
  },
};

const EVENT_CONFIGS: Record<string, BadgeStyleConfig> = {
  buy: {
    glyph: "!!",
    label: "Compra",
    bgGradient: "from-[#26c2a3] to-[#16968c]",
    shadowColor: "#0e6962",
    textColor: "#ffffff",
    pillBg: "bg-[#16968c]/15 text-[#26c2a3] border-[#16968c]/30",
    pillBorder: "border-[#16968c]/40",
  },
  sell: {
    glyph: "!",
    label: "Venta",
    bgGradient: "from-[#f5c767] to-[#e5a93c]",
    shadowColor: "#ab7a22",
    textColor: "#ffffff",
    pillBg: "bg-[#e5a93c]/15 text-[#f5c767] border-[#e5a93c]/30",
    pillBorder: "border-[#e5a93c]/40",
  },
  income: {
    glyph: "✓",
    label: "Ingreso",
    bgGradient: "from-[#96bc4b] to-[#81a63c]",
    shadowColor: "#5c7929",
    textColor: "#ffffff",
    pillBg: "bg-[#81a63c]/15 text-[#96bc4b] border-[#81a63c]/30",
    pillBorder: "border-[#81a63c]/40",
  },
  expense: {
    glyph: "♟",
    label: "Gasto",
    bgGradient: "from-[#fa4f39] to-[#dc331e]",
    shadowColor: "#9c1d0d",
    textColor: "#ffffff",
    pillBg: "bg-[#dc331e]/15 text-[#fa4f39] border-[#dc331e]/30",
    pillBorder: "border-[#dc331e]/40",
  },
  dividend: {
    glyph: "★",
    label: "Dividendo",
    bgGradient: "from-[#b257ec] to-[#9333ea]",
    shadowColor: "#671eb0",
    textColor: "#ffffff",
    pillBg: "bg-[#9333ea]/15 text-[#b257ec] border-[#9333ea]/30",
    pillBorder: "border-[#9333ea]/40",
  },
  transfer: {
    glyph: "⇄",
    label: "Transfer",
    bgGradient: "from-[#64748b] to-[#475569]",
    shadowColor: "#273240",
    textColor: "#ffffff",
    pillBg: "bg-[#475569]/15 text-[#94a3b8] border-[#475569]/30",
    pillBorder: "border-[#475569]/40",
  },
};

export function ChessBadge({
  evaluation,
  eventType,
  label: customLabel,
  showLabel = true,
  size = "sm",
  circleOnly = false,
  className,
  ...props
}: ChessBadgeProps) {
  // Resolve configuration
  let config: BadgeStyleConfig = {
    glyph: "•",
    label: customLabel || "Movimiento",
    bgGradient: "from-[#475569] to-[#334155]",
    shadowColor: "#1e293b",
    textColor: "#ffffff",
    pillBg: "bg-muted/40 text-foreground border-border/40",
    pillBorder: "border-border/40",
  };

  if (evaluation) {
    const key = evaluation.toLowerCase().trim();
    if (EVALUATION_CONFIGS[key]) {
      config = EVALUATION_CONFIGS[key];
    }
  } else if (eventType) {
    const key = eventType.toLowerCase().trim();
    if (EVENT_CONFIGS[key]) {
      config = EVENT_CONFIGS[key];
    }
  }

  const displayLabel = customLabel || config.label;

  // Size dimensions
  const circleSizes = {
    xs: "w-4 h-4 text-[9px]",
    sm: "w-5 h-5 text-[10px]",
    md: "w-6 h-6 text-xs",
    lg: "w-8 h-8 text-sm",
  };

  const pillTextSizes = {
    xs: "text-[10px] py-0.5 px-1.5 gap-1",
    sm: "text-xs py-0.5 px-2 gap-1.5",
    md: "text-xs py-1 px-2.5 gap-2",
    lg: "text-sm py-1.5 px-3 gap-2.5",
  };

  // Pure 3D Circle Token (Exact Chess.com Style)
  const renderCircleToken = () => (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-full font-black select-none shrink-0 transition-transform",
        "bg-gradient-to-b",
        config.bgGradient,
        circleSizes[size]
      )}
      style={{
        boxShadow: `0 2px 0 0 ${config.shadowColor}, 0 3px 4px rgba(0,0,0,0.35)`,
        color: config.textColor,
        textShadow: "0 1px 1px rgba(0,0,0,0.45)",
      }}
    >
      <span className="relative -top-[0.5px] tracking-tighter leading-none">
        {config.glyph}
      </span>
    </span>
  );

  if (circleOnly || !showLabel) {
    return (
      <div
        className={cn("inline-flex items-center justify-center", className)}
        title={displayLabel}
        {...props}
      >
        {renderCircleToken()}
      </div>
    );
  }

  // Pill badge with Chess.com 3D token + stylish label
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border font-semibold select-none shadow-sm transition-all",
        config.pillBg,
        pillTextSizes[size],
        className
      )}
      {...props}
    >
      {renderCircleToken()}
      <span className="font-bold tracking-wide uppercase text-[10px] leading-none">
        {displayLabel}
      </span>
    </div>
  );
}
