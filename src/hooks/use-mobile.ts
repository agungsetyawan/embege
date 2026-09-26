import { useMediaQuery } from "./use-media-query";

// shadcn sidebar reads mobile state through this name; the matchMedia logic
// lives in useMediaQuery so the 768px breakpoint has one source of truth.
export function useIsMobile() {
  return !useMediaQuery("(min-width: 768px)");
}
