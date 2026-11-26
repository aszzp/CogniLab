import type { GymDrill, GymItem, GymProgress } from './types';
import { criticalPath } from './items/p1-critical-path';
import { labelMerge } from './items/p2-label-merge';
import { leakage } from './items/p3-leakage';
import { capacity } from './items/p4-capacity';
import { threshold } from './items/p5-threshold';
import { allocation } from './items/p6-allocation';
import { alerts } from './items/p7-alerts';
import { adjacency, grouping, indexMap, multiKeySort, weightedTally } from './items/idioms-a';
import { ceilFloor, emptySafeMax, largestRemainder, plateau, tieWinners } from './items/idioms-b';

export const GYM_ITEMS: GymItem[] = [
  criticalPath,
  labelMerge,
  leakage,
  capacity,
  threshold,
  allocation,
  alerts,
  indexMap,
  adjacency,
  weightedTally,
  grouping,
  multiKeySort,
  emptySafeMax,
  tieWinners,
  largestRemainder,
  plateau,
  ceilFloor,
].sort((a, b) => a.order - b.order);

export const GYM_PATTERNS = GYM_ITEMS.filter((i) => i.kind === 'pattern');
export const GYM_IDIOMS = GYM_ITEMS.filter((i) => i.kind === 'idiom');

export function findGymItem(key: string): GymItem | undefined {
  return GYM_ITEMS.find((i) => i.key === key);
}

export function findGymDrill(itemKey: string, drillId: string): { item: GymItem; drill: GymDrill } | undefined {
  const item = findGymItem(itemKey);
  const drill = item?.drills.find((d) => d.id === drillId);
  return item && drill ? { item, drill } : undefined;
}

export function totalDrills(): number {
  return GYM_ITEMS.reduce((sum, item) => sum + item.drills.length, 0);
}

export interface GymListItem {
  key: string;
  kind: GymItem['kind'];
  order: number;
  title: string;
  subtitle: string;
  theme?: string;
  minutes: number;
  level: GymItem['level'];
  tags: string[];
  summary: string;
  drillCount: number;
}

export function listGymItems(): GymListItem[] {
  return GYM_ITEMS.map(({ key, kind, order, title, subtitle, theme, minutes, level, tags, summary, drills }) => ({
    key, kind, order, title, subtitle, theme, minutes, level, tags, summary, drillCount: drills.length,
  }));
}

export interface GymQueueEntry {
  itemKey: string;
  drillId: string;
  itemTitle: string;
  kind: GymItem['kind'];
  type: GymDrill['type'];
}

/** 复习优先级：到期 < 未学 < 已学但错 < 已掌握。 */
function reviewScore(item: GymItem, progress: GymProgress | undefined, now: number): number {
  if (!progress) return 100 + (item.kind === 'pattern' ? 10 : 0);
  const due = !progress.nextReviewAt || new Date(progress.nextReviewAt).getTime() <= now;
  let score = due ? 60 : 10;
  score += (5 - progress.mastery) * 8;
  if (progress.lastResult === 'wrong') score += 20;
  score += item.kind === 'pattern' ? 6 : 0;
  return score;
}

/** 生成一次混合速练队列：优先到期/薄弱条目，每项最多取一道题，再补齐。 */
export function buildQuickQueue(
  progress: GymProgress[],
  size = 10,
  seed = Date.now(),
): GymQueueEntry[] {
  const now = Date.now();
  const map = new Map(progress.map((p) => [p.itemKey, p]));
  const ordered = [...GYM_ITEMS].sort(
    (a, b) => reviewScore(b, map.get(b.key), now) - reviewScore(a, map.get(a.key), now),
  );
  const rng = mulberry32(seed);
  const queue: GymQueueEntry[] = [];
  const used = new Set<string>();

  for (const item of ordered) {
    if (queue.length >= size) break;
    const drills = shuffle(item.drills, rng);
    const drill = drills[0];
    if (!drill) continue;
    used.add(drill.id);
    queue.push({
      itemKey: item.key, drillId: drill.id, itemTitle: item.title,
      kind: item.kind, type: drill.type,
    });
  }

  // 条目不够时，从已用条目的第二道题开始补齐。
  for (const item of ordered) {
    if (queue.length >= size) break;
    for (const drill of shuffle(item.drills, rng)) {
      if (queue.length >= size) break;
      if (used.has(drill.id)) continue;
      used.add(drill.id);
      queue.push({
        itemKey: item.key, drillId: drill.id, itemTitle: item.title,
        kind: item.kind, type: drill.type,
      });
    }
  }
  return queue;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rng: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type { GymDrill, GymItem, GymProgress } from './types';
