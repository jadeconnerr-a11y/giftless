"use client";

import * as React from "react";
import { Gift, SquarePen } from "lucide-react";

import { getCategoryAction, searchCategoriesAction } from "@/app/actions";
import { ChatTurnView } from "@/components/chat/chat-turn-view";
import { Composer, type ComposerHandle, type ComposerSubmitInput } from "@/components/chat/composer";
import { EmptyState } from "@/components/chat/empty-state";
import { ProductFiltersRoot } from "@/components/product-filters";
import { useChatStore } from "@/lib/chat-store";
import { extractBudgetFromQuery, toSearchFilters } from "@/lib/search";
import { streamConversationTurn } from "@/lib/stream-conversation-turn";

export default function Home() {
  const turns = useChatStore((state) => state.turns);
  const filters = useChatStore((state) => state.filters);
  const setFilters = useChatStore((state) => state.setFilters);
  const conversationId = useChatStore((state) => state.conversationId);
  const setConversationId = useChatStore((state) => state.setConversationId);
  const addTurn = useChatStore((state) => state.addTurn);
  const updateTurn = useChatStore((state) => state.updateTurn);
  const clear = useChatStore((state) => state.clear);

  const isSearching = turns.some((turn) => turn.status === "loading");
  const lastTurnRef = React.useRef<HTMLDivElement>(null);
  const composerRef = React.useRef<ComposerHandle>(null);
  const fillPrompt = (prompt: string) => composerRef.current?.fillText(prompt);

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

    // A stated budget in the chat text ("under $500") is only a soft signal
    // to Channel3's semantic search, not an enforced cutoff — results can
    // (and do) drift above it. Extract it into a real price filter so it's
    // actually honored. Only fills in when the user hasn't already set a
    // price filter explicitly via the Filters panel — that always wins.
    let effectiveFilters = filters;
    if (filters.price.minPrice == null && filters.price.maxPrice == null) {
      const budget = extractBudgetFromQuery(query);
      if (budget) {
        effectiveFilters = { ...filters, price: budget };
        setFilters(effectiveFilters);
      }
    }

    await streamConversationTurn(
      {
        query,
        imageDataUrl: image?.dataUrl,
        filters: toSearchFilters(effectiveFilters),
        conversationId,
      },
      {
        // Shows the agent's reply typing in live instead of a blank "Searching…"
        // for the whole (often tens-of-seconds) turn.
        onTextUpdate: (text) => updateTurn(id, { assistantText: text }),
        onResult: (result) => {
          setConversationId(result.conversationId);
          updateTurn(id, {
            status: "done",
            products: result.products,
            assistantText: result.text,
            suggestions: result.suggestions,
          });
        },
        onError: () => updateTurn(id, { status: "error" }),
      },
    );
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
                  isLast={index === turns.length - 1}
                  onSuggestionSelect={fillPrompt}
                  ref={index === turns.length - 1 ? lastTurnRef : undefined}
                />
              ))}
            </div>
          )}
        </main>

        {turns.length > 0 ? (
          <div className="shrink-0 border-t border-border/60 bg-background px-4 py-4 sm:px-6">
            <div className="mx-auto w-full max-w-3xl">
              <Composer ref={composerRef} onSubmit={handleSubmit} disabled={isSearching} />
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
