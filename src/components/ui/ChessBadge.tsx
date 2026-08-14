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
  labelColor: string;
}

const EVALUATION_CONFIGS: Record<string, BadgeStyleConfig> = {
  brillante: {
    glyph: "!!",
    label: "Brillante",
    bgGradient: "from-[#26c2a3] to-[#16968c]",
    shadowColor: "#0e6962",
    textColor: "#ffffff",
    labelColor: "text-[#26c2a3]",
  },
  brilliant: {
    glyph: "!!",
    label: "Brillante",
    bgGradient: "from-[#26c2a3] to-[#16968c]",
    shadowColor: "#0e6962",
    textColor: "#ffffff",
    labelColor: "text-[#26c2a3]",
  },
  gran_jugada: {
    glyph: "!",
    label: "Gran Jugada",
    bgGradient: "from-[#3894e6] to-[#206eb5]",
    shadowColor: "#144f85",
    textColor: "#ffffff",
    labelColor: "text-[#3894e6]",
  },
  great: {
    glyph: "!",
    label: "Gran Jugada",
    bgGradient: "from-[#3894e6] to-[#206eb5]",
    shadowColor: "#144f85",
    textColor: "#ffffff",
    labelColor: "text-[#3894e6]",
  },
  correcta: {
    glyph: "✓",
    label: "Correcta",
    bgGradient: "from-[#96bc4b] to-[#81a63c]",
    shadowColor: "#5c7929",
    textColor: "#ffffff",
    labelColor: "text-[#96bc4b]",
  },
  best: {
    glyph: "★",
    label: "Mejor",
    bgGradient: "from-[#96bc4b] to-[#81a63c]",
    shadowColor: "#5c7929",
    textColor: "#ffffff",
    labelColor: "text-[#96bc4b]",
  },
  buena: {
    glyph: "✓",
    label: "Buena",
    bgGradient: "from-[#a8cf54] to-[#95bb4a]",
    shadowColor: "#6c8834",
    textColor: "#ffffff",
    labelColor: "text-[#a8cf54]",
  },
  good: {
    glyph: "✓",
    label: "Buena",
    bgGradient: "from-[#a8cf54] to-[#95bb4a]",
    shadowColor: "#6c8834",
    textColor: "#ffffff",
    labelColor: "text-[#a8cf54]",
  },
  imprecision: {
    glyph: "?!",
    label: "Imprecisión",
    bgGradient: "from-[#f5c767] to-[#e5a93c]",
    shadowColor: "#ab7a22",
    textColor: "#ffffff",
    labelColor: "text-[#f5c767]",
  },
  "imprecisión": {
    glyph: "?!",
    label: "Imprecisión",
    bgGradient: "from-[#f5c767] to-[#e5a93c]",
    shadowColor: "#ab7a22",
    textColor: "#ffffff",
    labelColor: "text-[#f5c767]",
  },
  inaccuracy: {
    glyph: "?!",
    label: "Imprecisión",
    bgGradient: "from-[#f5c767] to-[#e5a93c]",
    shadowColor: "#ab7a22",
    textColor: "#ffffff",
    labelColor: "text-[#f5c767]",
  },
  error: {
    glyph: "?",
    label: "Error",
    bgGradient: "from-[#f09338] to-[#db7718]",
    shadowColor: "#a3530a",
    textColor: "#ffffff",
    labelColor: "text-[#f09338]",
  },
  mistake: {
    glyph: "?",
    label: "Error",
    bgGradient: "from-[#f09338] to-[#db7718]",
    shadowColor: "#a3530a",
    textColor: "#ffffff",
    labelColor: "text-[#f09338]",
  },
  blunder: {
    glyph: "??",
    label: "Blunder",
    bgGradient: "from-[#fa4f39] to-[#dc331e]",
    shadowColor: "#9c1d0d",
    textColor: "#ffffff",
    labelColor: "text-[#fa4f39]",
  },
  libro: {
    glyph: "📖",
    label: "Libro",
    bgGradient: "from-[#c4935b] to-[#a8743a]",
    shadowColor: "#754e20",
    textColor: "#ffffff",
    labelColor: "text-[#c4935b]",
  },
  book: {
    glyph: "📖",
    label: "Libro",
    bgGradient: "from-[#c4935b] to-[#a8743a]",
    shadowColor: "#754e20",
    textColor: "#ffffff",
    labelColor: "text-[#c4935b]",
  },
};

const EVENT_CONFIGS: Record<string, BadgeStyleConfig> = {
  buy: {
    glyph: "!!",
    label: "Compra",
    bgGradient: "from-[#26c2a3] to-[#16968c]",
    shadowColor: "#0e6962",
    textColor: "#ffffff",
    labelColor: "text-[#26c2a3]",
  },
  sell: {
    glyph: "!",
    label: "Venta",
    bgGradient: "from-[#f5c767] to-[#e5a93c]",
    shadowColor: "#ab7a22",
    textColor: "#ffffff",
    labelColor: "text-[#f5c767]",
  },
  income: {
    glyph: "✓",
    label: "Ingreso",
    bgGradient: "from-[#96bc4b] to-[#81a63c]",
    shadowColor: "#5c7929",
    textColor: "#ffffff",
    labelColor: "text-[#96bc4b]",
  },
  expense: {
    glyph: "♟",
    label: "Gasto",
    bgGradient: "from-[#fa4f39] to-[#dc331e]",
    shadowColor: "#9c1d0d",
    textColor: "#ffffff",
    labelColor: "text-[#fa4f39]",
  },
  dividend: {
    glyph: "★",
    label: "Dividendo",
    bgGradient: "from-[#b257ec] to-[#9333ea]",
    shadowColor: "#671eb0",
    textColor: "#ffffff",
    labelColor: "text-[#c084fc]",
  },
  transfer: {
    glyph: "⇄",
    label: "Transfer",
    bgGradient: "from-[#64748b] to-[#475569]",
    shadowColor: "#273240",
    textColor: "#ffffff",
    labelColor: "text-[#94a3b8]",
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
    labelColor: "text-foreground",
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

  const labelSizes = {
    xs: "text-[10px]",
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const gapSizes = {
    xs: "gap-1.5",
    sm: "gap-2",
    md: "gap-2.5",
    lg: "gap-3",
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
        boxShadow: `0 2px 0 0 ${config.shadowColor}, 0 2px 4px rgba(0,0,0,0.35)`,
        color: config.textColor,
        textShadow: "0 1px 1px rgba(0,0,0,0.5)",
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

  // Clean, frameless layout: Circular 3D token + bold colored text label (No pill container/background)
  return (
    <div
      className={cn(
        "inline-flex items-center select-none py-0.5",
        gapSizes[size],
        className
      )}
      {...props}
    >
      {renderCircleToken()}
      <span
        className={cn(
          "font-black tracking-wider uppercase leading-none select-none",
          config.labelColor,
          labelSizes[size]
        )}
      >
        {displayLabel}
      </span>
    </div>
  );
}
