# Giftr

A ChatGPT-style gift concierge for boyfriends and husbands: describe her, an occasion, or a
budget (or drop in a photo of something she'd love), and Giftr searches Channel3's product
catalog and shows real, buyable results in a chat thread. Every offer's buy link is
affiliate-tracked.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- [Channel3](https://trychannel3.com) SDK + [UI components](https://ui.trychannel3.com) for
  search, filters, the product grid/card, and the product detail page (variants, offers,
  price history, recommendations)
- Server Actions (`src/app/actions.ts`) wrap every Channel3 SDK call — `CHANNEL3_API_KEY`
  never reaches the browser; the Channel3 UI components only ever see plain data as props.
- Zustand (persisted to `sessionStorage`) holds the chat thread, so navigating to a product
  and back with "← Back to results" restores the whole conversation.

## Setup

```bash
npm install
cp .env.local.example .env.local   # then fill in CHANNEL3_API_KEY (free key at trychannel3.com)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Curated brand list

`src/lib/allowed-brands.ts` holds a curated allowlist of brand names; `src/lib/allowed-brand-ids.ts`
resolves it to Channel3 brand IDs (once per server lifetime, via a full `brands.list()` walk) and
narrows `SearchFilters.brand_ids` to it. Every Server Action that returns products
(`searchProducts`, `findSimilarProducts`, `getProductDetail`, `resolveVariant`) also does a
belt-and-suspenders filter on the *displayed* brand, so only products from the curated list are
ever shown or recommended — update `ALLOWED_BRAND_NAMES` in `allowed-brands.ts` to change the list.

## Structure

- `src/app/page.tsx` — the chat home: filter bar (`ProductFiltersBar`) + conversation thread +
  composer (text and/or image search).
- `src/app/product/[id]/` — the PDP: gallery, variant selection, offers with affiliate buy
  links, similar products, and a link back to the grid.
- `src/app/actions.ts` — Server Actions wrapping `@channel3/sdk`.
- `src/lib/chat-store.ts` — the persisted chat-thread state.
- `src/components/` — Channel3's shadcn-installed UI kit (`product-*`, `variant-selector`,
  `offers-list`, …) plus `src/components/chat/` for the composer/thread views.
