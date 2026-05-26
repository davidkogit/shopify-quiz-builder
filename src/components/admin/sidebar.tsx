"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Inbox,
  Puzzle,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Navigation definition (pure data)
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/quizzes", label: "My Quizzes", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/submissions", label: "Submissions", icon: Inbox },
  { href: "/integrations", label: "Integrations", icon: Puzzle },
  { href: "/settings", label: "Settings", icon: Settings },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SidebarProps {
  /** Called when a nav link is clicked (mobile: close sheet). */
  onNav?: () => void;
  className?: string;
}

export function Sidebar({ onNav, className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn("flex flex-col gap-1 p-4", className)}
      aria-label="Admin navigation"
    >
      {/* App brand */}
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
          Q
        </div>
        <span className="text-lg font-semibold tracking-tight">Quiz Kit</span>
      </div>

      {/* Navigation links */}
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href));

        return (
          <Button
            key={item.href}
            variant={isActive ? "secondary" : "ghost"}
            className={cn(
              "justify-start gap-3 h-10 w-full font-normal",
              isActive && "font-medium",
            )}
            asChild
            onClick={onNav}
          >
            <Link href={item.href}>
              <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
