"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDebounce } from "@/hooks/use-debounce";
import type { ShopifyProduct } from "@/lib/shopify";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductLink {
  id: string;           // AnswerProduct ID (for removal)
  shopifyProductId: string;
  title: string;
  image?: string;
  variantId?: string;
}

interface ProductPickerProps {
  selected: ProductLink[];
  onSelect: (product: ShopifyProduct, variantId?: string) => void;
  onRemove: (linkId: string) => void;
}

/** Convert Shopify GID like `gid://shopify/Product/123` to a short label. */
function gidLabel(gid: string): string {
  const parts = gid.split("/");
  const last = parts[parts.length - 1];
  return last ? `Product #${last}` : gid;
}

// ---------------------------------------------------------------------------
// ProductPicker
// ---------------------------------------------------------------------------

export function ProductPicker({
  selected,
  onSelect,
  onRemove,
}: ProductPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selecting, setSelecting] = useState<number | null>(null);

  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- Search effect ----
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    async function search() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/shopify/products?q=${encodeURIComponent(debouncedQuery)}&limit=10`,
        );
        if (!res.ok) throw new Error("Search failed");
        const data = (await res.json()) as { products: ShopifyProduct[] };
        if (!cancelled) {
          setResults(data.products);
          setIsOpen(true);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    search();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // ---- Close on blur or Escape ----
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }

  // ---- Selection handler ----
  async function handleSelect(product: ShopifyProduct) {
    setSelecting(product.id);
    try {
      await onSelect(product);
      setQuery("");
      setResults([]);
      setIsOpen(false);
    } finally {
      setSelecting(null);
    }
  }

  // Product already linked?
  const linkedIds = new Set(selected.map((p) => p.shopifyProductId));

  return (
    <div ref={containerRef} className="space-y-2" onKeyDown={handleKeyDown}>
      {/* Selected products as chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((link) => (
            <Badge key={link.id} variant="secondary" className="gap-1 pr-1">
              {link.image && (
                <img
                  src={link.image}
                  alt=""
                  className="h-4 w-4 rounded object-cover"
                />
              )}
              <span className="max-w-[140px] truncate">
                {link.title || gidLabel(link.shopifyProductId)}
              </span>
              <button
                type="button"
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                onClick={() => onRemove(link.id)}
                aria-label={`Remove ${link.title || link.shopifyProductId}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results.length > 0) setIsOpen(true); }}
            placeholder="Search products..."
            className="pl-8 h-8 text-sm"
          />
          {loading && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Results dropdown */}
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
            {error ? (
              <p className="p-3 text-xs text-destructive">{error}</p>
            ) : results.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">
                {debouncedQuery ? "No products found" : "Type to search"}
              </p>
            ) : (
              <ScrollArea className="max-h-64">
                {results.map((product) => {
                  const isLinked = linkedIds.has(
                    `gid://shopify/Product/${product.id}`,
                  );
                  const isThisSelecting = selecting === product.id;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={isLinked || isThisSelecting}
                      onClick={() => handleSelect(product)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                    >
                      {product.images[0] ? (
                        <img
                          src={product.images[0].src}
                          alt={product.images[0].alt ?? ""}
                          className="h-10 w-10 rounded border object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded border bg-muted shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{product.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[product.vendor, product.product_type]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {isLinked ? (
                          <span className="text-xs text-muted-foreground">Added</span>
                        ) : isThisSelecting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </ScrollArea>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
