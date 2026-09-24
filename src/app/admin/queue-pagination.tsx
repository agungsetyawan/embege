import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NavLinkStatus } from "@/components/ui/nav-link-status";
import { cn } from "@/lib/utils";

interface QueuePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  pageQuery: (p: number) => string;
  className?: string;
}

// Server-side cousin of DataGridPagination: same ghost icon buttons,
// numbered groups of 5 with ellipsis, and range info. Navigation stays
// Link-based (URL ?page=) instead of table.setPageIndex.
export function QueuePagination({
  page,
  totalPages,
  total,
  pageSize,
  pageQuery,
  className,
}: QueuePaginationProps) {
  const btnBaseClasses = "p-0 text-sm";
  const btnArrowClasses = `${btnBaseClasses} rtl:transform rtl:rotate-180`;
  const moreLimit = 5;
  const pageIndex = page - 1;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const currentGroupStart = Math.floor(pageIndex / moreLimit) * moreLimit;
  const currentGroupEnd = Math.min(currentGroupStart + moreLimit, totalPages);

  const numbers = Array.from(
    { length: currentGroupEnd - currentGroupStart },
    (_, k) => {
      const n = currentGroupStart + k + 1;
      if (n === page) {
        return (
          <Button
            key={n}
            size="icon-sm"
            variant="ghost"
            aria-label={`Halaman ${n}, halaman saat ini`}
            aria-current="page"
            disabled
            className={cn(
              btnBaseClasses,
              "bg-accent text-accent-foreground opacity-100",
            )}
          >
            {n}
          </Button>
        );
      }
      return (
        <Button
          key={n}
          size="icon-sm"
          variant="ghost"
          aria-label={`Ke halaman ${n}`}
          nativeButton={false}
          render={<Link href={pageQuery(n)} />}
          className={cn(btnBaseClasses, "text-muted-foreground")}
        >
          {n}
          <NavLinkStatus />
        </Button>
      );
    },
  );

  return (
    <nav
      aria-label="Halaman antrean"
      className={cn(
        "flex flex-col items-center justify-between gap-2.5 sm:flex-row",
        className,
      )}
    >
      <p className="order-2 text-sm text-muted-foreground text-nowrap sm:order-1">
        {from}–{to} dari {total}
      </p>
      <div className="order-1 flex items-center space-x-1 sm:order-2">
        {page > 1 ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Halaman sebelumnya"
            nativeButton={false}
            render={<Link href={pageQuery(page - 1)} />}
            className={btnArrowClasses}
          >
            <ChevronLeftIcon className="size-4" />
            <NavLinkStatus />
          </Button>
        ) : (
          <Button
            size="icon-sm"
            variant="ghost"
            disabled
            aria-label="Halaman sebelumnya"
            className={btnArrowClasses}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
        )}

        {currentGroupStart > 0 && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Ke halaman ${currentGroupStart}`}
            nativeButton={false}
            render={<Link href={pageQuery(currentGroupStart)} />}
            className={btnBaseClasses}
          >
            ...
            <NavLinkStatus />
          </Button>
        )}

        {numbers}

        {currentGroupEnd < totalPages && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Ke halaman ${currentGroupEnd + 1}`}
            nativeButton={false}
            render={<Link href={pageQuery(currentGroupEnd + 1)} />}
            className={btnBaseClasses}
          >
            ...
            <NavLinkStatus />
          </Button>
        )}

        {page < totalPages ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Halaman berikutnya"
            nativeButton={false}
            render={<Link href={pageQuery(page + 1)} />}
            className={btnArrowClasses}
          >
            <ChevronRightIcon className="size-4" />
            <NavLinkStatus />
          </Button>
        ) : (
          <Button
            size="icon-sm"
            variant="ghost"
            disabled
            aria-label="Halaman berikutnya"
            className={btnArrowClasses}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        )}
      </div>
    </nav>
  );
}
