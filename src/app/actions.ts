"use server";

import type { Category, CategorySummary, ProductDetail, SearchFilters } from "@channel3/sdk/resources";

import { channel3 } from "@/lib/channel3";
import { restrictToAllowedBrands } from "@/lib/allowed-brand-ids";
import { filterToAllowedDisplayBrand, isAllowedBrandName } from "@/lib/allowed-brands";

type OptionValue = ProductDetail.Variants.Option.Value;

const SEARCH_LIMIT = 24;
const SIMILAR_LIMIT = 12;

/**
 * Server Actions wrapping `@channel3/sdk` calls. `CHANNEL3_API_KEY` stays on
 * the server; these are passed down as fetcher props to the (purely
 * presentational) Channel3 UI hooks/components. Every function returns a
 * freshly-built plain object/array — never an SDK page instance — so the
 * value stays serializable across the server/client boundary.
 */

export async function searchProducts(input: {
  query: string;
  imageUrl?: string;
  base64Image?: string;
  filters: SearchFilters;
  pageToken?: string;
}): Promise<{ products: ProductDetail[]; nextPageToken?: string | null }> {
  const page = await channel3.products.search({
    query: input.query || undefined,
    image_url: input.imageUrl,
    base64_image: input.base64Image,
    filters: await restrictToAllowedBrands(input.filters),
    page_token: input.pageToken,
    limit: SEARCH_LIMIT,
  });
  return { products: filterToAllowedDisplayBrand(page.products), nextPageToken: page.next_page_token };
}

export async function findSimilarProducts(input: {
  productId: string;
  limit: number;
  filters?: SearchFilters;
}): Promise<ProductDetail[]> {
  const page = await channel3.products.findSimilar({
    product_id: input.productId,
    limit: input.limit || SIMILAR_LIMIT,
    filters: await restrictToAllowedBrands(input.filters ?? {}),
  });
  return filterToAllowedDisplayBrand(page.products);
}

export async function resolveVariant(input: {
  product: ProductDetail;
  optionName: string;
  value: OptionValue;
  selection: Record<string, string>;
}): Promise<ProductDetail> {
  // A color-as-product swap: this value belongs to a different product family
  // member entirely — navigate by fetching that product, not by re-resolving.
  // Reject the swap (keep the current product) if it lands outside the
  // curated brand list.
  if (input.value.product_id && input.value.product_id !== input.product.id) {
    const swapped = await channel3.products.retrieve(input.value.product_id);
    return isAllowedBrandName(swapped.brands?.[0]?.name) ? swapped : input.product;
  }
  const query: Record<string, string> = {};
  for (const [name, label] of Object.entries(input.selection)) {
    query[`option_${name}`] = label;
  }
  const resolved = await channel3.products.retrieve(input.product.id, undefined, { query });
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
  return channel3.categories.retrieve(slug);
}

/**
 * Full product detail for the PDP, with `option_<Name>` params re-resolving a
 * variant. Returns `null` (→ 404) for products outside the curated brand
 * list, so a stale or shared link can't surface one either.
 */
export async function getProductDetail(
  id: string,
  optionParams: Record<string, string> = {},
): Promise<ProductDetail | null> {
  try {
    const product = await channel3.products.retrieve(id, undefined, { query: optionParams });
    return isAllowedBrandName(product.brands?.[0]?.name) ? product : null;
  } catch {
    return null;
  }
}
