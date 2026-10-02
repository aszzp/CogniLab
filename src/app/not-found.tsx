import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="fade-up flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/25">
        <Compass size={26} className="text-violet-300" />
      </span>
      <p className="text-4xl font-bold grad-text">404</p>
      <p className="text-sm text-zinc-400">页面不存在，或该考试已完成归档</p>
      <div className="mt-2 flex gap-3">
        <Link href="/" className="rounded-xl border border-white/12 px-5 py-2.5 text-sm text-zinc-300">
          返回首页
        </Link>
        <Link href="/practice" className="grad-btn rounded-xl px-5 py-2.5 text-sm font-medium text-white">
          去刷题
        </Link>
      </div>
    </div>
  );
}
