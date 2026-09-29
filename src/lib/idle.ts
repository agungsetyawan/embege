// Run cb when the main thread is idle; fallback to setTimeout for Safari.
// Returns a cancel function. ponytail: timeout 2s, no deadline arg needed.
export function onIdle(cb: () => void, timeout = 2000): () => void {
  if (
    typeof window !== "undefined" &&
    typeof window.requestIdleCallback === "function"
  ) {
    const id = window.requestIdleCallback(cb, { timeout });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = setTimeout(cb, 1);
  return () => clearTimeout(id);
}
