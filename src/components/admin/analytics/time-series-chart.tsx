"use client";

import { Calendar, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeSeriesEntry {
  date: string;
  views: number;
  completions: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesEntry[];
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const CHART_HEIGHT = 160;
const CHART_PADDING = 12;

function maxValue(data: TimeSeriesEntry[]): number {
  return data.reduce((max, d) => Math.max(max, d.views, d.completions), 0);
}

function barHeight(value: number, max: number): number {
  if (max === 0) return 0;
  return Math.max(2, (value / max) * (CHART_HEIGHT - CHART_PADDING * 2));
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyTimeSeries() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Daily Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <Calendar className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          No activity data for the selected period.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  if (data.length === 0) return <EmptyTimeSeries />;

  const max = maxValue(data);
  const barWidth = Math.max(8, Math.floor(100 / data.length));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Daily Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Chart area */}
        <div className="relative" style={{ height: CHART_HEIGHT }}>
          {/* Baseline */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-border" />

          {/* Bars */}
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-px" style={{ height: CHART_HEIGHT - CHART_PADDING }}>
            {data.map((d, i) => (
              <div
                key={d.date}
                className="flex flex-1 items-end justify-center gap-0.5"
                title={`${d.date}: ${d.views} views, ${d.completions} completions`}
              >
                {/* Views bar */}
                <div
                  className="w-2 rounded-t-sm bg-blue-500/70 transition-all hover:bg-blue-500"
                  style={{ height: barHeight(d.views, max) }}
                />
                {/* Completions bar */}
                <div
                  className="w-2 rounded-t-sm bg-emerald-500/70 transition-all hover:bg-emerald-500"
                  style={{ height: barHeight(d.completions, max) }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* X-axis labels (show ~7 evenly-spaced dates) */}
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          {data
            .filter((_, i, arr) => {
              if (arr.length <= 7) return true;
              const step = Math.ceil(arr.length / 7);
              return i % step === 0 || i === arr.length - 1;
            })
            .map((d) => (
              <span key={d.date} className="text-center leading-tight">
                {formatDateLabel(d.date)}
              </span>
            ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 pt-3 text-xs text-muted-foreground border-t mt-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-blue-500/70" />
            <span>Views</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500/70" />
            <span>Completions</span>
          </div>
          {data.length > 0 && (
            <span className="ml-auto">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              {data.length} day{data.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
