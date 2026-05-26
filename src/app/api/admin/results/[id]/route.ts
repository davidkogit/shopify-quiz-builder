/**
 * Result CRUD — Read, Update
 *
 * GET /api/admin/results/[id] — Get single result with related data.
 * PUT /api/admin/results/[id] — Update result fields.
 *
 * Every handler validates session → store → result ownership via the
 * result→quiz→store relationship chain.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../lib/session";
import { getStore } from "../../../../../../lib/store";
import { env } from "../../../../../../lib/env";
import { prisma } from "../../../../../../lib/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Validate the session cookie and resolve the authenticated store. */
async function resolveStore(
  req: NextRequest,
): Promise<
  | { ok: true; storeId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await getSessionFromCookie(req.cookies, env.SESSION_SECRET);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized — missing or invalid session" },
        { status: 401 },
      ),
    };
  }

  const store = await getStore(prisma, session.shopifyDomain);
  if (!store) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Store not found" }, { status: 404 }),
    };
  }

  return { ok: true, storeId: store.id };
}

/**
 * Validate session + store AND verify the result exists and belongs to
 * a quiz owned by the authenticated store.
 */
async function resolveResultOwnership(
  req: NextRequest,
  resultId: string,
): Promise<
  | { ok: true; storeId: string; resultId: string; quizId: string }
  | { ok: false; response: NextResponse }
> {
  const storeResult = await resolveStore(req);
  if (!storeResult.ok) return storeResult;

  const result = await prisma.result.findUnique({
    where: { id: resultId },
    select: {
      id: true,
      quizId: true,
      quiz: { select: { storeId: true, logicType: true } },
    },
  });

  if (!result) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Result not found" }, { status: 404 }),
    };
  }

  if (result.quiz.storeId !== storeResult.storeId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden — result belongs to a different store" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    storeId: storeResult.storeId,
    resultId: result.id,
    quizId: result.quizId,
  };
}

// ---------------------------------------------------------------------------
// GET — Single result
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const ownership = await resolveResultOwnership(req, id);
  if (!ownership.ok) return ownership.response;

  try {
    const result = await prisma.result.findUnique({
      where: { id: ownership.resultId },
    });
    if (!result) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch result" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT — Update result fields (partial)
// ---------------------------------------------------------------------------

/** Allowed top-level fields for result updates. */
const ALLOWED_UPDATE_FIELDS = [
  "title",
  "description",
  "image",
  "order",
  "outcomeType",
  "outcomeData",
  "pointsFrom",
  "pointsTo",
] as const;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const ownership = await resolveResultOwnership(req, id);
  if (!ownership.ok) return ownership.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Build update payload with only allowed fields present in the body
  const data: Record<string, unknown> = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (field in body) {
      data[field] = body[field];
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  // Validate points range if both are provided
  if (
    "pointsFrom" in data &&
    "pointsTo" in data &&
    data.pointsFrom !== null &&
    data.pointsTo !== null &&
    typeof data.pointsFrom === "number" &&
    typeof data.pointsTo === "number" &&
    (data.pointsFrom as number) > (data.pointsTo as number)
  ) {
    return NextResponse.json(
      { error: "pointsFrom must be less than or equal to pointsTo" },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.result.update({
      where: { id: ownership.resultId },
      data,
    });
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json(
      { error: "Failed to update result" },
      { status: 500 },
    );
  }
}
