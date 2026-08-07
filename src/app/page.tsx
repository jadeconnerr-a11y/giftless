"use client";

import * as React from "react";
import { Gift, SquarePen } from "lucide-react";

import { getCategoryAction, searchCategoriesAction, searchProducts } from "@/app/actions";
import { ChatTurnView } from "@/components/chat/chat-turn-view";
import { Composer, type ComposerSubmitInput } from "@/components/chat/composer";
import { EmptyState } from "@/components/chat/empty-state";
import { ProductFiltersRoot } from "@/components/product-filters";
import { useChatStore } from "@/lib/chat-store";
import { toSearchFilters } from "@/lib/search";

export default function Home() {
  const turns = useChatStore((state) => state.turns);
  const filters = useChatStore((state) => state.filters);
  const setFilters = useChatStore((state) => state.setFilters);
  const addTurn = useChatStore((state) => state.addTurn);
  const updateTurn = useChatStore((state) => state.updateTurn);
  const clear = useChatStore((state) => state.clear);

  const isSearching = turns.some((turn) => turn.status === "loading");
  const lastTurnRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    lastTurnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [turns.length, turns[turns.length - 1]?.status]);

  const handleSubmit = async ({ query, image }: ComposerSubmitInput) => {
    const id = crypto.randomUUID();
    addTurn({
      id,
      query,
      imagePreview: image?.dataUrl,
      imageLabel: image?.label,
      status: "loading",
      products: [],
    });
    try {
      const { products } = await searchProducts({
        query,
        base64Image: image?.base64,
        filters: toSearchFilters(filters),
      });
      updateTurn(id, { status: "done", products });
    } catch {
      updateTurn(id, { status: "error" });
    }
  };

  return (
    <ProductFiltersRoot
      value={filters}
      onChange={setFilters}
      searchCategories={searchCategoriesAction}
      getCategory={getCategoryAction}
    >
      <div className="flex h-screen flex-col bg-background">
        <header className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Back to home"
          >
            <Gift className="size-5 text-primary" />
            <span className="font-serif text-lg text-foreground italic">GIFTLESS</span>
          </button>
          {turns.length > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <SquarePen className="size-3.5" />
              New search
            </button>
          ) : null}
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {turns.length === 0 ? (
            <EmptyState onSubmit={handleSubmit} />
          ) : (
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-6 sm:px-6">
              {turns.map((turn, index) => (
                <ChatTurnView
                  key={turn.id}
                  turn={turn}
                  ref={index === turns.length - 1 ? lastTurnRef : undefined}
                />
              ))}
            </div>
          )}
        </main>

        {turns.length > 0 ? (
          <div className="shrink-0 border-t border-border/60 bg-background px-4 py-4 sm:px-6">
            <div className="mx-auto w-full max-w-3xl">
              <Composer onSubmit={handleSubmit} disabled={isSearching} />
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Buy links may earn GIFTLESS a commission at no extra cost to you.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </ProductFiltersRoot>
  );
}
