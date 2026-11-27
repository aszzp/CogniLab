import { notFound } from 'next/navigation';
import { findGymItem } from '@/lib/gym/content';
import { gymProgress } from '@/lib/gym/store';
import { pythonVersion } from '@/lib/python-judge.mjs';
import GymItemView from '@/components/gym/GymItemView';

export const dynamic = 'force-dynamic';

export default async function GymItemPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const item = findGymItem(slug);
  if (!item) notFound();
  const { tab } = await searchParams;
  const initialTab = tab === 'practice' || tab === 'visual' || tab === 'sprint' || tab === 'quick' ? tab : 'learn';
  const progress = gymProgress(item.key) ?? null;
  const version = await pythonVersion();
  return (
    <GymItemView
      key={`${item.key}-${initialTab}`}
      item={item}
      progress={progress}
      initialTab={initialTab}
      pythonLabel={version ? `Python (${version})` : 'Python'}
    />
  );
}
