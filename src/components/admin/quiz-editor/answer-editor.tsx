"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Loader2, GripVertical, Package, GitFork, Link2 } from "lucide-react";
import type { Answer } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ProductPicker, type ProductLink } from "./product-picker";
import { ResultLinkPicker, type ResultLink } from "./result-link-picker";
import type { ShopifyProduct } from "@/lib/shopify";

// ---------------------------------------------------------------------------
// Logic type → section visibility helpers (pure functions)
// ---------------------------------------------------------------------------

type LogicSection =
  | "basic"
  | "single"
  | "points"
  | "productWeight"
  | "resultWeight"
  | "combination";

function showProductPicker(lt: LogicSection): boolean {
  return lt === "single" || lt === "productWeight" || lt === "combination";
}

function showPointsField(lt: LogicSection): boolean {
  return lt === "points";
}

function showWeightFields(lt: LogicSection): boolean {
  return lt === "productWeight";
}

function showResultLinks(lt: LogicSection): boolean {
  return lt === "resultWeight";
}

/** Coerce a string into a known LogicSection, falling back to "basic". */
function toLogicSection(raw: string): LogicSection {
  const set = new Set<string>([
    "basic", "single", "points", "productWeight", "resultWeight", "combination",
  ]);
  return set.has(raw) ? (raw as LogicSection) : "basic";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ListState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "success"; answers: Answer[] };

interface QuestionSummary {
  id: string;
  title: string;
  order: number;
}

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyAnswers() {
  return (
    <Card className="border-dashed">
      <CardContent className="py-8 text-center">
        <p className="text-sm text-muted-foreground">No answers — add one below</p>
      </CardContent>
    </Card>
  );
}

/** Inline-delete confirmation for a single answer row. */
function DeleteConfirmBox({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Card className="border-destructive/50 ml-7">
      <CardContent className="flex items-center justify-between py-2 px-3">
        <p className="text-xs text-destructive">Delete this answer?</p>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AnswerRow — renders a single answer with inline edit + reorder + delete
// ---------------------------------------------------------------------------

function AnswerRow({
  answer,
  index,
  total,
  allQuestions,
  quizId,
  logicType,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  answer: Answer;
  index: number;
  total: number;
  allQuestions: QuestionSummary[];
  quizId: string;
  logicType: LogicSection;
  onUpdate: (id: string, data: { title?: string; points?: number; leadsToQuestionId?: string | null }) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(answer.title);
  const [points, setPoints] = useState(answer.points);
  const [leadsTo, setLeadsTo] = useState(answer.leadsToQuestionId ?? "");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [showJumps, setShowJumps] = useState(false);
  const [resultLinksOpen, setResultLinksOpen] = useState(false);
  const [products, setProducts] = useState<ProductLink[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [resultLinks, setResultLinks] = useState<ResultLink[]>([]);
  const [loadingResultLinks, setLoadingResultLinks] = useState(false);
  const tags = parseTags(answer.tags);

  const canShowProducts = showProductPicker(logicType);
  const canShowPoints = showPointsField(logicType);
  const canShowWeights = showWeightFields(logicType);
  const canShowResultLinks = showResultLinks(logicType);

  function commitTitle() {
    const trimmed = title.trim();
    if (trimmed && trimmed !== answer.title) onUpdate(answer.id, { title: trimmed });
    else setTitle(answer.title);
    setEditing(false);
  }

  function commitPoints() {
    if (points !== answer.points) onUpdate(answer.id, { points });
  }

  function commitLeadsTo(value: string) {
    const newValue = value === "" ? null : value;
    if (newValue !== (answer.leadsToQuestionId ?? null)) {
      onUpdate(answer.id, { leadsToQuestionId: newValue });
      setLeadsTo(value);
    }
  }

  // ---- Product linking ----
  async function toggleProducts() {
    if (showProducts) { setShowProducts(false); return; }
    setLoadingProducts(true);
    try {
      const res = await fetch(`/api/admin/answers/${answer.id}`);
      if (res.ok) {
        const data = (await res.json()) as {
          answer: { products: { id: string; shopifyProductId: string; shopifyVariantId: string | null }[] };
        };
        const links: ProductLink[] = (data.answer.products ?? []).map((p) => ({
          id: p.id,
          shopifyProductId: p.shopifyProductId,
          title: "",
          image: undefined,
          variantId: p.shopifyVariantId ?? undefined,
        }));
        setProducts(links);
      }
    } catch { /* keep existing products state */ }
    setLoadingProducts(false);
    setShowProducts(true);
  }

  async function handleLinkProduct(product: ShopifyProduct) {
    const res = await fetch(`/api/admin/answers/${answer.id}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopifyProductId: `gid://shopify/Product/${product.id}`,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { answerProduct: { id: string; shopifyProductId: string; shopifyVariantId: string | null } };
      setProducts((prev) => [
        ...prev,
        {
          id: data.answerProduct.id,
          shopifyProductId: data.answerProduct.shopifyProductId,
          title: product.title,
          image: product.images[0]?.src,
          variantId: data.answerProduct.shopifyVariantId ?? undefined,
        },
      ]);
    }
  }

  async function handleUnlinkProduct(linkId: string) {
    try {
      const res = await fetch(`/api/admin/answer-products/${linkId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== linkId));
      }
    } catch { /* silently ignore — user can retry */ }
  }

  // ---- Result weight linking ----
  async function toggleResultLinks() {
    if (resultLinksOpen) { setResultLinksOpen(false); return; }
    setLoadingResultLinks(true);
    try {
      const res = await fetch(`/api/admin/answers/${answer.id}`);
      if (res.ok) {
        const data = (await res.json()) as {
          answer: {
            resultLinks: {
              id: string;
              answerId: string;
              resultId: string;
              points: number;
              result: { title: string };
            }[];
          };
        };
        const links: ResultLink[] = (data.answer.resultLinks ?? []).map((rl) => ({
          id: rl.id,
          answerId: rl.answerId,
          resultId: rl.resultId,
          points: rl.points,
          result: rl.result ?? undefined,
        }));
        setResultLinks(links);
      }
    } catch { /* keep existing result links state */ }
    setLoadingResultLinks(false);
    setResultLinksOpen(true);
  }

  function handleAddResultLink(link: ResultLink) {
    setResultLinks((prev) => [...prev, link]);
  }

  async function handleRemoveResultLink(linkId: string) {
    try {
      const res = await fetch(`/api/admin/answer-result-links/${linkId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setResultLinks((prev) => prev.filter((l) => l.id !== linkId));
      }
    } catch { /* silently ignore — user can retry */ }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-md border bg-card p-3">
        {/* Grip handle (visual only — future drag support) */}
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

        <span className="text-xs text-muted-foreground w-5 tabular-nums">
          {index + 1}.
        </span>

        {answer.image && (
          <img
            src={answer.image}
            alt=""
            className="h-8 w-8 rounded object-cover shrink-0 border"
          />
        )}

        {/* Editable title */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setTitle(answer.title);
                  setEditing(false);
                }
              }}
              className="h-8 text-sm"
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="text-sm font-medium truncate block w-full text-left hover:text-primary transition-colors"
              onClick={() => setEditing(true)}
            >
              {answer.title}
            </button>
          )}
        </div>

        {/* Points — only visible for Points logic */}
        {canShowPoints && (
        <Input
          type="number"
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          onBlur={commitPoints}
          className="h-8 w-16 text-sm"
          aria-label="Points"
        />
        )}

        {/* Reorder buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={index === 0}
            onClick={() => onMoveUp(answer.id)}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={index === total - 1}
            onClick={() => onMoveDown(answer.id)}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Product link toggle — only visible for Single/ProductWeight/Combination */}
        {canShowProducts && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0"
          onClick={toggleProducts}
          disabled={loadingProducts}
          title="Link products"
        >
          {loadingProducts ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Package className="h-3.5 w-3.5" />
          )}
        </Button>
        )}

        {/* Result link toggle — only visible for ResultWeight logic */}
        {canShowResultLinks && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0"
          onClick={toggleResultLinks}
          disabled={loadingResultLinks}
          title="Link to result"
        >
          {loadingResultLinks ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
        </Button>
        )}

        {/* Logic jump toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0"
          onClick={() => setShowJumps((v) => !v)}
          title="Logic jump routing"
        >
          <GitFork className="h-3.5 w-3.5" />
        </Button>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => setShowConfirm(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 ml-11">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Product picker section — only for Single / ProductWeight / Combination */}
      {canShowProducts && showProducts && (
        <div className="ml-11 rounded-md border p-3 bg-muted/30">
          <p className="text-xs font-medium mb-2">
            {canShowWeights ? "Linked Products (with weight)" : "Linked Products"}
          </p>
          <ProductPicker
            selected={products}
            onSelect={handleLinkProduct}
            onRemove={handleUnlinkProduct}
          />
          {/* Weight fields per linked product — only for ProductWeight */}
          {canShowWeights && products.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Weights (higher = more likely to be recommended)
              </p>
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-xs truncate flex-1 min-w-0 text-muted-foreground">
                    {p.title || p.shopifyProductId}
                  </span>
                  <Input
                    type="number"
                    defaultValue={1}
                    min={0}
                    max={100}
                    className="h-7 w-16 text-xs"
                    aria-label={`Weight for ${p.title || p.shopifyProductId}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Result link section — only for ResultWeight logic */}
      {canShowResultLinks && resultLinksOpen && (
        <div className="ml-11 rounded-md border p-3 bg-muted/30">
          <p className="text-xs font-medium mb-2">
            Result Links — this answer contributes points to:
          </p>
          <ResultLinkPicker
            quizId={quizId}
            answerId={answer.id}
            existingLinks={resultLinks}
            onAddLink={handleAddResultLink}
            onRemoveLink={handleRemoveResultLink}
          />
        </div>
      )}

      {/* Logic jump section */}
      {showJumps && (
        <div className="ml-11 rounded-md border p-3 bg-muted/30">
          <p className="text-xs font-medium mb-2">Logic Jump — selecting this answer routes to:</p>
          <Select
            value={leadsTo}
            onChange={(e) => commitLeadsTo(e.target.value)}
            className="h-8 text-sm"
          >
            <option value="">None (next in order)</option>
            {allQuestions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title} (order #{q.order})
              </option>
            ))}
          </Select>
          {leadsTo && !allQuestions.some((q) => q.id === leadsTo) && (
            <p className="text-xs text-destructive mt-1">
              Warning: Selected question no longer exists.
            </p>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {showConfirm && (
        <DeleteConfirmBox
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => onDelete(answer.id)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component — AnswerEditor
// ---------------------------------------------------------------------------

export function AnswerEditor({ questionId, quizId, logicType = "basic" }: { questionId: string; quizId: string; logicType?: string }) {
  const [state, setState] = useState<ListState>({ phase: "loading" });
  const [adding, setAdding] = useState(false);
  const [allQuestions, setAllQuestions] = useState<QuestionSummary[]>([]);
  const lt = toLogicSection(logicType);

  const fetchAnswers = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const res = await fetch(`/api/admin/questions/${questionId}/answers`);
      if (!res.ok) throw new Error("Failed to load answers");
      const data = (await res.json()) as { answers: Answer[] };
      setState({ phase: "success", answers: data.answers });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [questionId]);

  useEffect(() => {
    fetchAnswers();
  }, [fetchAnswers]);

  useEffect(() => {
    fetch(`/api/admin/quizzes/${quizId}`)
      .then((r) => r.json())
      .then((data: { quiz: { questions: { id: string; title: string; order: number }[] } }) => {
        setAllQuestions(
          data.quiz.questions.map((q) => ({ id: q.id, title: q.title, order: q.order })),
        );
      })
      .catch(() => { /* silently ignore — dropdown will just be empty */ });
  }, [quizId]);

  async function handleAdd() {
    setAdding(true);
    try {
      const res = await fetch(`/api/admin/questions/${questionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Answer" }),
      });
      if (!res.ok) throw new Error("Failed to create answer");
      await fetchAnswers();
    } catch {
      // Silently handled — user can retry via the button
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdate(id: string, data: { title?: string; points?: number; leadsToQuestionId?: string | null }) {
    await fetch(`/api/admin/answers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/answers/${id}`, { method: "DELETE" });
    if (res.ok) await fetchAnswers();
  }

  /** Swap orders of two adjacent answers then refresh the list. */
  async function swapOrders(a: Answer, b: Answer) {
    await Promise.all([
      fetch(`/api/admin/answers/${a.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: b.order }),
      }),
      fetch(`/api/admin/answers/${b.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: a.order }),
      }),
    ]);
  }

  function handleMoveUp(id: string) {
    if (state.phase !== "success") return;
    const idx = state.answers.findIndex((a) => a.id === id);
    if (idx <= 0) return;
    swapOrders(state.answers[idx], state.answers[idx - 1]).then(fetchAnswers);
  }

  function handleMoveDown(id: string) {
    if (state.phase !== "success") return;
    const idx = state.answers.findIndex((a) => a.id === id);
    if (idx < 0 || idx >= state.answers.length - 1) return;
    swapOrders(state.answers[idx], state.answers[idx + 1]).then(fetchAnswers);
  }

  // ---- Loading ----
  if (state.phase === "loading") {
    return (
      <div className="space-y-3">
        <div className="h-4 w-16 rounded bg-muted animate-pulse" />
        <Card>
          <CardContent className="py-6 space-y-3">
            <div className="h-10 rounded bg-muted animate-pulse" />
            <div className="h-10 rounded bg-muted animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Error ----
  if (state.phase === "error") {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Answers</h3>
        <Card className="border-destructive">
          <CardContent className="py-4 text-center space-y-2">
            <p className="text-sm text-destructive">{state.message}</p>
            <Button variant="outline" size="sm" onClick={fetchAnswers}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Success ----
  const { answers } = state;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Answers</h3>
        <Button variant="outline" size="sm" onClick={handleAdd} disabled={adding}>
          {adding && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Answer
        </Button>
      </div>

      {answers.length === 0 ? (
        <EmptyAnswers />
      ) : (
        <div className="space-y-2">
          {answers.map((a, i) => (
            <AnswerRow
              key={a.id}
              answer={a}
              index={i}
              total={answers.length}
              allQuestions={allQuestions}
              quizId={quizId}
              logicType={lt}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          ))}
        </div>
      )}
    </div>
  );
}
