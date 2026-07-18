'use client';

import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface ResponsiveGridProps {
  layout: Layout;
  onLayoutChange: (newLayout: Layout) => void;
  children: React.ReactNode;
}

export default function ResponsiveGrid({
  layout,
  onLayoutChange,
  children,
}: ResponsiveGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();

  return (
    <div ref={containerRef}>
      {mounted && (
        <ResponsiveGridLayout
          className="layout"
          width={width}
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={80}
          onLayoutChange={(_layout, _layouts) => onLayoutChange(_layout)}
          dragConfig={{ handle: '.widget-drag-handle' }}
          compactor={verticalCompactor}
          resizeConfig={{ enabled: true }}
        >
          {children}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
