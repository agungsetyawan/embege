"use client";

import { useLinkStatus } from "next/link";
import { Spinner } from "./spinner";

// Small spinner shown inside a Link while navigation is pending.
// Rendered as a Button child of Link in the admin navigation and pagination.
export function NavLinkStatus() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Spinner />;
}
