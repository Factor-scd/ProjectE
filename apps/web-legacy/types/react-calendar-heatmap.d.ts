declare module 'react-calendar-heatmap' {
  import { ComponentType } from 'react';

  interface HeatmapValue {
    date: Date | string;
    count: number;
  }

  interface ReactCalendarHeatmapProps {
    startDate: Date | string;
    endDate: Date | string;
    values: HeatmapValue[];
    classForValue?: (value: HeatmapValue | null) => string;
    tooltipDataAttrs?: (value: HeatmapValue | null) => Record<string, string | number> | null;
    showWeekdayLabels?: boolean;
    showMonthLabels?: boolean;
    showOutOfRangeDays?: boolean;
    numDays?: number;
    gutterSize?: number;
    horizontal?: boolean;
    transformDayElement?: (
      element: JSX.Element,
      value: HeatmapValue | null,
      index: number
    ) => JSX.Element;
    monthLabels?: string[] | Record<string, string>;
    weekdayLabels?: string[];
    onClick?: (value: HeatmapValue | null) => void;
    onMouseOver?: (value: HeatmapValue | null, event: React.MouseEvent) => void;
    onMouseLeave?: (value: HeatmapValue | null, event: React.MouseEvent) => void;
  }

  const CalendarHeatmap: ComponentType<ReactCalendarHeatmapProps>;
  export default CalendarHeatmap;
}
