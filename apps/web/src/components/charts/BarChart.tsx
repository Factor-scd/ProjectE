/**
 * Lightweight SVG bar chart — part of the shared chart set intentionally
 * implemented as plain SVG instead of pulling in the recharts dependency.
 */
export function BarChart({ data, xKey, yKey, yKey2, color = "#3b82f6", color2 = "#f97316", height = 120 }: { data: any[]; xKey: string; yKey: string; yKey2?: string; color?: string; color2?: string; height?: number }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No data</p>;
  const valOf = (d: any, key?: string) => (key ? ((d[key] as number) ?? 0) : 0);
  const maxVal = Math.max(...data.map((d) => Math.max(valOf(d, yKey), valOf(d, yKey2))), 1);
  const series = yKey2 ? 2 : 1;
  const barWidth = Math.max(20, Math.min(40, (300 / data.length) / series));
  const width = Math.max(data.length * (barWidth * series + 4) + 40, 200);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-label="Bar chart">
      {data.map((d, i) => {
        const barH = (valOf(d, yKey) / maxVal) * (height - 30);
        const x = i * (barWidth * series + 4) + 20;
        const y = height - 20 - barH;
        return <rect key={i} x={x} y={y} width={barWidth} height={barH} fill={color} rx="2" />;
      })}
      {yKey2 && data.map((d, i) => {
        const barH = (valOf(d, yKey2) / maxVal) * (height - 30);
        const x = i * (barWidth * series + 4) + 20 + barWidth;
        const y = height - 20 - barH;
        return <rect key={i} x={x} y={y} width={barWidth} height={barH} fill={color2} rx="2" />;
      })}
    </svg>
  );
}
