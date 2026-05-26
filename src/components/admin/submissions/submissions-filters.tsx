"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuizOption {
  id: string;
  name: string;
}

interface SubmissionsFiltersProps {
  /** Available quizzes for the dropdown (fetched server-side). */
  quizzes: QuizOption[];
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

/**
 * Renders a text-input filter that syncs with a URL search param.
 */
function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current = searchParams.get("search") ?? "";

  const update = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("search", value);
      } else {
        params.delete("search");
      }
      params.set("page", "1"); // Reset to first page on filter change
      startTransition(() => {
        router.replace(`/submissions?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition],
  );

  return (
    <div className="relative flex-1 min-w-[200px]">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search email, name, or session…"
        defaultValue={current}
        className="pl-9 pr-8"
        onChange={(e) => {
          // Debounce via native cancellation — update on Enter or blur
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            update((e.target as HTMLInputElement).value);
          }
        }}
        onBlur={(e) => {
          const value = e.target.value;
          if (value !== current) {
            update(value);
          }
        }}
      />
      {current && (
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => update("")}
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Renders a quiz dropdown filter that syncs with the `quizId` URL param.
 */
function QuizSelect({ quizzes }: { quizzes: QuizOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current = searchParams.get("quizId") ?? "";

  const update = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("quizId", value);
      } else {
        params.delete("quizId");
      }
      params.set("page", "1");
      startTransition(() => {
        router.replace(`/submissions?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition],
  );

  return (
    <Select
      value={current}
      onChange={(e) => update(e.target.value)}
      className="w-full sm:w-48"
    >
      <option value="">All Quizzes</option>
      {quizzes.map((q) => (
        <option key={q.id} value={q.id}>
          {q.name}
        </option>
      ))}
    </Select>
  );
}

/**
 * Renders date range inputs that sync with `from` and `to` URL params.
 */
function DateRangeInputs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const fromVal = searchParams.get("from") ?? "";
  const toVal = searchParams.get("to") ?? "";

  const update = useCallback(
    (key: "from" | "to", value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.set("page", "1");
      startTransition(() => {
        router.replace(`/submissions?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition],
  );

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={fromVal}
        onChange={(e) => update("from", e.target.value)}
        className="w-full sm:w-auto"
        aria-label="From date"
      />
      <span className="text-xs text-muted-foreground shrink-0">to</span>
      <Input
        type="date"
        value={toVal}
        onChange={(e) => update("to", e.target.value)}
        className="w-full sm:w-auto"
        aria-label="To date"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Size Selector
// ---------------------------------------------------------------------------

function LimitSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current = searchParams.get("limit") ?? "25";

  const update = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "25") {
        params.set("limit", value);
      } else {
        params.delete("limit");
      }
      params.set("page", "1");
      startTransition(() => {
        router.replace(`/submissions?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition],
  );

  return (
    <Select
      value={current}
      onChange={(e) => update(e.target.value)}
      className="w-20 shrink-0"
      aria-label="Page size"
    >
      <option value="10">10</option>
      <option value="25">25</option>
      <option value="50">50</option>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Main Filters Component
// ---------------------------------------------------------------------------

export function SubmissionsFilters({ quizzes }: SubmissionsFiltersProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const hasFilters =
    searchParams.get("search") ||
    searchParams.get("quizId") ||
    searchParams.get("from") ||
    searchParams.get("to");

  const clearAll = useCallback(() => {
    router.replace("/submissions");
  }, [router]);

  return (
    <div className="flex flex-col gap-3">
      {/* Filters row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput />
        <QuizSelect quizzes={quizzes} />
        <DateRangeInputs />
        <LimitSelect />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="shrink-0"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
