'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/components/ui/luxury';

const NAV_ITEMS = [
  { href: '/app', label: 'Treasury' },
  { href: '/app/agents', label: 'Agents' },
  { href: '/app/tasks', label: 'Tasks' },
  { href: '/app/x402', label: 'x402 Demo' },
  { href: '/app/settings', label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col border-r border-white/8 bg-[#030303] lg:flex">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-[rgba(214,190,112,0.3)] bg-[radial-gradient(circle,rgba(252,246,186,0.12),transparent_70%)]">
          <span className="text-sm font-semibold tracking-[0.2em] text-amber-100">S</span>
        </div>
        <div>
          <h1 className="text-base text-white">Sable</h1>
          <p className="text-[9px] uppercase tracking-[0.25em] text-zinc-500">Agent Treasury</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-xl px-4 py-2.5 text-xs font-medium uppercase tracking-[0.14em] transition',
                    active
                      ? 'bg-white/[0.05] text-amber-100'
                      : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200'
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/8 px-5 py-4">
        <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">Sable Console</p>
        <p className="mt-1 text-[10px] text-zinc-500">Private programmable money for AI agents.</p>
      </div>
    </aside>
  );
}
