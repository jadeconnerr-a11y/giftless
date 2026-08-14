"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Product } from "@channel3/sdk/resources";

import { findSimilarProducts, resolveVariant } from "@/app/actions";
import { ProductDetails } from "@/components/product-details";
import { useVariantSelection } from "@/hooks/use-variant-selection";

export function ProductPageClient({ product: initialProduct }: { product: Product }) {
  const router = useRouter();

  const { product, selection, isResolving, select } = useVariantSelection({
    product: initialProduct,
    resolve: resolveVariant,
    onResolved: (resolved) => {
      // Color-as-product-swap: the resolved variant is a different canonical
      // product, so keep the URL in sync (bookmarkable, correct on refresh).
      if (resolved.id !== initialProduct.id) {
        router.replace(`/product/${resolved.id}`);
      }
    },
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to results
      </Link>

      <ProductDetails
        product={product}
        selection={selection}
        onSelectVariant={select}
        isResolving={isResolving}
        buyLinkRel="sponsored noopener noreferrer"
        fetchSimilar={findSimilarProducts}
        recommendations={{
          title: "You might also like",
          getHref: (recommended) => `/product/${recommended.id}`,
          onSelect: (recommended) => router.push(`/product/${recommended.id}`),
          onPreload: (recommended) => router.prefetch(`/product/${recommended.id}`),
        }}
      />
    </div>
  );
}
