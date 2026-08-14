"use server";

import type { Category, CategorySummary, OptionValue, Product, SearchFilters } from "@channel3/sdk/resources";

import { channel3 } from "@/lib/channel3";
import { restrictToAllowedBrands } from "@/lib/allowed-brand-ids";
import { filterToAllowedDisplayBrand, isAllowedBrandName } from "@/lib/allowed-brands";
import { isWithinDisplayedPriceRange } from "@/lib/format";

/**
 * How many results to actually show per search. Kept separate from
 * `SEARCH_FETCH_LIMIT` (the raw request to Channel3) because results still
 * go through `filterToAllowedDisplayBrand` afterward — fetching only
 * `SEARCH_DISPLAY_LIMIT` up front would mean that post-filter (and the
 * gender/availability/brand filters) is squeezing an already-small batch,
 * making "No products found" far more likely than it needs to be.
 *
 * `SEARCH_FETCH_LIMIT` is capped at 30 by the Channel3 API itself, so the
 * buffer over `SEARCH_DISPLAY_LIMIT` is thinner than it'd ideally be —
 * occasionally fewer than 20 survive the post-filter, but this is still the
 * best available margin.
 */
const SEARCH_DISPLAY_LIMIT = 20;
const SIMILAR_LIMIT = 12;

/**
 * Server Actions wrapping `@channel3/sdk` calls. `CHANNEL3_API_KEY` stays on
 * the server; these are passed down as fetcher props to the (purely
 * presentational) Channel3 UI hooks/components. Every function returns a
 * freshly-built plain object/array — never an SDK page instance — so the
 * value stays serializable across the server/client boundary.
 */

export interface ConversationTurnInput {
  query: string;
  /** A `data:` image URI straight from the composer's upload — Channel3 uploads and rewrites these server-side, so no separate base64 field is needed. */
  imageDataUrl?: string;
  filters: SearchFilters;
  /** Thread id from a previous turn in this chat; omit to start a new conversation. */
  conversationId?: string | null;
}

export interface ConversationTurnResult {
  conversationId: string;
  /** The assistant's combined text reply, or `null` when the turn was tool-results-only. */
  text: string | null;
  /** Tap-ready follow-up prompts the agent offered after this reply. */
  suggestions: string[];
  products: Product[];
}

/**
 * Runs one turn of Channel3's conversational shopping agent — the
 * LLM-backed replacement for the old one-shot `products.search()` call. The
 * agent decides internally whether/how to search the catalog (and may run
 * more than one search per turn), so unlike `products.search` there's no
 * `limit` to request up front; `filters` are pinned across every catalog
 * search the agent performs this turn, keeping the brand allowlist and
 * gender/availability/price defaults in force no matter how the agent
 * phrases its own tool calls.
 */
export async function runConversationTurn(
  input: ConversationTurnInput,
): Promise<ConversationTurnResult> {
  const parts: Array<{ type: "text"; text: string } | { type: "image"; url: string }> = [];
  if (input.query.trim()) {
    parts.push({ type: "text", text: input.query.trim() });
  }
  if (input.imageDataUrl) {
    parts.push({ type: "image", url: input.imageDataUrl });
  }

  const turn = await channel3.conversations.createTurn({
    message: { role: "user", parts },
    conversation_id: input.conversationId ?? undefined,
    filters: await restrictToAllowedBrands(input.filters),
  });

  // Same "any offer/brand satisfies it" upstream semantics as
  // `products.search` (see `isWithinDisplayedPriceRange` /
  // `filterToAllowedDisplayBrand`) apply to whatever the agent's own catalog
  // tool calls return, so the same belt-and-suspenders re-check is needed here.
  const priceRange = input.filters.price
    ? { minPrice: input.filters.price.min_price, maxPrice: input.filters.price.max_price }
    : null;

  const textParts: string[] = [];
  const rawProducts: Product[] = [];
  const seenProductIds = new Set<string>();
  for (const part of turn.message.parts ?? []) {
    if (part.type === "text") {
      textParts.push(part.text);
    } else if (part.type === "tool" && part.output?.products) {
      // The agent may run more than one catalog search per turn, and the
      // same product can come back from more than one of them — dedupe by id
      // so it isn't shown (and keyed) twice in the grid.
      for (const product of part.output.products) {
        if (!seenProductIds.has(product.id)) {
          seenProductIds.add(product.id);
          rawProducts.push(product);
        }
      }
    }
  }

  const products = filterToAllowedDisplayBrand(rawProducts)
    .filter((product) => !priceRange || isWithinDisplayedPriceRange(product.offers, priceRange))
    .slice(0, SEARCH_DISPLAY_LIMIT);

  return {
    conversationId: turn.conversation_id,
    text: textParts.length > 0 ? textParts.join("\n\n") : null,
    suggestions: turn.message.suggestions ?? [],
    products,
  };
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
  return filterToAllowedDisplayBrand(page.data);
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
 * list, so a stale or shared link can't surface one either.
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
    return isAllowedBrandName(product.brands?.[0]?.name) ? product : null;
  } catch {
    return null;
  }
}
