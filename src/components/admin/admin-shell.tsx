"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/components/admin/sidebar";
import { Header } from "@/components/admin/header";

// ---------------------------------------------------------------------------
// Admin layout shell
//
// Renders the persistent chrome around every admin page:
//   - Fixed sidebar on desktop (hidden on mobile, toggled via Sheet)
//   - Sticky header with store name + avatar
//
// This is a Client Component so the mobile sidebar Sheet can manage
// open/close state.
// ---------------------------------------------------------------------------

interface AdminShellProps {
  shopDomain: string;
  children: React.ReactNode;
}

export function AdminShell({ shopDomain, children }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* ---- Desktop sidebar (hidden below md) ---- */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-background">
        <Sidebar />
      </aside>

      {/* ---- Mobile sidebar (Sheet drawer) ---- */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <Sidebar onNav={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* ---- Main content area ---- */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header
          shopDomain={shopDomain}
          onMenuClick={() => setMobileOpen(true)}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
