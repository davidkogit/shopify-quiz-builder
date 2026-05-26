"use client";

import { Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopItem {
  id: string;
  title: string;
  subtitle?: string;
  count: number;
}

interface TopItemsListProps {
  title: string;
  items: TopItem[];
  emptyMessage: string;
  /** Max number of items to display (default 10). */
  maxItems?: number;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function barWidth(count: number, max: number): string {
  if (max === 0) return "0%";
  return `${Math.round((count / max) * 100)}%`;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyList({ title, emptyMessage }: { title: string; emptyMessage: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <Award className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Top items list
// ---------------------------------------------------------------------------

export function TopItemsList({
  title,
  items,
  emptyMessage,
  maxItems = 10,
}: TopItemsListProps) {
  const displayItems = items.slice(0, maxItems);

  if (displayItems.length === 0) {
    return <EmptyList title={title} emptyMessage={emptyMessage} />;
  }

  const max = displayItems[0]?.count ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {displayItems.map((item, i) => (
            <li key={item.id} className="space-y-1">
              {/* Rank + title + count */}
              <div className="flex items-center gap-2.5 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.title}</p>
                  {item.subtitle && (
                    <p className="truncate text-xs text-muted-foreground">
                      {item.subtitle}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums">
                  {item.count.toLocaleString()}
                </span>
              </div>

              {/* Count bar */}
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all"
                  style={{ width: barWidth(item.count, max) }}
                />
              </div>
            </li>
          ))}
        </ul>

        {items.length > maxItems && (
          <p className="mt-3 text-xs text-muted-foreground">
            +{items.length - maxItems} more items
          </p>
        )}
      </CardContent>
    </Card>
  );
}
