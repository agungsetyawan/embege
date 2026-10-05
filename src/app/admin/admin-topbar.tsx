"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  ADMIN_NAV,
  type AdminCounts,
  findActiveNavItem,
} from "./admin-sidebar";

function SectionBreadcrumb({ counts }: { counts: AdminCounts }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "pending";
  const status = params.get("status") ?? "";
  const item = findActiveNavItem(pathname, tab, status);
  const group =
    ADMIN_NAV.find((g) => item && g.items.includes(item)) ?? ADMIN_NAV[0];
  const section = item?.label ?? "Antrean";
  const count = item?.countKey ? counts[item.countKey] : null;

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbLink href={group.items[0].href} className="truncate">
            {group.label}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>
            {section}
            {count !== null && (
              <span className="text-muted-foreground tabular-nums">
                {" · "}
                {count}
              </span>
            )}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function AdminTopbar({ counts }: { counts: AdminCounts }) {
  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Suspense>
        <SectionBreadcrumb counts={counts} />
      </Suspense>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
