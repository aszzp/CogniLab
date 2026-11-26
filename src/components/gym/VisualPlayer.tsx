'use client';

import type { GymItem } from '@/lib/gym/types';
import CriticalPathVisual from './visuals/CriticalPathVisual';
import VoteVisual from './visuals/VoteVisual';
import LeakageVisual from './visuals/LeakageVisual';
import CapacityVisual from './visuals/CapacityVisual';
import ThresholdVisual from './visuals/ThresholdVisual';
import AllocationVisual from './visuals/AllocationVisual';
import AlertsVisual from './visuals/AlertsVisual';
import IdiomDemo from './visuals/IdiomDemo';

export default function VisualPlayer({ item }: { item: GymItem }) {
  switch (item.visual) {
    case 'critical-path': return <CriticalPathVisual />;
    case 'vote-merge': return <VoteVisual />;
    case 'leakage': return <LeakageVisual />;
    case 'capacity': return <CapacityVisual />;
    case 'threshold': return <ThresholdVisual />;
    case 'allocation': return <AllocationVisual />;
    case 'alerts': return <AlertsVisual />;
    case 'idiom': return <IdiomDemo demo={item.demo} />;
    default: return <div className="card p-4 text-sm text-zinc-500">这个条目还没有可视化。</div>;
  }
}
