"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Biohazard,
  Database,
  Flag,
  Inbox,
  Settings,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { signOut } from "./actions";

export type AdminCounts = {
  pending: number;
  auto: number;
  reports: number;
  deleted: number;
};

export type AdminNavItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  countKey?: keyof AdminCounts;
};

// Queue keys are ?tab= values, data keys are pathnames; isNavActive covers both.
export const ADMIN_NAV: { label?: string; items: AdminNavItem[] }[] = [
  {
    label: "Kurasi",
    items: [
      {
        key: "pending",
        label: "Antrean",
        href: "/admin",
        icon: Inbox,
        countKey: "pending",
      },
      {
        key: "rejected",
        label: "Ditolak",
        href: "/admin?tab=rejected",
        icon: XCircle,
        countKey: "auto",
      },
      {
        key: "reports",
        label: "Laporan",
        href: "/admin?tab=reports",
        icon: Flag,
        countKey: "reports",
      },
      {
        key: "deleted",
        label: "Terhapus",
        href: "/admin?tab=deleted",
        icon: Trash2,
        countKey: "deleted",
      },
    ],
  },
  {
    items: [
      {
        key: "/admin/cases",
        label: "Kasus",
        href: "/admin/cases",
        icon: Database,
      },
      {
        key: "/admin/settings",
        label: "Pengaturan",
        href: "/admin/settings",
        icon: Settings,
      },
      {
        key: "/admin/logs",
        label: "Cron Logs",
        href: "/admin/logs",
        icon: Activity,
      },
    ],
  },
];

function isNavActive(pathname: string, tab: string, key: string) {
  return pathname === "/admin" ? tab === key : key === pathname;
}

export function findActiveNavItem(pathname: string, tab: string) {
  return ADMIN_NAV.flatMap((group) => group.items).find((item) =>
    isNavActive(pathname, tab, item.key),
  );
}

function NavGroups({ counts }: { counts: AdminCounts }) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab") ?? "pending";
  const activeKey = findActiveNavItem(pathname, tab)?.key;

  return (
    <>
      {ADMIN_NAV.map((group) => (
        <SidebarGroup key={group.label ?? "data"}>
          {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive = item.key === activeKey;
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <item.icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.countKey && (
                      <SidebarMenuBadge>
                        {counts[item.countKey]}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

export function AdminSidebar({
  counts,
  email,
}: {
  counts: AdminCounts;
  email?: string | null;
}) {
  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/admin" />}>
              <Biohazard aria-hidden="true" />
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">
                  embege poisoning
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent role="navigation" aria-label="Navigasi admin">
        <Suspense>
          <NavGroups counts={counts} />
        </Suspense>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator className="mx-0" />
        <div className="flex items-center gap-2 px-1 py-1">
          {email && (
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {email}
            </span>
          )}
          <form action={signOut}>
            <Button variant="outline" size="sm" type="submit">
              Keluar
            </Button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
