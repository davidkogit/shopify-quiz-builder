/**
 * GET /api/admin/shopify/products — Shopify Product Search Proxy
 *
 * Searches the merchant's Shopify store for products matching an optional
 * query string. Requires a valid, decrypted Shopify session cookie.
 *
 * Query parameters:
 * - `q`     — search term matched against product title (optional).
 * - `limit` — max results to return (default 50).
 *
 * Responses:
 * - 200 — { products: ShopifyProduct[] }
 * - 401 — Missing or invalid session cookie.
 * - 404 — No store record exists for the session domain.
 * - 500 — Shopify API error or unexpected failure.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  searchProducts,
  ShopifyApiError,
  type ShopifyProduct,
} from "../../../../../../lib/shopify";
import { resolveStore } from "../../../../../../lib/api-auth";

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ---------- Validate session + resolve store ----------
  const resolved = await resolveStore(req);
  if (resolved instanceof NextResponse) return resolved;
  const { session } = resolved;

  // ---------- Parse query parameters ----------
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") || undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  // ---------- Search Shopify products ----------
  try {
    const products: ShopifyProduct[] = await searchProducts(
      session,
      q,
      limit,
    );
    return NextResponse.json({ products });
  } catch (error) {
    if (error instanceof ShopifyApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: "Failed to search products" },
      { status: 500 },
    );
  }
}
