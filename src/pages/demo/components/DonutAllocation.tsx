import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "../data/chartColors";

export function DonutAllocation({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value" isAnimationActive={false}>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {data.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-1 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="capitalize text-muted-foreground">{entry.name}</span>
            <span className="font-mono text-foreground">{total > 0 ? Math.round((entry.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
