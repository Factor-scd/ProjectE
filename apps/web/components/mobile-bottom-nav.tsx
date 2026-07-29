'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ListTodo,
  Flame,
  NotebookPen,
  CalendarDays,
  MoreHorizontal,
} from 'lucide-react';

const bottomNavItems = [
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/habits', label: 'Habits', icon: Flame },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/notes', label: 'Notes', icon: NotebookPen },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/more', label: 'More', icon: MoreHorizontal },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-16">
        {bottomNavItems.map((item) => {
          const isActive =
            item.href === '/more'
              ? !bottomNavItems
                  .filter((i) => i.href !== '/more')
                  .some((i) => pathname.startsWith(i.href))
              : pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 px-3 py-1 min-h-[44px] min-w-[44px] rounded-lg transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
