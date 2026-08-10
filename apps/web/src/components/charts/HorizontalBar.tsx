/**
 * Lightweight horizontal bar chart — part of the shared chart set intentionally
 * implemented as plain SVG/divs instead of pulling in the recharts dependency.
 */
export function HorizontalBar({ data, xKey, yKey, height = 100 }: { data: any[]; xKey: string; yKey: string; height?: number }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No data</p>;
  const maxVal = Math.max(...data.map((d) => d[yKey]), 1);
  return (
    <div className="space-y-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs w-20 truncate text-right">{d[xKey]}</span>
          <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: (d[yKey] / maxVal) * 100 + "%" }} />
          </div>
          <span className="text-xs w-8 text-right">{d[yKey]}</span>
        </div>
      ))}
    </div>
  );
}
