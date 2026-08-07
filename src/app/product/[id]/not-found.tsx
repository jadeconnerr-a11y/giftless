import Link from "next/link";
import { ArrowLeft, PackageX } from "lucide-react";

export default function ProductNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <PackageX className="size-10 text-muted-foreground" />
      <h1 className="font-serif text-2xl text-foreground">We lost that one.</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This product isn't available right now — it may have sold out or moved.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to results
      </Link>
    </div>
  );
}
