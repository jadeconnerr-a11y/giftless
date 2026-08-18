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

  return {
    conversationId,
    text: textParts.length > 0 ? textParts.join("\n\n") : null,
    suggestions: message.suggestions ?? [],
    products,
  };
}
