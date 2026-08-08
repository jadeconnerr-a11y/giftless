"use client";

import * as React from "react";
import { ArrowUp, ImageIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { readImageFile } from "@/lib/image";
import { ProductFiltersPopoverButton } from "@/components/product-filters";

export interface ComposerImage {
  dataUrl: string;
  base64: string;
  label: string;
}

export interface ComposerSubmitInput {
  query: string;
  image?: ComposerImage;
}

export interface ComposerProps {
  onSubmit: (input: ComposerSubmitInput) => void;
  /** Disables the send affordance (e.g. while a search is in flight). */
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/** Imperative handle for callers outside the composer (e.g. a clickable collage label) that want to fill — not submit — the text. */
export interface ComposerHandle {
  /** Sets the textarea's text and focuses it. Does not submit. */
  fillText: (text: string) => void;
}

const MAX_TEXTAREA_HEIGHT = 160;

/**
 * The bottom-anchored, ChatGPT-style message composer: an auto-growing
 * textarea, an image-attach button, and a send button. Enter submits;
 * Shift+Enter inserts a newline.
 */
export const Composer = React.forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { onSubmit, disabled = false, placeholder, className },
  ref,
) {
  const [text, setText] = React.useState("");
  const [image, setImage] = React.useState<ComposerImage | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const resize = React.useCallback(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, []);

  React.useEffect(resize, [text, resize]);

  React.useImperativeHandle(ref, () => ({
    fillText: (value: string) => {
      setText(value);
      const node = textareaRef.current;
      node?.focus();
      // Put the caret at the end rather than leaving it wherever it was.
      window.requestAnimationFrame(() => node?.setSelectionRange(value.length, value.length));
    },
  }));

  const canSubmit = !disabled && (text.trim().length > 0 || image != null);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({ query: text.trim(), image: image ?? undefined });
    setText("");
    setImage(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const { dataUrl, base64 } = await readImageFile(file);
    setImage({ dataUrl, base64, label: file.name });
  };

  return (
    <div
      data-slot="composer"
      className={cn(
        "flex flex-col gap-2 rounded-3xl border border-border bg-card px-3 py-2.5 shadow-lg shadow-black/5 transition-colors focus-within:border-foreground/25",
        className,
      )}
    >
      {image ? (
        <div className="flex w-fit items-center gap-2 rounded-xl bg-muted px-2 py-1.5">
          <img src={image.dataUrl} alt="" className="size-8 rounded-md object-cover" />
          <span className="max-w-40 truncate text-xs text-muted-foreground">{image.label}</span>
          <button
            type="button"
            onClick={() => setImage(null)}
            aria-label="Remove image"
            className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Search by image"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ImageIcon className="size-[18px]" />
        </button>

        <ProductFiltersPopoverButton priceMax={300} priceStep={5} />

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Describe her, an occasion, a budget…"}
          className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-base leading-relaxed outline-none placeholder:text-muted-foreground md:text-sm"
        />

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          aria-label="Send"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
            canSubmit
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "bg-muted text-muted-foreground",
          )}
        >
          <ArrowUp className="size-[18px]" />
        </button>
      </div>
    </div>
  );
});
