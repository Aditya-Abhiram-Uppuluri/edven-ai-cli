import type { StreamText } from "./types.ts";

/** Keyless stand-in so the whole app can run locally and in tests. Dev mode only. */
export const streamMock: StreamText = async function* ({ messages }) {
  const last = messages.at(-1)?.content ?? "";
  for (const word of `[mock reply, turn ${Math.ceil(messages.length / 2)}] You said: ${last}`.split(/(?<= )/)) {
    yield word;
  }
};
