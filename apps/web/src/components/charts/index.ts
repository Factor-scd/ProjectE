/**
 * Shared lightweight SVG chart components.
 *
 * These are intentionally implemented as plain SVG/divs rather than pulling in
 * the recharts dependency — the visualizations needed here are simple enough
 * that a full charting library is overkill.
 */
export { LineChart } from "./LineChart";
export { BarChart } from "./BarChart";
export { HorizontalBar } from "./HorizontalBar";
export { PieChartSimple } from "./PieChartSimple";
export { CalendarHeatmap } from "./CalendarHeatmap";
