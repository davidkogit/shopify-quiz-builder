import { FileText, Inbox, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
}

interface DashboardStatsProps {
  quizCount: number;
  submissionCount: number;
  conversionRate?: string | number;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function StatCard({ title, value, description, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Dashboard stats grid
// ---------------------------------------------------------------------------

export function DashboardStats({
  quizCount,
  submissionCount,
  conversionRate = "—",
}: DashboardStatsProps) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Total Quizzes"
        value={quizCount}
        description="Quizzes created so far"
        icon={FileText}
      />
      <StatCard
        title="Total Submissions"
        value={submissionCount}
        description="Quiz completions recorded"
        icon={Inbox}
      />
      <StatCard
        title="Conversion Rate"
        value={conversionRate}
        description="Add-to-cart from results"
        icon={TrendingUp}
      />
    </div>
  );
}
