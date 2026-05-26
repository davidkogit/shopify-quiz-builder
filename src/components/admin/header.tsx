"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeaderProps {
  /** The shop domain (e.g. "my-store.myshopify.com") from the session. */
  shopDomain?: string;
  /** Called when the mobile sidebar toggle is clicked. */
  onMenuClick?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the store name from a `.myshopify.com` domain. */
function storeNameFromDomain(domain: string): string {
  return domain.replace(/\.myshopify\.com$/, "");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Header({ shopDomain, onMenuClick }: HeaderProps) {
  const storeName = shopDomain
    ? storeNameFromDomain(shopDomain)
    : "My Store";
  const initials = storeName.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4">
      {/* Mobile sidebar trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 md:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Spacer pushes the right section to the end */}
      <div className="flex-1" />

      {/* Store info + user avatar */}
      <div className="flex items-center gap-3">
        <div className="hidden flex-col items-end sm:flex">
          <span className="text-sm font-medium leading-none">
            {storeName}
          </span>
          <span className="text-xs text-muted-foreground">
            {shopDomain ?? "Loading…"}
          </span>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
