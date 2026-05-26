"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Client component for navigating back to the submissions list.
 *
 * Uses `router.back()` to preserve any filter/search params the user had
 * on the list page. Falls back to `/submissions` when there is no history
 * (e.g. direct navigation to the detail page).
 */
export function BackButton() {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.back()}
      className="gap-2 -ml-2"
      aria-label="Back to submissions"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to submissions
    </Button>
  );
}
