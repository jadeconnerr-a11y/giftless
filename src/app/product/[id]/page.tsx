import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getProductDetail } from "@/app/actions";

import { ProductPageClient } from "./product-page-client";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductDetail(id);
  return { title: product ? `${product.title} — GIFTLESS` : "Product not found — GIFTLESS" };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await getProductDetail(id);

  if (!product) {
    notFound();
  }

  return <ProductPageClient product={product} />;
}
