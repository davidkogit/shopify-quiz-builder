"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText, HelpCircle, PlusCircle, Trophy,
  Palette, Settings, Globe, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
interface PageDef { key: string; label: string; icon: React.ElementType;
  expandable?: boolean; resource?: "questions" | "results"; subPages?: string[]; }
const PAGES: PageDef[] = [
  { key: "intro", label: "Introduction", icon: FileText },
  { key: "questions", label: "Questions", icon: HelpCircle, expandable: true, resource: "questions" },
  { key: "additional", label: "Additional Pages", icon: PlusCircle, expandable: true, subPages: ["Transition", "Form Field", "Email Capture"] },
  { key: "results", label: "Results", icon: Trophy, expandable: true, resource: "results" },
  { key: "styles", label: "Styles", icon: Palette },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "publish", label: "Publish", icon: Globe },
];

export function QuizEditorSidebar({ quizId }: { quizId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<Record<string, { id: string; title: string }[]>>({});

  // Derive active tab from URL search params
  const currentQuestionId = searchParams.get("questionId");
  const currentResultId = searchParams.get("resultId");
  const currentTab = searchParams.get("tab");

  let activeTab = "intro";
  if (currentQuestionId) activeTab = "questions";
  else if (currentResultId) activeTab = "results";
  else if (currentTab) activeTab = currentTab;

  useEffect(() => {
    fetch(`/api/quizzes/${quizId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((q) => q && setItems({
        questions: (q.questions ?? []).map((x: { id: string; title: string }) => ({ id: x.id, title: x.title || "Untitled" })),
        results: (q.results ?? []).map((x: { id: string; title: string }) => ({ id: x.id, title: x.title || "Untitled" })),
      }))
      .catch(() => {});
  }, [quizId]);

  /** Navigate based on the page section and sub-item. */
  function handleNavigate(key: string, subItem?: { id: string }) {
    if (subItem) {
      const param = key === "questions" ? "questionId" : key === "results" ? "resultId" : null;
      if (param) {
        router.push(`/quiz/${quizId}?${param}=${subItem.id}`);
        return;
      }
    }
    // Non-resource pages: navigate to the tab
    router.push(`/quiz/${quizId}?tab=${key}`);
  }

  return (
    <nav className="flex flex-col gap-1" aria-label="Quiz editor pages">
      <h2 className="text-sm font-semibold px-2">Pages</h2>
      <Separator className="my-2" />
      {PAGES.map((p) => {
        const isActive = activeTab === p.key;
        const open = expanded[p.key] ?? false;
        const subs = p.resource ? (items[p.resource] ?? []) : [];
        const hasSubs = Boolean(subs.length || p.subPages?.length);
        return (
          <div key={p.key}>
            <Button
              variant={isActive ? "secondary" : "ghost"}
              className={cn("justify-start gap-3 h-9 w-full font-normal text-xs", isActive && "font-medium")}
              onClick={() => handleNavigate(p.key)}
            >
              <p.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left">{p.label}</span>
              {hasSubs && (
                <ChevronRight
                  className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-90")}
                  onClick={(e) => { e.stopPropagation(); setExpanded((pr) => ({ ...pr, [p.key]: !open })); }}
                  aria-label={open ? `Collapse ${p.label}` : `Expand ${p.label}`}
                />
              )}
            </Button>
            {open && hasSubs && (
              <div className="ml-7 mt-0.5 space-y-0.5">
                {p.resource
                  ? subs.map((s) => (
                      <Button
                        key={s.id}
                        variant="ghost"
                        size="sm"
                        className="justify-start h-7 w-full font-normal text-xs text-muted-foreground"
                        onClick={() => handleNavigate(p.key, s)}
                      >
                        {s.title}
                      </Button>
                    ))
                  : (p.subPages ?? []).map((label) => (
                      <Button
                        key={label}
                        variant="ghost"
                        size="sm"
                        className="justify-start h-7 w-full font-normal text-xs text-muted-foreground"
                        onClick={() => handleNavigate(p.key)}
                      >
                        {label}
                      </Button>
                    ))}
              </div>
            )}
            {open && p.resource && !subs.length && (
              <p className="ml-7 py-1 text-xs text-muted-foreground/60 italic">No {p.resource} yet</p>
            )}
          </div>
        );
      })}
    </nav>
  );
}
