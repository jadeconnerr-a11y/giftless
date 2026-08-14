"use client";

import type { Product } from "@channel3/sdk/resources";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_FILTERS, type SearchFiltersState } from "@/lib/search";

export interface ChatTurn {
  id: string;
  query: string;
  imagePreview?: string;
  imageLabel?: string;
  status: "loading" | "done" | "error";
  products: Product[];
  /** The conversational agent's text reply for this turn, if it sent one. */
  assistantText?: string | null;
  /** Tap-ready follow-up prompts the agent offered after this turn's reply. */
  suggestions?: string[];
}

interface ChatState {
  turns: ChatTurn[];
  filters: SearchFiltersState;
  /**
   * Channel3 conversation thread id. `null` until the first turn resolves and
   * hands one back; every turn after that passes it along so the agent keeps
   * the same thread (and its context) rather than starting fresh each time.
   */
  conversationId: string | null;
  setFilters: (filters: SearchFiltersState) => void;
  setConversationId: (conversationId: string | null) => void;
  addTurn: (turn: ChatTurn) => void;
  updateTurn: (id: string, patch: Partial<ChatTurn>) => void;
  clear: () => void;
}

/** No-op storage so `persist` doesn't touch `sessionStorage` during SSR. */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/**
 * The gift-search conversation: one turn per query (text and/or image), each
 * holding its own result grid. Persisted to `sessionStorage` so navigating to
 * a PDP and back ("← Back to results") restores the whole thread instead of
 * losing it to a remount.
 */
export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      turns: [],
      filters: DEFAULT_FILTERS,
      conversationId: null,
      setFilters: (filters) => set({ filters }),
      setConversationId: (conversationId) => set({ conversationId }),
      addTurn: (turn) => set((state) => ({ turns: [...state.turns, turn] })),
      updateTurn: (id, patch) =>
        set((state) => ({
          turns: state.turns.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)),
        })),
      clear: () => set({ turns: [], filters: DEFAULT_FILTERS, conversationId: null }),
    }),
    {
      name: "giftr-chat",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? noopStorage : window.sessionStorage,
      ),
      partialize: (state) => ({
        turns: state.turns,
        filters: state.filters,
        conversationId: state.conversationId,
      }),
    },
  ),
);
