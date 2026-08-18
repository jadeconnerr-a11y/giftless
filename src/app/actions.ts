"use server";

import type { Category, CategorySummary, OptionValue, Product, SearchFilters } from "@channel3/sdk/resources";

import { channel3 } from "@/lib/channel3";
import { restrictToAllowedBrands } from "@/lib/allowed-brand-ids";
import { filterToAllowedDisplayBrand, isAllowedBrandName } from "@/lib/allowed-brands";
import { hasPlausibleOffer } from "@/lib/format";
import {
  buildConversationTurnResult,
  buildUserMessageParts,
  type ConversationTurnInput,
  type ConversationTurnResult,
  priceRangeFromFilters,
} from "@/lib/conversation-turn";

const SIMILAR_LIMIT = 12;

/**
 * Server Actions wrapping `@channel3/sdk` calls. `CHANNEL3_API_KEY` stays on
 * the server; these are passed down as fetcher props to the (purely
 * presentational) Channel3 UI hooks/components. Every function returns a
 * freshly-built plain object/array — never an SDK page instance — so the
 * value stays serializable across the server/client boundary.
 */

export type { ConversationTurnInput, ConversationTurnResult };

/**
 * Runs one turn of Channel3's conversational shopping agent — the
 * LLM-backed replacement for the old one-shot `products.search()` call. The
 * agent decides internally whether/how to search the catalog (and may run
 * more than one search per turn), so unlike `products.search` there's no
 * `limit` to request up front; `filters` are pinned across every catalog
 * search the agent performs this turn, keeping the brand allowlist and
 * gender/availability/price defaults in force no matter how the agent
 * phrases its own tool calls.
 *
 * This is the buffered (non-streaming) form — the app itself uses the
 * streaming `/api/conversation-turn` route (see `buildConversationTurnResult`)
 * for a live "typing" reply, but this is kept as a simpler alternative for
 * any other caller that just wants the final result in one shot.
 */
export async function runConversationTurn(
  input: ConversationTurnInput,
): Promise<ConversationTurnResult> {
  const parts = buildUserMessageParts(input.query, input.imageDataUrl);

  const turn = await channel3.conversations.createTurn({
    message: { role: "user", parts },
    conversation_id: input.conversationId ?? undefined,
    filters: await restrictToAllowedBrands(input.filters),
  });

  return buildConversationTurnResult(
    turn.conversation_id,
    turn.message,
    priceRangeFromFilters(input.filters),
  );
}

export async function findSimilarProducts(input: {
  productId: string;
  limit: number;
  filters?: SearchFilters;
}): Promise<Product[]> {
  const page = await channel3.products.findSimilar({
    product_id: input.productId,
    limit: input.limit || SIMILAR_LIMIT,
    filters: await restrictToAllowedBrands(input.filters ?? {}),
  });
  return filterToAllowedDisplayBrand(page.data).filter((product) =>
    hasPlausibleOffer(product.offers),
  );
}

export async function resolveVariant(input: {
  product: Product;
  optionName: string;
  value: OptionValue;
  selection: Record<string, string>;
}): Promise<Product> {
  // A color-as-product swap: this value belongs to a different product family
  // member entirely — navigate by fetching that product, not by re-resolving.
  // Reject the swap (keep the current product) if it lands outside the
  // curated brand list.
  if (input.value.product_id && input.value.product_id !== input.product.id) {
    const swapped = await channel3.products.retrieve({ product_id: input.value.product_id });
    return isAllowedBrandName(swapped.brands?.[0]?.name) ? swapped : input.product;
  }
  const resolved = await channel3.products.retrieve({
    product_id: input.product.id,
    selected_options: input.selection,
  });
  return isAllowedBrandName(resolved.brands?.[0]?.name) ? resolved : input.product;
}

export async function searchCategoriesAction(query: string): Promise<CategorySummary[]> {
  if (!query.trim()) {
    return [];
  }
  const { categories } = await channel3.categories.search({ query, limit: 8 });
  return categories;
}

export async function getCategoryAction(slug: string): Promise<Category> {
  return channel3.categories.retrieve({ slug });
}

/**
 * Full product detail for the PDP, with `option_<Name>` params re-resolving a
 * variant. Returns `null` (→ 404) for products outside the curated brand
 * list, or where every offer has an implausible price (see
 * `hasPlausibleOffer`) — Channel3's catalog occasionally has a garbled price
 * for a specific offer, and showing that as if genuine is worse than a 404.
 */
export async function getProductDetail(
  id: string,
  selectedOptions: Record<string, string> = {},
): Promise<Product | null> {
  try {
    const product = await channel3.products.retrieve({
      product_id: id,
      selected_options: selectedOptions,
    });
    if (!isAllowedBrandName(product.brands?.[0]?.name) || !hasPlausibleOffer(product.offers)) {
      return null;
    }
    return product;
  } catch {
    return null;
  }
}
