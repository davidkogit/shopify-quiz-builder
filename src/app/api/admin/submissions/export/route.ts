/**
 * Submissions Export API — Export submissions as .xlsx spreadsheet.
 *
 * GET /api/admin/submissions/export
 *   Query params: quizId?, search?, from?, to?
 *   Returns: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *
 * Every handler validates the Shopify session cookie and resolves the
 * corresponding Store record before any data operation. Filters mirror
 * the submissions list API for consistency.
 */

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "../../../../../../lib/prisma";
import { resolveStore } from "../../../../../../lib/api-auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a date-string query param into a Date or undefined.
 */
function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Parse the answers JSON column into a human-readable summary string.
 *
 * answers shape: [{ questionTitle, answerTitles[] }, ...]
 * output format: "Question 1: Answer A, Answer B | Question 2: Answer C"
 */
function formatAnswers(raw: string): string {
  if (!raw) return "";
  type AnswerEntry = { questionTitle?: string; answerTitles?: string[] };
  try {
    const entries: AnswerEntry[] = JSON.parse(raw) as AnswerEntry[];
    if (!Array.isArray(entries)) return "";
    return entries
      .map((a) => {
        const question = a.questionTitle || "Question";
        const titles = Array.isArray(a.answerTitles)
          ? a.answerTitles.join(", ")
          : "";
        return `${question}: ${titles}`;
      })
      .join(" | ");
  } catch {
    return raw; // fallback: return the raw string if parsing fails
  }
}

/**
 * Parse the recommendedProducts JSON column into comma-separated product titles.
 *
 * products shape: [{ title }, ...]
 */
function formatProducts(raw: string): string {
  if (!raw) return "";
  type ProductEntry = { title?: string };
  try {
    const products: ProductEntry[] = JSON.parse(raw) as ProductEntry[];
    if (!Array.isArray(products)) return "";
    return products
      .map((p) => p.title || "")
      .filter(Boolean)
      .join(", ");
  } catch {
    return raw;
  }
}

/**
 * Format a Date for display in the spreadsheet (YYYY-MM-DD HH:MM:SS).
 */
function formatDate(date: Date): string {
  const iso = date.toISOString();
  return iso.replace("T", " ").substring(0, 19);
}

// ---------------------------------------------------------------------------
// GET — Export submissions as .xlsx
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const resolved = await resolveStore(req);
  if (resolved instanceof NextResponse) return resolved;

  const { searchParams } = req.nextUrl;

  const quizId = searchParams.get("quizId") || undefined;
  const search = searchParams.get("search") || undefined;
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));

  try {
    // Build the same filter clause as the submissions list API
    const where: Record<string, unknown> = { storeId: resolved.storeId };

    if (quizId) {
      where.quizId = quizId;
    }

    if (search) {
      const searchFilter = { contains: search };
      where.OR = [
        { email: searchFilter },
        { name: searchFilter },
        { sessionId: searchFilter },
      ];
    }

    if (from || to) {
      const createdAtFilter: Record<string, Date> = {};
      if (from) createdAtFilter.gte = from;
      if (to) createdAtFilter.lte = to;
      where.createdAt = createdAtFilter;
    }

    // Fetch all matching submissions (no pagination — export gets everything)
    const submissions = await prisma.submission.findMany({
      where,
        include: {
          quiz: { select: { name: true } },
        },
      orderBy: { createdAt: "desc" },
    });

    // Build worksheet rows
    const headers = [
      "Date",
      "Quiz",
      "Email",
      "Name",
      "Phone",
      "Session ID",
      "Result Title",
      "Recommended Products",
      "IP Address",
      "Answers",
    ];

    const rows: string[][] = submissions.map((s) => [
      formatDate(s.createdAt),
      s.quiz.name,
      s.email || "",
      s.name || "",
      s.phone || "",
      s.sessionId,
      "",
      formatProducts(s.recommendedProducts),
      s.ipAddress || "",
      formatAnswers(s.answers),
    ]);

    // Build workbook — empty submissions produce headers-only sheet
    const worksheet = XLSX.utils.aoa_to_sheet(
      submissions.length > 0 ? [headers, ...rows] : [headers],
    );

    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 25 },
      { wch: 30 },
      { wch: 20 },
      { wch: 15 },
      { wch: 20 },
      { wch: 25 },
      { wch: 40 },
      { wch: 15 },
      { wch: 60 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Submissions");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Generate filename with current date
    const dateStr = new Date().toISOString().substring(0, 10);
    const filename = `submissions-export-${dateStr}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to export submissions" },
      { status: 500 },
    );
  }
}
