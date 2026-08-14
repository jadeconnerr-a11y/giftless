import * as React from "react";
import Link from "next/link";

/**
 * Matches a markdown link `[label](scheme:value)` — specifically one with a
 * URI scheme rather than a bare path/URL, since that's how the conversational
 * agent embeds catalog references in its reply text, e.g.
 * `[here](cp:E9dqGpd)` pointing at a `Product.id` from this turn's own
 * results. Channel3 doesn't auto-resolve these; the client is expected to
 * rewrite them into real links before display.
 */
const SCHEME_LINK = /\[([^\]]+)\]\(([a-z][a-z0-9+.-]*):([^)\s]+)\)/gi;

/**
 * Renders the conversational agent's reply text, resolving its embedded
 * `[label](cp:PRODUCT_ID)` references into real links to `/product/{id}`
 * instead of leaking the raw markdown/URI syntax. Plain `http(s):` links are
 * rendered as ordinary external anchors; any other scheme falls back to its
 * label text alone rather than showing unresolved link syntax.
 */
export function AssistantMessage({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  // `matchAll` (unlike `exec` in a loop) doesn't mutate the shared regex's
  // `lastIndex`, so `SCHEME_LINK` can stay a module-level constant.
  for (const match of text.matchAll(SCHEME_LINK)) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const [full, label, scheme, value] = match;
    if (scheme === "cp") {
      nodes.push(
        <Link
          key={key++}
          href={`/product/${value}`}
          className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
        >
          {label}
        </Link>,
      );
    } else if (scheme === "http" || scheme === "https") {
      nodes.push(
        <a
          key={key++}
          href={`${scheme}:${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
        >
          {label}
        </a>,
      );
    } else {
      // Unrecognized scheme: show the label, drop the raw link syntax rather
      // than leaking it into the UI.
      nodes.push(label);
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  // `text` may join multiple reply parts with blank lines (see
  // `runConversationTurn`); a plain `<p>` collapses that whitespace and runs
  // them together, so preserve line breaks explicitly.
  return (
    <p className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-foreground">{nodes}</p>
  );
}
