import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ru } from '@/i18n/ru';

interface StubPageProps {
  readonly title: string;
  readonly subtitle: string;
  readonly stage: string;
  readonly children?: ReactNode;
}

/** Placeholder of a tab that a later stage of docs/PLAN.md will fill in. */
export function StubPage({ title, subtitle, stage, children }: StubPageProps) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <span className="w-fit rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
            {ru.stub.badge}
          </span>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{stage}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{ru.app.offlineNote}</CardContent>
      </Card>

      {children}
    </section>
  );
}
