import "server-only";

import type { SearchFilters } from "@channel3/sdk/resources";

import { channel3 } from "@/lib/channel3";
import { restrictToAllowedBrands } from "@/lib/allowed-brand-ids";
import {
  buildConversationTurnResult,
  buildUserMessageParts,
  priceRangeFromFilters,
} from "@/lib/conversation-turn";

// Conversational turns are LLM-backed and can run tens of seconds — comfortably
// under Vercel's fluid-compute default (300s) but well above a plain route's
// implicit expectations, so this is set explicitly rather than left to chance.
export const maxDuration = 300;

interface ConversationTurnRequestBody {
  query: string;
  imageDataUrl?: string;
  filters: SearchFilters;
  conversationId?: string | null;
}

/**
 * Streams one turn of Channel3's conversational agent as newline-delimited
 * JSON events, so the client can show the agent's reply typing in live
 * instead of a blank loading state for the whole (often tens-of-seconds)
 * turn:
 *
 * - `{"type":"text","text":"..."}` — the combined text reply so far, sent as
 *   it grows. Only ever includes the agent's *text* parts, never raw catalog
 *   tool output — that stays server-side until it's been through the same
 *   brand/price post-filter as the buffered path, then arrives once in the
 *   final `result` event.
 * - `{"type":"result", conversationId, text, suggestions, products}` — the
 *   final, fully-filtered result (see `buildConversationTurnResult`). Always
 *   the last event on success.
 * - `{"type":"error","message":"..."}` — the turn failed; no `result` event
 *   follows.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as ConversationTurnRequestBody;
  const parts = buildUserMessageParts(body.query, body.imageDataUrl);
  const filters = await restrictToAllowedBrands(body.filters);
  const priceRange = priceRangeFromFilters(body.filters);

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController<Uint8Array>, data: unknown) => {
    controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Accumulated text per part index, so multiple text parts (e.g. text,
      // then a tool call, then more text) still combine the same way
      // `buildConversationTurnResult` joins them for the final result.
      const textByPartIndex = new Map<number, string>();
      const isTextPart = new Map<number, boolean>();
      let conversationId = body.conversationId ?? "";

      const combinedText = () =>
        Array.from(textByPartIndex.keys())
          .sort((a, b) => a - b)
          .map((index) => textByPartIndex.get(index) ?? "")
          .join("\n\n");

      try {
        const events = await channel3.conversations.createTurnStream({
          message: { role: "user", parts },
          conversation_id: body.conversationId ?? undefined,
          filters,
        });

        for await (const event of events) {
          switch (event.type) {
            case "turn.started": {
              conversationId = event.conversation_id;
              break;
            }
            case "part.started": {
              isTextPart.set(event.part_index, event.part.type === "text");
              if (event.part.type === "text") {
                textByPartIndex.set(event.part_index, event.part.text ?? "");
                send(controller, { type: "text", text: combinedText() });
              }
              break;
            }
            case "part.delta": {
              if (isTextPart.get(event.part_index)) {
                const previous = textByPartIndex.get(event.part_index) ?? "";
                textByPartIndex.set(event.part_index, previous + event.delta);
                send(controller, { type: "text", text: combinedText() });
              }
              break;
            }
            case "part.completed": {
              if (event.part.type === "text") {
                textByPartIndex.set(event.part_index, event.part.text);
                send(controller, { type: "text", text: combinedText() });
              }
              break;
            }
            case "turn.completed": {
              const result = buildConversationTurnResult(conversationId, event.message, priceRange);
              send(controller, { type: "result", ...result });
              break;
            }
            case "error": {
              send(controller, { type: "error", message: event.message });
              break;
            }
          }
        }
      } catch (error) {
        send(controller, {
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      // Nginx and similar reverse proxies buffer responses by default, which
      // would defeat the point of streaming.
      "X-Accel-Buffering": "no",
    },
  });
}
