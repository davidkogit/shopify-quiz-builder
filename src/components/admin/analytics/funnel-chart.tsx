"use client";

import { TrendingDown, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FunnelStep {
  questionTitle: string;
  viewCount: number;
  dropOffCount: number;
  dropOffRate: number;
}

interface FunnelChartProps {
  steps: FunnelStep[];
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Maximum bar width as a percentage of the container. */
const MAX_BAR_PCT = 100;

/** Find the highest viewCount across all steps so bars scale consistently. */
function maxViews(steps: FunnelStep[]): number {
  return steps.reduce((max, s) => Math.max(max, s.viewCount), 0);
}

function barWidth(viewCount: number, max: number): string {
  if (max === 0) return "0%";
  return `${Math.round((viewCount / max) * MAX_BAR_PCT)}%`;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyFunnel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <TrendingDown className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          No funnel data available yet. Data will appear as users engage with the quiz.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Funnel chart
// ---------------------------------------------------------------------------

export function FunnelChart({ steps }: FunnelChartProps) {
  if (steps.length === 0) return <EmptyFunnel />;

  const max = maxViews(steps);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="space-y-1.5">
            {/* Label row */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <span className="truncate font-medium">{step.questionTitle}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{step.viewCount.toLocaleString()}</span>
              </div>
            </div>

            {/* Bar */}
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: barWidth(step.viewCount, max) }}
              />
            </div>

            {/* Drop-off indicator (hidden on first step) */}
            {i > 0 && (
              <p className="text-xs text-muted-foreground">
                {step.dropOffRate > 0
                  ? `${step.dropOffRate}% drop-off from previous step`
                  : "No drop-off"}
              </p>
            )}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground border-t">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-4 rounded-full bg-primary" />
            <span>Views</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
