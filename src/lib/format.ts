import type {
  OfferAvailabilityStatus,
  Price,
  ProductImage,
  ProductOffer,
} from "@channel3/sdk/resources";

/**
 * Format a numeric amount as a localized currency string. Falls back to a
 * plain `CODE 12.34` string when the runtime doesn't recognize the currency.
 */
export function formatCurrency(amount: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Format a Channel3 `Price` using its embedded currency code. */
export function formatPrice(price: Price, locale?: string): string {
  return formatCurrency(price.price, price.currency, locale);
}

/** True when the price carries a higher pre-discount `compare_at_price`. */
export function isOnSale(price: Price): boolean {
  return typeof price.compare_at_price === "number" && price.compare_at_price > price.price;
}

/**
 * Whole-number discount percentage derived from `compare_at_price`, or `null`
 * when the item isn't discounted.
 */
export function discountPercent(price: Price): number | null {
  if (!isOnSale(price) || !price.compare_at_price) {
    return null;
  }
  return Math.round(((price.compare_at_price - price.price) / price.compare_at_price) * 100);
}

/** Strip protocol and a leading `www.` from a retailer domain for display. */
export function formatDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

/**
 * The single in-stock definition used across the kit. The public API only
 * ever emits `InStock`/`OutOfStock` (internal statuses like pre-order or
 * back-order are collapsed to one of these two before reaching us), so this
 * is now a direct equality check rather than a set membership one.
 */
export function isInStock(status: OfferAvailabilityStatus): boolean {
  return status === "InStock";
}

const AVAILABILITY_LABELS: Record<OfferAvailabilityStatus, string> = {
  InStock: "In stock",
  OutOfStock: "Out of stock",
};

/** Human-readable label for an availability status. */
export function availabilityLabel(status: OfferAvailabilityStatus): string {
  return AVAILABILITY_LABELS[status];
}

/**
 * Pick the best image to show for a product.
 *
 * `preferCleaned` favors an image's `cleaned_url` (background-removed square
 * shot, when the CDN has one) for grid/card contexts; otherwise the main
 * image (or first image) wins. When a cleaned shot is used, the returned
 * image's `url` is swapped to that `cleaned_url` so callers can keep reading
 * a plain `.url`.
 */
export function pickImage(
  images: ReadonlyArray<ProductImage> | undefined,
  { preferCleaned = false }: { preferCleaned?: boolean } = {},
): ProductImage | undefined {
  if (!images || images.length === 0) {
    return undefined;
  }
  if (preferCleaned) {
    const cleaned = images.find((image) => image.cleaned_url);
    if (cleaned?.cleaned_url) {
      return { ...cleaned, url: cleaned.cleaned_url };
    }
  }
  return images.find((image) => image.is_main_image) ?? images[0];
}

/**
 * Hover/secondary image priority: a contextual shot (product worn or in use)
 * makes a far more compelling crossfade than another clean studio angle. Shot
 * types are tried in this order, then any remaining image, with reference shots
 * (size charts, packaging, etc.) excluded entirely.
 */
const HOVER_SHOT_PRIORITY: ReadonlyArray<NonNullable<ProductImage["shot_type"]>> = [
  "on_model",
  "lifestyle",
  "in_use",
  "flat_lay",
  "angle_view",
];

const HOVER_SHOT_EXCLUDE: ReadonlySet<NonNullable<ProductImage["shot_type"]>> = new Set([
  "size_chart",
  "packaging",
  "product_information",
  "merchant_information",
  "scale_reference",
]);

/**
 * Pick the best image to crossfade to on hover, preferring contextual shots
 * (see {@link HOVER_SHOT_PRIORITY}). Returns `undefined` when there's no
 * suitable second image.
 */
export function pickHoverImage(
  images: ReadonlyArray<ProductImage> | undefined,
  { excludeUrl }: { excludeUrl?: string } = {},
): ProductImage | undefined {
  if (!images || images.length === 0) {
    return undefined;
  }
  const candidates = images.filter(
    (image) =>
      image.url !== excludeUrl &&
      !(image.shot_type != null && HOVER_SHOT_EXCLUDE.has(image.shot_type)),
  );
  if (candidates.length === 0) {
    return undefined;
  }
  for (const shot of HOVER_SHOT_PRIORITY) {
    const match = candidates.find((image) => image.shot_type === shot);
    if (match) {
      return match;
    }
  }
  return candidates[0];
}

/**
 * Ceiling above which a price is treated as corrupted upstream catalog data
 * rather than a genuine (if expensive) gift. Channel3's catalog occasionally
 * surfaces a garbled price for one specific merchant offer — e.g. a real
 * ~$490 handbag listed as $463,200 — while sibling offers for the same
 * product (or the same listing from a different merchant) show a normal
 * price. $50,000 sits well above anything this app expects to recommend,
 * including genuine luxury goods, so it only catches the outliers.
 */
const MAX_PLAUSIBLE_PRICE = 50_000;

/** Whether a price looks like real catalog data rather than corrupted upstream data (see {@link MAX_PLAUSIBLE_PRICE}). */
export function isPlausiblePrice(price: Price): boolean {
  return price.price > 0 && price.price <= MAX_PLAUSIBLE_PRICE;
}

/**
 * Whether any offer for a product has a plausible price. Products where
 * *every* offer looks corrupted are excluded outright elsewhere rather than
 * displaying a garbled price as if it were genuine.
 */
export function hasPlausibleOffer(offers: ReadonlyArray<ProductOffer> | undefined): boolean {
  return Boolean(offers?.some((offer) => isPlausiblePrice(offer.price)));
}

/**
 * Lowest-priced offer, preferring in-stock merchants — and, ahead of both,
 * preferring a plausible price (see {@link isPlausiblePrice}) so a corrupted
 * near-zero or wildly inflated offer doesn't win out over a normal one just
 * for being "cheapest" or the only one in stock. Falls back to an
 * implausible offer only when literally nothing else is available, so a
 * product isn't left with no displayed price at all.
 */
export function leadOffer(offers: ReadonlyArray<ProductOffer> | undefined): ProductOffer | undefined {
  if (!offers || offers.length === 0) {
    return undefined;
  }
  const byPrice = [...offers].sort((a, b) => a.price.price - b.price.price);
  return (
    byPrice.find((offer) => isInStock(offer.availability) && isPlausiblePrice(offer.price)) ??
    byPrice.find((offer) => isPlausiblePrice(offer.price)) ??
    byPrice.find((offer) => isInStock(offer.availability)) ??
    byPrice[0]
  );
}

/** True when offers exist but none are in stock. */
export function isSoldOut(offers: ReadonlyArray<ProductOffer> | undefined): boolean {
  return Boolean(offers && offers.length > 0 && !offers.some((o) => isInStock(o.availability)));
}

/**
 * Whether a product's *displayed* price (its {@link leadOffer}, the same one
 * shown on the card) actually falls within a price filter's bounds.
 *
 * Channel3's own `price` filter matches if ANY offer on the product
 * satisfies it, similar to how `brand_ids` matches if any of a product's
 * brands does — so a product with a cheap out-of-stock offer and an
 * expensive in-stock one can pass the filter while displaying (and selling
 * at) a price outside the requested range. This checks the actual
 * lead-offer price directly, the same belt-and-suspenders pattern as
 * {@link filterToAllowedDisplayBrand} for brands.
 *
 * Returns `true` (doesn't exclude) when there's no lead offer to check —
 * can't penalize a product for missing price data.
 */
export function isWithinDisplayedPriceRange(
  offers: ReadonlyArray<ProductOffer> | undefined,
  range: { minPrice?: number | null; maxPrice?: number | null },
): boolean {
  const offer = leadOffer(offers);
  if (!offer) return true;
  const price = offer.price.price;
  if (range.minPrice != null && price < range.minPrice) return false;
  if (range.maxPrice != null && price > range.maxPrice) return false;
  return true;
}
