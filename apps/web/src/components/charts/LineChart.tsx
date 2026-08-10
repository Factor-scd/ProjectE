/**
 * Lightweight SVG line chart — part of the shared chart set intentionally
 * implemented as plain SVG instead of pulling in the recharts dependency.
 */
export function LineChart({ data, xKey, yKey, color = "#3b82f6", height = 120 }: { data: any[]; xKey: string; yKey: string; color?: string; height?: number }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No data</p>;
  const maxVal = Math.max(...data.map((d) => d[yKey]), 1);
  const width = Math.max(data.length * 30, 200);
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * (width - 40) + 20;
    const y = height - 20 - ((d[yKey] / maxVal) * (height - 40));
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-label="Line chart">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
      {data.map((d, i) => {
        const x = (i / (data.length - 1 || 1)) * (width - 40) + 20;
        const y = height - 20 - ((d[yKey] / maxVal) * (height - 40));
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
      })}
    </svg>
  );
}
