"use client";

import { useState, useEffect } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A persisted AnswerResultLink returned from the API. */
export interface ResultLink {
  id: string;
  answerId: string;
  resultId: string;
  points: number;
  result?: { title: string };
}

/** Lightweight result shape returned by GET /api/admin/quizzes/[id]/results. */
interface QuizResult {
  id: string;
  title: string;
  order: number;
}

interface ResultLinkPickerProps {
  quizId: string;
  answerId: string;
  existingLinks: ResultLink[];
  onAddLink: (link: ResultLink) => void;
  onRemoveLink: (linkId: string) => void;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Resolve a human-readable result title from either the link's inline result
 *  or the cached quiz results array. */
function resolveTitle(
  link: ResultLink,
  results: QuizResult[],
): string {
  if (link.result?.title) return link.result.title;
  const found = results.find((r) => r.id === link.resultId);
  return found?.title ?? link.resultId;
}

// ---------------------------------------------------------------------------
// ResultLinkPicker
// ---------------------------------------------------------------------------

export function ResultLinkPicker({
  quizId,
  answerId,
  existingLinks,
  onAddLink,
  onRemoveLink,
}: ResultLinkPickerProps) {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedResultId, setSelectedResultId] = useState("");
  const [points, setPoints] = useState(1);
  const [adding, setAdding] = useState(false);

  // ---- Fetch quiz results ----
  useEffect(() => {
    let cancelled = false;
    async function fetchResults() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/quizzes/${quizId}/results`);
        if (!res.ok) throw new Error("Failed to load results");
        const data = (await res.json()) as { results: QuizResult[] };
        if (!cancelled) setResults(data.results);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchResults();
    return () => { cancelled = true; };
  }, [quizId]);

  // Already-linked result IDs (to exclude from dropdown)
  const linkedIds = new Set(existingLinks.map((l) => l.resultId));

  // Filter dropdown to only show un-linked results
  const available = results.filter((r) => !linkedIds.has(r.id));

  // ---- Add handler ----
  async function handleAdd() {
    if (!selectedResultId) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/admin/answers/${answerId}/result-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: selectedResultId, points }),
      });
      if (!res.ok) throw new Error("Failed to create link");
      const data = (await res.json()) as { resultLink: ResultLink };
      onAddLink(data.resultLink);
      setSelectedResultId("");
      setPoints(1);
      setShowForm(false);
    } catch {
      // silently ignore — user can retry
    } finally {
      setAdding(false);
    }
  }

  // ---- Render ----
  return (
    <div className="space-y-2">
      {/* Existing links as chips */}
      {existingLinks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {existingLinks.map((link) => (
            <Badge
              key={link.id}
              variant="secondary"
              className="gap-1 pr-1 max-w-full"
            >
              <span className="truncate text-xs">
                → Adds {link.points} pt{link.points !== 1 ? "s" : ""} to{" "}
                {resolveTitle(link, results)}
              </span>
              <button
                type="button"
                className="ml-0.5 shrink-0 rounded-full p-0.5 hover:bg-muted-foreground/20"
                onClick={() => onRemoveLink(link.id)}
                aria-label={`Remove link to ${resolveTitle(link, results)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Toggle / Add button */}
      {!showForm ? (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowForm(true)}
          disabled={loading || available.length === 0}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Plus className="h-3 w-3 mr-1" />
          )}
          Add Result Link
        </Button>
      ) : (
        /* Inline form */
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3 bg-muted/30">
          {/* Result dropdown */}
          <div className="space-y-1 min-w-[160px] flex-1">
            <span className="text-xs font-medium text-muted-foreground block">
              Result
            </span>
            {error ? (
              <p className="text-xs text-destructive py-1">{error}</p>
            ) : (
              <select
                value={selectedResultId}
                onChange={(e) => setSelectedResultId(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={available.length === 0}
              >
                <option value="" disabled>
                  {available.length === 0
                    ? "All results linked"
                    : "Select a result..."}
                </option>
                {available.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Points input */}
          <div className="space-y-1 w-20 shrink-0">
            <span className="text-xs font-medium text-muted-foreground block">
              Points
            </span>
            <Input
              type="number"
              min={0}
              value={points}
              onChange={(e) =>
                setPoints(Math.max(0, Number(e.target.value)))
              }
              className="h-8 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-1 shrink-0">
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleAdd}
              disabled={!selectedResultId || adding}
            >
              {adding && (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              )}
              Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setShowForm(false);
                setSelectedResultId("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
