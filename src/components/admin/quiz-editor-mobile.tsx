"use client";

import { useState } from "react";
import { Eye, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuizEditorMobileProps {
  /** The quiz ID from the route params. */
  quizId: string;
  /** Additional CSS classes for the root element. */
  className?: string;
  /** Settings panel content (passed from layout). */
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuizEditorMobile({
  quizId: _quizId,
  className,
  children,
}: QuizEditorMobileProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "settings">("settings");

  return (
    <div className={cn("flex flex-col", className)}>
      {/* ---- Content area ---- */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "preview" && <MobilePreviewPanel />}
        {activeTab === "settings" && children}
      </div>

      {/* ---- Bottom tab bar ---- */}
      <nav
        className="shrink-0 border-t bg-background"
        aria-label="Editor panels"
      >
        <div className="flex">
          <TabButton
            active={activeTab === "preview"}
            icon={Eye}
            label="Preview"
            onClick={() => setActiveTab("preview")}
          />
          <TabButton
            active={activeTab === "settings"}
            icon={Settings}
            label="Settings"
            onClick={() => setActiveTab("settings")}
          />
        </div>
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

interface TabButtonProps {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}

function TabButton({ active, icon: Icon, label, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors",
        active
          ? "text-primary border-t-2 border-primary -mt-px"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function MobilePreviewPanel() {
  return (
    <div className="p-4">
      <div className="overflow-hidden rounded-3xl border-2 shadow-lg bg-background mx-auto max-w-sm">
        {/* Mock phone status bar */}
        <div className="bg-muted px-4 py-2 border-b flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          <span className="h-2 w-2 rounded-full bg-yellow-400" />
          <span className="h-2 w-2 rounded-full bg-green-400" />
          <span className="ml-2 text-[10px] text-muted-foreground font-medium">
            Preview
          </span>
        </div>
        {/* Preview content */}
        <div className="p-6 space-y-4 min-h-[300px] flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-muted p-4">
            <svg
              className="h-8 w-8 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Preview of your quiz will appear here as you build it
          </p>
        </div>
      </div>
    </div>
  );
}
