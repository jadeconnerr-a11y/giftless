import "server-only";

import { Channel3 } from "@channel3/sdk";

/**
 * Server-only Channel3 client. `CHANNEL3_API_KEY` never reaches the browser —
 * every SDK call happens here or in a `"use server"` action, and the Channel3
 * UI components stay presentational, receiving only plain data as props.
 */
export const channel3 = new Channel3({
  apiKey: process.env.CHANNEL3_API_KEY,
});
