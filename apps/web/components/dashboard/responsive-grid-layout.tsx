'use client';

import ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// WidthProvider and Responsive are namespace exports from react-grid-layout.
// With @types/react-grid-layout's `export =` pattern, we access them via the module.
const WidthProvider = (
  ReactGridLayout as unknown as {
    WidthProvider: <P extends React.ComponentType<React.ComponentProps<P>>>(
      component: P
    ) => React.ComponentType<React.ComponentProps<P> & { measureBeforeMount?: boolean }>;
  }
).WidthProvider;

const Responsive = (
  ReactGridLayout as unknown as {
    Responsive: React.ComponentType<ReactGridLayout.ResponsiveProps>;
  }
).Responsive;

const ResponsiveGridLayout = WidthProvider(Responsive);

interface ResponsiveGridProps {
  layout: ReactGridLayout.Layout[];
  onLayoutChange: (newLayout: ReactGridLayout.Layout[]) => void;
  children: React.ReactNode;
}

export default function ResponsiveGrid({
  layout,
  onLayoutChange,
  children,
}: ResponsiveGridProps) {
  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={{ lg: layout }}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={80}
      onLayoutChange={onLayoutChange}
      draggableHandle=".widget-drag-handle"
      compactType="vertical"
      isResizable
    >
      {children}
    </ResponsiveGridLayout>
  );
}
