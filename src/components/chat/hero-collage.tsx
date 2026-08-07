"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CollageSlot {
  /** Filename under `public/collage/`. Drop your own photo in with this exact name to replace the placeholder — no code changes needed. */
  file: string;
  /** Pixels from the top of the collage column. Increase to move the photo down. */
  top: number;
  /** Pixels from the *outer* edge — the left edge for the left collage, the right edge for the right one. Increase to push the photo toward the center text. */
  edge: number;
  /** Rotation in degrees. Negative tilts left, positive tilts right. 0 is straight. */
  rotate: number;
  /** Width in pixels. Height is derived from `aspect` below. */
  width: number;
  /** width ÷ height. 0.75 ≈ portrait (3:4), 1 = square, 1.33 ≈ landscape (4:3). Defaults to 1. */
  aspect?: number;
  /** Stack order where photos overlap — higher numbers sit on top. */
  z: number;
  /** Optional text shown over the photo on hover/focus. Set together with `prompt`. */
  label?: string;
  /** What clicking the label fills into the chat box (it fills, not submits — the user still hits send). */
  prompt?: string;
}

// ---------------------------------------------------------------------------
// Playground: every photo's size, position, tilt, and optional clickable
// label lives right here. Edit the numbers and refresh to see it move.
//
// To use your own photos: drop files into `public/collage/` named exactly
// like the `file` values below (e.g. `public/collage/left-1.jpg`). Until a
// file exists, that slot shows a placeholder with its expected filename.
// ---------------------------------------------------------------------------

export const LEFT_SLOTS: CollageSlot[] = [
  {
    file: "cl9lqlh6s6650nmgtcboxy17f_kc6arppzge5v5jakk16ju9wo.webp", // earrings, 600x600
    top: 0,
    edge: 20,
    rotate: -4,
    width: 140,
    aspect: 1,
    z: 30,
    label: "Gold dainty jewellery",
    prompt: "Gold dainty jewellery",
  },
  {
    file: "clc9j2dj2154135101s67x86a1gf_b45t66rfuycm7xyz0byh1deo.webp", // zebra woven tote, 600x745
    top: 165,
    edge: 95,
    rotate: 3,
    width: 150,
    aspect: 0.805,
    z: 20,
    label: "Chic woven bag for her birthday",
    prompt: "Chic woven bag for her birthday",
  },
  {
    file: "cllfoeubl1804201s6xx5yd1ui_dk0gcpqv0xt7b8ek1sy999i7.webp", // bandana bucket hat, 600x800
    top: 355,
    edge: 10,
    rotate: -2,
    width: 165,
    aspect: 0.75,
    z: 10,
    label: "Sun hat for a beach holiday",
    prompt: "Sun hat for a beach holiday",
  },
];

export const RIGHT_SLOTS: CollageSlot[] = [
  {
    file: "clms2g3vi52306001s65z5rhg2v_clxbx5kr7015c01s6eu82d5kc.webp", // halter top w/ chain, 600x900
    top: 10,
    edge: 25,
    rotate: 4,
    width: 130,
    aspect: 0.667,
    z: 30,
    label: "Going out top for our anniversary dinner",
    prompt: "Going out top for our anniversary dinner",
  },
  {
    file: "cmruwprhi00vz138rgq4st1tb_jhip864xozohnxw0sb5c5izk.webp", // magenta leather clutch, 600x791
    top: 195,
    edge: 90,
    rotate: -3,
    width: 115,
    aspect: 0.759,
    z: 20,
    label: "Pink leather clutch",
    prompt: "Pink leather clutch",
  },
  {
    file: "diptyque-roses-3-wick-candle-600g__62480.1681072382.1280.1280.webp", // Diptyque candle, 1280x1280
    top: 330,
    edge: 10,
    rotate: 3,
    width: 140,
    aspect: 1,
    z: 10,
    label: "Chic luxury candle",
    prompt: "Chic luxury candle",
  },
  {
    file: "9xx-0246-0151_7.webp", // Manolo Blahnik blue suede heels, 720x1008
    top: 460,
    edge: 85,
    rotate: -4,
    width: 122,
    aspect: 0.714,
    z: 5,
    label: "Heels for date night",
    prompt: "Heels for date night",
  },
];

function CollageTile({
  slot,
  side,
  onLabelClick,
}: {
  slot: CollageSlot;
  side: "left" | "right";
  onLabelClick?: (prompt: string) => void;
}) {
  const [failed, setFailed] = React.useState(false);
  const height = Math.round(slot.width / (slot.aspect ?? 1));

  // A cached 404 can fire the native `error` event before React attaches its
  // listener, so `onError` alone can miss it. Back it up with a mount-time
  // check of the already-resolved image state.
  const checkAlreadyFailed = React.useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) {
      setFailed(true);
    }
  }, []);

  return (
    <div
      className="absolute"
      style={{
        top: slot.top,
        [side]: slot.edge,
        width: slot.width,
        height,
        transform: `rotate(${slot.rotate}deg)`,
        zIndex: slot.z,
      }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-md border-4 border-white shadow-lg ring-1 ring-black/5">
        {failed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted px-2 text-center">
            <Plus className="size-4 text-muted-foreground/60" />
            <span className="text-[9px] leading-tight font-medium text-muted-foreground">
              public/collage/{slot.file}
            </span>
          </div>
        ) : (
          <img
            ref={checkAlreadyFailed}
            src={`/collage/${slot.file}`}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        )}

        {slot.label && slot.prompt ? (
          <button
            type="button"
            onClick={() => onLabelClick?.(slot.prompt!)}
            style={{ transform: `rotate(${-slot.rotate}deg)` }}
            className="absolute inset-0 flex items-center justify-center bg-black/0 p-2 text-center text-xs leading-snug font-medium text-transparent transition-colors hover:bg-black/45 hover:text-white focus-visible:bg-black/45 focus-visible:text-white focus-visible:outline-none"
          >
            {slot.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Freely-positioned collage of (real, swappable) photos flanking the landing
 * page's centered copy. Desktop-only (`xl:` and up) — on narrower viewports
 * there isn't room beside the centered column, so it's simply omitted.
 */
export function HeroCollage({
  side,
  slots,
  onPromptClick,
  className,
}: {
  side: "left" | "right";
  slots: CollageSlot[];
  onPromptClick?: (prompt: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative hidden h-[640px] w-52 shrink-0 xl:block", className)}>
      {slots.map((slot) => (
        <CollageTile key={slot.file} slot={slot} side={side} onLabelClick={onPromptClick} />
      ))}
    </div>
  );
}
