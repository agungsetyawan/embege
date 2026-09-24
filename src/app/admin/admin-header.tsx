import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { NavLinkStatus } from "@/components/ui/nav-link-status";
import { SubmitButton } from "@/components/ui/submit-button";
import { signOut } from "./actions";

export type AdminNavKey =
  | "pending"
  | "rejected"
  | "reports"
  | "deleted"
  | "cases"
  | "settings"
  | "logs";

const NAV_ITEMS: { key: AdminNavKey; label: string; href: string }[] = [
  { key: "pending", label: "Antrean", href: "/admin" },
  { key: "rejected", label: "Ditolak", href: "/admin?tab=rejected" },
  { key: "reports", label: "Laporan", href: "/admin?tab=reports" },
  { key: "deleted", label: "Terhapus", href: "/admin?tab=deleted" },
  { key: "cases", label: "Kasus", href: "/admin/cases" },
  { key: "settings", label: "Pengaturan", href: "/admin/settings" },
  { key: "logs", label: "Cron Logs", href: "/admin/logs" },
];

export function AdminHeader({
  active,
  title,
  meta,
  description,
  email,
  children,
}: {
  active: AdminNavKey;
  title: ReactNode;
  meta?: ReactNode;
  description?: ReactNode;
  email?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-30 flex flex-col gap-4 border-b border-border bg-background/95 py-3 backdrop-blur">
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          </div>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
          {meta}
        </div>
        <div className="flex items-center gap-2">
          {email && (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {email}
            </span>
          )}
          <ThemeToggle />
          <form action={signOut}>
            <SubmitButton variant="outline" size="sm" type="submit">
              Keluar
            </SubmitButton>
          </form>
        </div>
      </header>
      <nav aria-label="Navigasi admin" className="flex flex-wrap gap-2">
        {NAV_ITEMS.map((item) => (
          <Button
            key={item.key}
            variant={active === item.key ? "default" : "outline"}
            size="sm"
            nativeButton={false}
            aria-current={active === item.key ? "page" : undefined}
            render={<Link href={item.href} />}
          >
            {item.label}
            <NavLinkStatus />
          </Button>
        ))}
      </nav>
      {children}
    </div>
  );
}
