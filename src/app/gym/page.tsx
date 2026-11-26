import { listGymItems, totalDrills } from '@/lib/gym/content';
import { gymOverview, gymProgressRows } from '@/lib/gym/store';
import GymList from '@/components/gym/GymList';

export const dynamic = 'force-dynamic';

export default function GymPage() {
  const items = listGymItems();
  const progress = gymProgressRows().map((p) => ({ ...p }));
  const { due, mastered, now } = gymOverview(items.map((i) => i.key), progress);

  return (
    <GymList
      items={items}
      progress={progress}
      due={due}
      mastered={mastered}
      totalDrills={totalDrills()}
      now={now}
    />
  );
}
