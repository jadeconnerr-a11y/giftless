"use client";

import * as React from "react";

import { Composer, type ComposerHandle, type ComposerSubmitInput } from "@/components/chat/composer";
import { HeroCollage, LEFT_SLOTS, MobileCollageStrip, RIGHT_SLOTS } from "@/components/chat/hero-collage";

const ALL_SLOTS = [...LEFT_SLOTS, ...RIGHT_SLOTS];

export function EmptyState({ onSubmit }: { onSubmit: (input: ComposerSubmitInput) => void }) {
  const composerRef = React.useRef<ComposerHandle>(null);
  const fillPrompt = (prompt: string) => composerRef.current?.fillText(prompt);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-12 xl:flex-row xl:gap-10 xl:py-16">
      <HeroCollage side="left" slots={LEFT_SLOTS} onPromptClick={fillPrompt} />

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 text-center">
        <h1 className="max-w-xl text-2xl leading-snug text-foreground sm:text-3xl">
          Welcome to <span className="font-serif italic">GIFTLESS</span>.
          <br />
          Built for boyfriends, husbands, fathers and brothers who don't know what gifts to buy.
        </h1>

        <div className="w-full max-w-2xl">
          <Composer ref={composerRef} onSubmit={onSubmit} />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Buy links may earn GIFTLESS a commission at no extra cost to you.
          </p>
        </div>
      </div>

      <MobileCollageStrip slots={ALL_SLOTS} onPromptClick={fillPrompt} />

      <HeroCollage side="right" slots={RIGHT_SLOTS} onPromptClick={fillPrompt} />
    </div>
  );
}
