// SM-2 简化版间隔重复
export interface SrsState {
  ease: number;
  interval_days: number;
  reps: number;
  lapses: number;
  due_at: string; // ISO
}

const DAY = 86400_000;
const fmt = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);

export function schedule(prev: Partial<SrsState> | undefined, correct: boolean): SrsState {
  const ease = Math.min(2.8, Math.max(1.3, (prev?.ease ?? 2.5) + (correct ? 0.05 : -0.2)));
  let interval: number;
  if (!correct) {
    interval = 10 / 1440; // 10 分钟后重新出现
  } else {
    const reps = prev?.reps ?? 0;
    interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.min(60, (prev?.interval_days ?? 1) * ease);
  }
  return {
    ease,
    interval_days: interval,
    reps: correct ? (prev?.reps ?? 0) + 1 : 0,
    lapses: (prev?.lapses ?? 0) + (correct ? 0 : 1),
    due_at: fmt(new Date(Date.now() + interval * DAY)),
  };
}

export function nowStr(): string {
  return fmt(new Date());
}
