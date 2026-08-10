/**
 * Lightweight SVG pie/donut chart — part of the shared chart set intentionally
 * implemented as plain SVG instead of pulling in the recharts dependency.
 */
export function PieChartSimple({ data, labelKey, valueKey, size = 120 }: { data: any[]; labelKey: string; valueKey: string; size?: number }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No data</p>;
  const total = data.reduce((s, d) => s + d[valueKey], 0) || 1;
  const colors = ["#3b82f6", "#22c55e", "#f97316", "#a855f7", "#e11d48", "#14b8a6"];
  let cumulative = 0;
  const slices = data.map((d, i) => {
    const pct = d[valueKey] / total;
    const startAngle = cumulative * 360;
    cumulative += pct;
    const endAngle = cumulative * 360;
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    const r = size / 2 - 4;
    const cx = size / 2;
    const cy = size / 2;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = pct > 0.5 ? 1 : 0;
    return { path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`, color: colors[i % colors.length], label: d[labelKey], pct: Math.round(pct * 100) };
  });
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
      </svg>
      <div className="space-y-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span>{s.label} ({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
