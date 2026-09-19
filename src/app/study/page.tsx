import { qAll } from '@/lib/db';
import StudyHub from '@/components/study/StudyHub';

export const dynamic = 'force-dynamic';

export interface SyllabusItem {
  id: number;
  module: string;
  section: string;
  topic: string;
  detail: string;
  level: string;
  ref: string;
  mastered: number;
}

export default function StudyPage() {
  const rows = qAll<{ id: number; module: string; section: string; topic: string; detail: string; level: string; ref: string; mastered: number }>(
    'SELECT id, module, section, topic, detail, level, ref, mastered FROM syllabus ORDER BY module, sort, id',
  );
  // node:sqlite 返回 null 原型对象，需转为普通对象才能传给 Client 组件
  const items: SyllabusItem[] = rows.map((r) => ({
    id: r.id, module: r.module, section: r.section, topic: r.topic, detail: r.detail,
    level: r.level ?? '', ref: r.ref ?? '', mastered: r.mastered,
  }));
  return <StudyHub items={items} />;
}
