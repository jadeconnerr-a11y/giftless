import "server-only";

import { channel3 } from "@/lib/channel3";
import { isAllowedBrandName } from "@/lib/allowed-brands";
import type { SearchFilters } from "@channel3/sdk/resources";

/**
 * Resolves {@link ALLOWED_BRAND_NAMES} to Channel3 brand IDs by walking the
 * full brand catalog (capped at 5,000 by the API; ~50 paginated requests at
 * the API's max page size of 100, ~10-15s total) and matching names
 * case-insensitively. There's no server-side "filter by name" on `list`, so
 * a full scan is unavoidable.
 *
 * Cached at module scope for the life of the process/instance. On a
 * long-running server that means once ever; on a serverless platform
 * (Vercel) it means once per warm lambda instance — worth noting because an
 * earlier version of this file tried to dodge that first-request cost by
 * never blocking on it (falling back to an unrestricted search while it
 * warmed up in the background). That's wrong here: serverless platforms
 * suspend background work once a request's response is sent, so the
 * "warm up in the background" promise may never get to finish, leaving
 * every search on that instance permanently unrestricted — which then gets
 * silently stripped to near-zero by the display-brand post-filter, since
 * most of the general catalog isn't on the allowlist. A slow-once first
 * search is far better than a fast search that quietly returns nothing.
 */
const PAGE_LIMIT = 100;

let pendingIds: Promise<Set<string>> | null = null;

function startResolving(): Promise<Set<string>> {
  if (!pendingIds) {
    pendingIds = resolveAllowedBrandIds().catch((error: unknown) => {
      // Don't cache a failed lookup — let the next call retry.
      pendingIds = null;
      throw error;
    });
  }
  return pendingIds;
}

async function resolveAllowedBrandIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  // `list()` resolves to a `Page` (itself the async-iterable) rather than
  // being directly `for await`-able as a promise.
  const page = await channel3.brands.list({ limit: PAGE_LIMIT });
  for await (const brand of page) {
    if (isAllowedBrandName(brand.name)) {
      ids.add(brand.id);
    }
  }
  return ids;
}

/** Waits for (and returns) the resolved allowlist. */
export function getAllowedBrandIds(): Promise<Set<string>> {
  return startResolving();
}

/**
 * Narrows `filters.brand_ids` to the allowlist, defaulting to the full
 * allowlist when the caller didn't request specific brands. Falls back to
 * the caller's filters unchanged only if the catalog walk itself fails
 * (e.g. a transient Channel3 API error) — a lookup hiccup shouldn't take
 * search down entirely.
 */
export async function restrictToAllowedBrands(filters: SearchFilters): Promise<SearchFilters> {
  let allowed: Set<string>;
  try {
    allowed = await getAllowedBrandIds();
  } catch {
    return filters;
  }
  const brandIds = filters.brand_ids?.length
    ? filters.brand_ids.filter((id) => allowed.has(id))
    : Array.from(allowed);
  return { ...filters, brand_ids: brandIds };
}
