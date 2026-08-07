"use client";

import * as React from "react";
import type { ProductDetail } from "@channel3/sdk/resources";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";

import { ProductGrid } from "@/components/product-grid";
import type { ChatTurn } from "@/lib/chat-store";

function resultsNote(turn: ChatTurn): string {
  if (turn.status === "loading") return "Searching…";
  if (turn.status === "error") return "Something went wrong with that search.";
  if (turn.products.length === 0) return "No matches — try loosening a filter or rephrasing.";
  return `Found ${turn.products.length} idea${turn.products.length === 1 ? "" : "s"}:`;
}

export const ChatTurnView = React.forwardRef<HTMLDivElement, { turn: ChatTurn }>(
  function ChatTurnView({ turn }, ref) {
    const router = useRouter();

    const openProduct = (product: ProductDetail) => router.push(`/product/${product.id}`);
    const preloadProduct = (product: ProductDetail) => router.prefetch(`/product/${product.id}`);

    return (
      <div ref={ref} className="flex flex-col gap-4">
        <div className="flex justify-end">
          <div className="flex max-w-[85%] flex-col gap-2 rounded-3xl bg-primary px-4 py-3 text-primary-foreground sm:max-w-[70%]">
            {turn.imagePreview ? (
              <img
                src={turn.imagePreview}
                alt=""
                className="h-32 w-full rounded-xl object-cover sm:h-40 sm:w-56"
              />
            ) : null}
            {turn.query ? <p className="text-sm leading-relaxed">{turn.query}</p> : null}
          </div>
        </div>

        <div className="flex justify-start">
          <div className="flex w-full max-w-full flex-col gap-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Gift className="size-3.5" />
              <span>{resultsNote(turn)}</span>
            </div>
            {turn.status !== "error" ? (
              <ProductGrid
                products={turn.products}
                loading={turn.status === "loading"}
                onSelect={openProduct}
                onPreload={preloadProduct}
                onSelectVariant={(product, value) =>
                  openProduct(value.product_id ? { ...product, id: value.product_id } : product)
                }
              />
            ) : null}
          </div>
        </div>
      </div>
    );
  },
);
