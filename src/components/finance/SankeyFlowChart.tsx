import { useState, useMemo } from "react";
import { SankeyData, SankeyNode, SankeyLink } from "@/types/finance";
import { useLanguage } from "@/i18n";
import { motion, AnimatePresence } from "motion/react";

interface SankeyFlowChartProps {
  data: SankeyData;
  displayCurrency: "USD" | "ARS";
  currencySymbol: string;
  cx: (val: number) => number;
}

export function SankeyFlowChart({
  data,
  displayCurrency,
  currencySymbol,
  cx,
}: SankeyFlowChartProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const { nodes, links, totalIncome, totalExpenses, netResult, savingsRatePct } = data;

  // Layout calculation
  const layout = useMemo(() => {
    if (!nodes || nodes.length === 0) return null;

    const width = 860;
    const height = 480;
    const margin = { top: 40, right: 180, bottom: 40, left: 180 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const incomeNodes = nodes.filter((n) => n.category === "income");
    const spineNode = nodes.find((n) => n.category === "spine") || {
      id: "cash_collected",
      name: "CASH COLLECTED",
      value: Math.max(totalIncome, totalExpenses),
      category: "spine" as const,
      color: "#f8fafc",
      pct: 100,
    };
    const expenseNodes = nodes.filter((n) => n.category === "expense");
    const netNode = nodes.find((n) => n.category === "net");

    const rightNodes = [...expenseNodes, ...(netNode ? [netNode] : [])];

    // Compute Y positions
    const totalLeftVal = incomeNodes.reduce((s, n) => s + n.value, 0) || 1;
    const totalRightVal = rightNodes.reduce((s, n) => s + n.value, 0) || 1;

    const gap = 12;

    // Position Left Nodes
    const leftAvailableHeight = Math.max(80, innerHeight - Math.max(0, incomeNodes.length - 1) * gap);
    let currentYLeft = margin.top;
    const nodePositions = new Map<
      string,
      { x: number; y: number; width: number; height: number; node: SankeyNode }
    >();

    for (const node of incomeNodes) {
      const nodeH = Math.max(16, (node.value / totalLeftVal) * leftAvailableHeight);
      nodePositions.set(node.id, {
        x: margin.left - 12,
        y: currentYLeft,
        width: 12,
        height: nodeH,
        node,
      });
      currentYLeft += nodeH + gap;
    }

    // Position Center Spine
    const spineH = innerHeight * 0.9;
    const spineX = margin.left + innerWidth / 2 - 6;
    const spineY = margin.top + innerHeight * 0.05;
    nodePositions.set(spineNode.id, {
      x: spineX,
      y: spineY,
      width: 12,
      height: spineH,
      node: spineNode,
    });

    // Position Right Nodes
    const rightAvailableHeight = Math.max(80, innerHeight - Math.max(0, rightNodes.length - 1) * gap);
    let currentYRight = margin.top;
    for (const node of rightNodes) {
      const nodeH = Math.max(16, (node.value / totalRightVal) * rightAvailableHeight);
      nodePositions.set(node.id, {
        x: width - margin.right,
        y: currentYRight,
        width: 12,
        height: nodeH,
        node,
      });
      currentYRight += nodeH + gap;
    }

    // Compute Ribbons / Links
    const computedLinks: Array<{
      id: string;
      source: string;
      target: string;
      path: string;
      color: string;
      value: number;
    }> = [];

    // Left -> Spine
    let spineInY = spineY;
    for (const node of incomeNodes) {
      const srcPos = nodePositions.get(node.id);
      if (!srcPos) continue;
      const ribbonH = (node.value / totalLeftVal) * spineH;

      const x0 = srcPos.x + srcPos.width;
      const y0 = srcPos.y;
      const y0b = srcPos.y + srcPos.height;

      const x1 = spineX;
      const y1 = spineInY;
      const y1b = spineInY + ribbonH;

      spineInY += ribbonH;

      const cpx = (x0 + x1) / 2;
      const path = `M ${x0} ${y0} C ${cpx} ${y0}, ${cpx} ${y1}, ${x1} ${y1} L ${x1} ${y1b} C ${cpx} ${y1b}, ${cpx} ${y0b}, ${x0} ${y0b} Z`;

      computedLinks.push({
        id: `${node.id}->${spineNode.id}`,
        source: node.id,
        target: spineNode.id,
        path,
        color: node.color || "#10b981",
        value: node.value,
      });
    }

    // Spine -> Right
    let spineOutY = spineY;
    for (const node of rightNodes) {
      const tgtPos = nodePositions.get(node.id);
      if (!tgtPos) continue;
      const ribbonH = (node.value / totalRightVal) * spineH;

      const x0 = spineX + 12;
      const y0 = spineOutY;
      const y0b = spineOutY + ribbonH;

      const x1 = tgtPos.x;
      const y1 = tgtPos.y;
      const y1b = tgtPos.y + tgtPos.height;

      spineOutY += ribbonH;

      const cpx = (x0 + x1) / 2;
      const path = `M ${x0} ${y0} C ${cpx} ${y0}, ${cpx} ${y1}, ${x1} ${y1} L ${x1} ${y1b} C ${cpx} ${y1b}, ${cpx} ${y0b}, ${x0} ${y0b} Z`;

      computedLinks.push({
        id: `${spineNode.id}->${node.id}`,
        source: spineNode.id,
        target: node.id,
        path,
        color: node.color || (node.category === "net" ? "#a855f7" : "#f43f5e"),
        value: node.value,
      });
    }

    return {
      width,
      height,
      nodePositions,
      computedLinks,
      incomeNodes,
      rightNodes,
      spineNode,
    };
  }, [nodes, totalIncome, totalExpenses]);

  if (!layout || nodes.length === 0) {
    return (
      <div className="flex h-72 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-center">
        <p className="text-sm font-medium text-foreground">
          Sin transacciones suficientes para el período
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Usa el botón central (+) o la barra de comandos para registrar tus primeros ingresos y gastos.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border/50 bg-[#09090b] p-4 text-white shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              💸 Flujo del Período
            </span>
          </div>
          <h2 className="text-3xl font-black font-mono tracking-tight text-white mt-0.5">
            {currencySymbol}
            {cx(totalIncome).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </h2>
          <p className="text-xs text-muted-foreground">
            De dónde entró cada peso y en qué se fue — Flujo de Caja Personal Consolidado
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-400">
            <span className="text-[10px] text-muted-foreground block">Tasa de Ahorro</span>
            <span className="font-bold text-sm">{savingsRatePct}%</span>
          </div>
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-purple-300">
            <span className="text-[10px] text-muted-foreground block">Excedente Neto</span>
            <span className="font-bold text-sm">
              {currencySymbol}
              {cx(netResult).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-x-auto pt-2">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="w-full min-w-[700px] h-[440px]"
        >
          <defs>
            <linearGradient id="spineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.7" />
            </linearGradient>
          </defs>

          {/* Ribbons */}
          {layout.computedLinks.map((link) => {
            const isHighlighted =
              hoveredNodeId === null ||
              link.source === hoveredNodeId ||
              link.target === hoveredNodeId;

            return (
              <path
                key={link.id}
                d={link.path}
                fill={link.color}
                fillOpacity={isHighlighted ? 0.45 : 0.08}
                stroke={link.color}
                strokeOpacity={isHighlighted ? 0.8 : 0.15}
                strokeWidth={1}
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredNodeId(link.source.startsWith("inc_") ? link.source : link.target)}
                onMouseLeave={() => setHoveredNodeId(null)}
              />
            );
          })}

          {/* Nodes */}
          {Array.from(layout.nodePositions.values()).map(({ x, y, width, height, node }) => {
            const isHovered = hoveredNodeId === node.id;
            const isSpine = node.category === "spine";

            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                {/* Vertical Bar */}
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx={3}
                  fill={isSpine ? "url(#spineGradient)" : node.color || "#3b82f6"}
                  className="transition-all duration-200"
                />

                {/* Text Label */}
                {node.category === "income" && (
                  <text
                    x={x - 10}
                    y={y + height / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="font-sans"
                  >
                    <tspan className="fill-white font-semibold text-[13px] block">
                      {node.name}
                    </tspan>
                    <tspan
                      x={x - 10}
                      dy="14"
                      className="fill-emerald-400 font-mono text-[11px]"
                    >
                      {currencySymbol}
                      {cx(node.value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{" "}
                      · {node.pct}%
                    </tspan>
                  </text>
                )}

                {node.category === "spine" && (
                  <text
                    x={x + width / 2}
                    y={y - 12}
                    textAnchor="middle"
                    className="font-mono text-[11px] font-bold fill-slate-300 tracking-wider"
                  >
                    CASH COLLECTED {currencySymbol}
                    {cx(node.value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </text>
                )}

                {(node.category === "expense" || node.category === "net") && (
                  <text
                    x={x + width + 10}
                    y={y + height / 2}
                    textAnchor="start"
                    dominantBaseline="middle"
                    className="font-sans"
                  >
                    <tspan
                      className={`font-semibold text-[13px] ${
                        node.category === "net" ? "fill-purple-300" : "fill-white"
                      }`}
                    >
                      {node.name}
                    </tspan>
                    <tspan
                      x={x + width + 10}
                      dy="14"
                      className={`font-mono text-[11px] ${
                        node.category === "net" ? "fill-purple-400 font-bold" : "fill-rose-400"
                      }`}
                    >
                      {currencySymbol}
                      {cx(node.value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{" "}
                      · {node.pct}%
                    </tspan>
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
