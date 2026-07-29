'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// react-grid-layout needs WidthProvider for responsive behavior
// Dynamic import to avoid SSR issues
const ReactGridLayout = dynamic(
  () => import('react-grid-layout').then((mod) => {
    // react-grid-layout v2 exports GridLayout as default
    // WidthProvider is a named export
    const GridLayout = (mod as any).default || mod;
    const WidthProvider = (mod as any).WidthProvider;
    if (WidthProvider) {
      return WidthProvider(GridLayout);
    }
    return GridLayout;
  }),
  { ssr: false }
);

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

interface ResponsiveGridProps {
  layout: LayoutItem[];
  onLayoutChange: (newLayout: LayoutItem[]) => void;
  children: React.ReactNode;
  isDraggable?: boolean;
  isResizable?: boolean;
  className?: string;
  compactType?: 'vertical' | 'horizontal' | null;
  preventCollision?: boolean;
  rowHeight?: number;
  cols?: number;
}

export default function ResponsiveGrid({
  layout,
  onLayoutChange,
  children,
  isDraggable = true,
  isResizable = true,
  className = '',
  compactType = 'vertical',
  preventCollision = false,
  rowHeight = 200,
  cols = 12,
}: ResponsiveGridProps) {
  // Build responsive layouts: same layout for all breakpoints
  const responsiveLayouts = useMemo(() => {
    // Desktop: 12 columns
    const lg = layout.map((item) => ({ ...item }));
    // Tablet: 8 columns — scale widths proportionally
    const md = layout.map((item) => ({
      ...item,
      w: Math.max(1, Math.min(8, Math.round(item.w * (8 / 12)))),
    }));
    // Mobile: 4 columns — stack widgets
    const sm = layout.map((item, idx) => ({
      ...item,
      x: 0,
      y: idx,
      w: 4,
      h: Math.max(2, item.h),
    }));
    return { lg, md, sm, xs: sm, xxs: sm };
  }, [layout]);

  const handleLayoutChange = (newLayout: LayoutItem[]) => {
    onLayoutChange(newLayout);
  };

  const GridComponent = ReactGridLayout as any;

  return (
    <div className={`w-full ${className}`}>
      <GridComponent
        layouts={responsiveLayouts}
        onLayoutChange={handleLayoutChange}
        isDraggable={isDraggable}
        isResizable={isResizable}
        compactType={compactType}
        preventCollision={preventCollision}
        rowHeight={rowHeight}
        cols={{ lg: 12, md: 8, sm: 4, xs: 4, xxs: 4 }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        draggableHandle=".widget-drag-handle"
        margin={[16, 16]}
        containerPadding={[0, 0]}
      >
        {children}
      </GridComponent>
    </div>
  );
}
