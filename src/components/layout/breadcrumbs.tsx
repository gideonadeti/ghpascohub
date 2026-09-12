import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type BreadcrumbItem = {
  name: string;
  href: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const currentItem = items.at(-1);
  const parentItems = items.slice(0, -1);

  if (!currentItem) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-y-1 text-sm text-muted-foreground">
        {parentItems.map((item) => (
          <li
            key={`${item.href}-${item.name}`}
            className="inline-flex min-w-0 items-center"
          >
            <Link
              href={item.href}
              className="max-w-48 truncate transition-colors hover:text-foreground sm:max-w-64"
            >
              {item.name}
            </Link>
            <ChevronRight className="mx-2 size-4 shrink-0" aria-hidden />
          </li>
        ))}
        <li
          aria-current="page"
          className="min-w-0 max-w-full truncate font-medium text-foreground"
        >
          {currentItem.name}
        </li>
      </ol>
    </nav>
  );
}

export type { BreadcrumbItem };
