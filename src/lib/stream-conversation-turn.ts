import type { ConversationTurnInput, ConversationTurnResult } from "@/lib/conversation-turn";

type StreamEvent =
  | { type: "text"; text: string }
  | ({ type: "result" } & ConversationTurnResult)
  | { type: "error"; message: string };

export interface StreamConversationTurnCallbacks {
  /** Fired every time more of the assistant's reply has streamed in. */
  onTextUpdate?: (text: string) => void;
  /** Fired once, with the final, fully brand/price-filtered result. */
  onResult: (result: ConversationTurnResult) => void;
  /** Fired if the request fails, the stream reports an error, or it ends without a result. */
  onError: (error: unknown) => void;
}

/**
 * Calls the streaming `/api/conversation-turn` endpoint and dispatches its
 * newline-delimited JSON events as they arrive, so the UI can show the
 * agent's reply typing in progressively instead of a blank loading state for
 * the whole (often tens-of-seconds) turn. See that route for the wire format.
 */
export async function streamConversationTurn(
  input: ConversationTurnInput,
  { onTextUpdate, onResult, onError }: StreamConversationTurnCallbacks,
): Promise<void> {
  try {
    const response = await fetch("/api/conversation-turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok || !response.body) {
      throw new Error(`Conversation turn request failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let gotResult = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");
        if (!line.trim()) continue;

        const event = JSON.parse(line) as StreamEvent;
        if (event.type === "text") {
          onTextUpdate?.(event.text);
        } else if (event.type === "result") {
          gotResult = true;
          onResult({
            conversationId: event.conversationId,
            text: event.text,
            suggestions: event.suggestions,
            products: event.products,
          });
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
    }

    if (!gotResult) {
      throw new Error("Conversation turn ended without a result");
    }
  } catch (error) {
    onError(error);
  }
}
