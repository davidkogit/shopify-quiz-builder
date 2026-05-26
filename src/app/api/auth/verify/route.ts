/**
 * GET /api/auth/verify — Check Authentication Status
 *
 * Simple endpoint that the admin UI can poll to determine whether the
 * current requestor has a valid Shopify session. Returns a JSON object
 * with a single `authenticated` boolean.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../lib/session";
import { env } from "../../../../../lib/env";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getSessionFromCookie(req.cookies, env.SESSION_SECRET);

  return NextResponse.json({ authenticated: session !== null });
}
