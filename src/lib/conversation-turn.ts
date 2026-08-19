import "server-only";

import type { AssistantMessage, Product, SearchFilters } from "@channel3/sdk/resources";

import { filterToAllowedDisplayBrand } from "@/lib/allowed-brands";
import { hasPlausibleOffer, isWithinDisplayedPriceRange } from "@/lib/format";

/**
 * How many results to actually show per turn. Post-processing (dedup,
 * brand/price re-check) can only shrink the raw catalog-tool output, never
 * grow it, so this is a display cap rather than a request parameter — the
 * conversational agent has no `limit` to request up front the way
 * `products.search` does.
 */
const SEARCH_DISPLAY_LIMIT = 20;

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

/** A price constraint in the same shape `isWithinDisplayedPriceRange` expects. */
export interface PriceRange {
  minPrice?: number | null;
  maxPrice?: number | null;
}

/** Derive the belt-and-suspenders price re-check range from the turn's pinned filters, if any. */
export function priceRangeFromFilters(filters: SearchFilters): PriceRange | null {
  return filters.price
    ? { minPrice: filters.price.min_price, maxPrice: filters.price.max_price }
    : null;
}

/** Build the `UserMessage.parts` array for a query and/or image. */
export function buildUserMessageParts(
  query: string,
  imageDataUrl?: string,
): Array<{ type: "text"; text: string } | { type: "image"; url: string }> {
  const parts: Array<{ type: "text"; text: string } | { type: "image"; url: string }> = [];
  if (query.trim()) {
    parts.push({ type: "text", text: query.trim() });
  }
  if (imageDataUrl) {
    parts.push({ type: "image", url: imageDataUrl });
  }
  return parts;
}

/**
 * Shown instead of the agent's own text when its tool call(s) actually found
 * products but every one of them got filtered out (see
 * `buildConversationTurnResult`). The agent's original reply names and links
 * specific items by title — e.g. "I found the Toughknit Easy Tee..." — with
 * no way to know they're about to vanish from the display, so showing it
 * as-is next to an empty grid reads as broken. This is deliberately vague
 * about *why* (brand allowlist vs. price sanity check vs. price range) since
 * any of those can be the actual cause.
 */
const FILTERED_TO_EMPTY_TEXT =
  "I found a few options, but none of them are from brands or in a price range GIFTLESS currently carries. Try describing it a different way, or ask about a different brand and I'll take another look.";

/**
 * Turns a Channel3 `AssistantMessage` (from either the buffered `createTurn`
 * or the final `turn.completed` event of `createTurnStream`) into the shape
 * the UI consumes.
 *
 * Same "any offer/brand satisfies it" upstream semantics as `products.search`
 * (see `isWithinDisplayedPriceRange` / `filterToAllowedDisplayBrand`) apply to
 * whatever the agent's own catalog tool calls return, so the same
 * belt-and-suspenders re-check is needed here. The agent may also run more
 * than one catalog search per turn, and the same product can come back from
 * more than one of them, so results are deduped by id first. Also drops any
 * product whose every offer has an implausible price (see
 * `hasPlausibleOffer`) — Channel3's catalog occasionally has a garbled price
 * for a specific offer.
 *
 * Channel3's own docs say a turn's `filters` are "applied to every product
 * search in this turn," but in practice the agent's tool calls can still
 * return products from brands well outside a pinned `brand_ids` allowlist
 * (confirmed directly against the API — pinning `brand_ids` to an unrelated
 * brand didn't stop the agent's own `search_products` tool from returning 19
 * products from the brand the user actually asked about). So this filter is
 * doing real, necessary work, not just redundant paranoia — and when it
 * strips *everything* the agent found, the agent's own text still names
 * those now-invisible products (with dead `cp:` links), which reads as
 * broken. In that case the text is replaced with a clear explanation instead
 * (see `FILTERED_TO_EMPTY_TEXT`); the suggestions are left as-is since
 * they're still coherent follow-up prompts.
 */
export function buildConversationTurnResult(
  conversationId: string,
  message: AssistantMessage,
  priceRange: PriceRange | null,
): ConversationTurnResult {
  const textParts: string[] = [];
  const rawProducts: Product[] = [];
  const seenProductIds = new Set<string>();
  for (const part of message.parts ?? []) {
    if (part.type === "text") {
      textParts.push(part.text);
    } else if (part.type === "tool" && part.output?.products) {
      for (const product of part.output.products) {
        if (!seenProductIds.has(product.id)) {
          seenProductIds.add(product.id);
          rawProducts.push(product);
        }
      }
    }
  }

  const products = filterToAllowedDisplayBrand(rawProducts)
    .filter((product) => hasPlausibleOffer(product.offers))
    .filter((product) => !priceRange || isWithinDisplayedPriceRange(product.offers, priceRange))
    .slice(0, SEARCH_DISPLAY_LIMIT);

  const filteredEverythingOut = rawProducts.length > 0 && products.length === 0;
  const text = filteredEverythingOut
    ? FILTERED_TO_EMPTY_TEXT
    : textParts.length > 0
      ? textParts.join("\n\n")
      : null;

  return {
    conversationId,
    text,
    suggestions: message.suggestions ?? [],
    products,
  };
}
