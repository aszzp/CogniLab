'use client';

import { useEffect, useState } from 'react';
import ProblemWorkspace from './ProblemWorkspace';
import type { CodePublic } from '@/lib/finals-content';

/** 编程题专项练习：草稿自动保存到本地库，下次打开接着写。 */
export default function PracticeSession({
  problem, initialCode, pythonLabel,
}: {
  problem: CodePublic;
  initialCode: string;
  pythonLabel: string;
}) {
  const [code, setCode] = useState(initialCode);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetch(`/api/finals/practice/${problem.key}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ code }),
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [code, problem.key]);

  return (
    <ProblemWorkspace
      key={problem.key}
      practice
      problem={problem}
      initialCode={initialCode}
      pythonLabel={pythonLabel}
      onChange={setCode}
    />
  );
}
