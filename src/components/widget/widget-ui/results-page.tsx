"use client";

import { useState, useCallback } from "react";
import { useAddToCart } from "../hooks/use-add-to-cart";
import "../widget.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResultConfig {
  title: string;
  description?: string | null;
  image?: string | null;
}

interface RecommendedProduct {
  id: string;
  title: string;
  imageUrl: string;
  price: string;
  variantId?: string;
}

interface ResultsPageProps {
  result: ResultConfig | null;
  products: RecommendedProduct[];
  totalQuestions: number;
  quizKey: string;
  sessionId: string;
  discountCode: string | null;
  discountLabel: string | null;
}

// ---------------------------------------------------------------------------
// Cart button — internal sub-component (avoids prop-drilling hook state)
// ---------------------------------------------------------------------------

function CartButton({
  product,
  isAdding,
  isAdded,
  hasError,
  onAdd,
}: {
  product: RecommendedProduct;
  isAdding: boolean;
  isAdded: boolean;
  hasError: boolean;
  onAdd: (variantId: string) => void;
}) {
  const variantId = product.variantId ?? product.id;

  // Derive button state
  let label: React.ReactNode = "Add to Cart";
  let className = "qk-btn-cart";
  const disabled = isAdding;

  if (isAdding) {
    label = (
      <>
        <span className="qk-spinner" />
        Adding…
      </>
    );
  } else if (isAdded) {
    className += " qk-added";
    label = "Added ✓";
  } else if (hasError) {
    className += " qk-btn-cart-error";
    label = "Error — try again";
  }

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => onAdd(variantId)}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// DiscountCodeBanner — pure display component
// ---------------------------------------------------------------------------

interface DiscountCodeBannerProps {
  discountCode: string;
  discountLabel?: string | null;
}

function DiscountCodeBanner({ discountCode, discountLabel }: DiscountCodeBannerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(discountCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [discountCode]);

  const displayText = discountLabel ?? `Use code ${discountCode} at checkout`;

  return (
    <div className="qk-discount-banner">
      <div className="qk-discount-banner-text">{displayText}</div>
      <div className="qk-discount-banner-code">
        <code className="qk-discount-code">{discountCode}</code>
        <button
          type="button"
          className="qk-discount-copy-btn"
          onClick={handleCopy}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultsPage — public component
// ---------------------------------------------------------------------------

export function ResultsPage({
  result,
  products,
  totalQuestions,
  quizKey,
  sessionId,
  discountCode,
  discountLabel,
}: ResultsPageProps) {
  const { addToCart, addingState, addedState, cartError } = useAddToCart({
    quizKey,
    sessionId,
  });

  const handleAdd = (variantId: string) => {
    void addToCart(variantId);
  };

  return (
    <div className="qk-page qk-results">
      <span className="qk-question-label">
        {totalQuestions} questions answered
      </span>
      {result ? (
        <>
          <h2 className="qk-result-title">{result.title}</h2>
          {result.description && (
            <p className="qk-result-desc">{result.description}</p>
          )}
        </>
      ) : (
        <h2 className="qk-result-title">Your Results</h2>
      )}

      {discountCode && (
        <DiscountCodeBanner
          discountCode={discountCode}
          discountLabel={discountLabel}
        />
      )}

      {products.length > 0 && (
        <div className="qk-product-grid">
          {products.map((p) => (
            <div key={p.id} className="qk-product-card">
              {p.imageUrl && (
                <img
                  src={p.imageUrl}
                  alt={p.title}
                  className="qk-product-image"
                />
              )}
              <div className="qk-product-body">
                <span className="qk-product-title">{p.title}</span>
                <span className="qk-product-price">${p.price}</span>
                <CartButton
                  product={p}
                  isAdding={addingState.get(p.variantId ?? p.id) ?? false}
                  isAdded={addedState.get(p.variantId ?? p.id) ?? false}
                  hasError={cartError !== null}
                  onAdd={handleAdd}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {products.length === 0 && (
        <p className="qk-intro-subtitle">No products matched your answers.</p>
      )}
    </div>
  );
}
