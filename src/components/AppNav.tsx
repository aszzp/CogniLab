'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Timer, FlaskConical, User, BrainCircuit, GraduationCap } from 'lucide-react';

const TABS = [
  { href: '/', label: '首页', icon: Home },
  { href: '/study', label: '学习', icon: GraduationCap },
  { href: '/practice', label: '刷题', icon: BookOpen },
  { href: '/exam', label: '考试', icon: Timer },
  { href: '/hands-on', label: '实操', icon: FlaskConical },
  { href: '/me', label: '我的', icon: User },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export default function AppNav() {
  const pathname = usePathname() || '/';
  return (
    <>
      {/* 桌面顶部导航 */}
      <header className="fixed inset-x-0 top-0 z-40 hidden border-b border-white/8 bg-[#07070c]/80 backdrop-blur-xl md:block">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-4 px-4 md:max-w-4xl lg:max-w-6xl lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500">
              <BrainCircuit size={18} className="text-white" />
            </span>
            <span className="text-[15px] font-semibold tracking-wide">
              CogniLab<span className="ml-2 hidden text-xs font-normal text-zinc-500 lg:inline">数字人训练师备赛</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {TABS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
                  isActive(pathname, href)
                    ? 'bg-white/10 font-medium text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* 移动端底部 Tab */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-[#0a0a12]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-6">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center gap-1 py-2.5 transition-colors"
              >
                <span
                  className={`absolute top-0 h-0.5 w-6 rounded-full bg-gradient-to-r from-violet-400 to-cyan-400 transition-opacity ${
                    active ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <Icon
                  size={21}
                  className={active ? 'text-violet-400' : 'text-zinc-500'}
                  strokeWidth={active ? 2.4 : 1.8}
                />
                <span className={`text-[10.5px] ${active ? 'font-medium text-violet-300' : 'text-zinc-500'}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
