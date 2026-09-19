import { notFound } from 'next/navigation';
import { qGet } from '@/lib/db';
import SqlTrainer from '@/components/trainers/SqlTrainer';
import PythonTrainer from '@/components/trainers/PythonTrainer';
import EssayTrainer from '@/components/trainers/EssayTrainer';
import ChartTrainer from '@/components/trainers/ChartTrainer';
import FlowTrainer from '@/components/trainers/FlowTrainer';
import type { Task } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = qGet<{
    id: number; kind: string; title: string; category: string;
    prompt: string; points: number; source: string; meta: string;
  }>('SELECT id, kind, title, category, prompt, points, source, meta FROM tasks WHERE id = ?', Number(id));
  if (!row) notFound();
  const task: Task = {
    id: row.id, kind: row.kind as Task['kind'], title: row.title, category: row.category,
    prompt: row.prompt, points: row.points, source: row.source, meta: JSON.parse(row.meta),
  };

  return (
    <div className="fade-up space-y-4">
      <div className="card p-5">
        <div className="mb-2 flex items-center gap-2 text-[11px]">
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-medium text-violet-300">{task.category}</span>
          <span className="rounded-full bg-white/8 px-2 py-0.5 text-zinc-400">{task.points} 分制</span>
          <span className="ml-auto text-zinc-600">{task.source}</span>
        </div>
        <h1 className="text-[16px] font-bold">{task.title}</h1>
        <p className="mt-2.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-zinc-300">{task.prompt}</p>
      </div>
      {task.kind === 'sql' && <SqlTrainer task={task} />}
      {task.kind === 'python' && <PythonTrainer task={task} />}
      {task.kind === 'essay' && <EssayTrainer task={task} />}
      {task.kind === 'chart' && <ChartTrainer task={task} />}
      {task.kind === 'flow' && <FlowTrainer task={task} />}
    </div>
  );
}
