/**
 * Requests pagepal makes itself (analytics delivery) must not make the pal wait
 * or wince. Patched fetch/XHR pass through while `depth > 0`; calls are
 * synchronous into the patch, so a counter around the call is enough.
 */
export const internalRequests = { depth: 0 };

export function asInternal<T>(send: () => T): T {
  internalRequests.depth++;
  try {
    return send();
  } finally {
    internalRequests.depth--;
  }
}
