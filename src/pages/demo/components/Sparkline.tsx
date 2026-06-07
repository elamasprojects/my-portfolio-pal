import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

export function Sparkline({
  data,
  positive,
  height = 36,
}: {
  data: number[];
  positive?: boolean;
  height?: number;
}) {
  const chartData = data.map((v, i) => ({ i, v }));
  const color = positive === undefined ? "hsl(var(--primary))" : positive ? "hsl(var(--gain))" : "hsl(var(--loss))";
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
