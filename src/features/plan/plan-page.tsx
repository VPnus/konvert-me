import { StubPage } from '@/components/common/stub-page';
import { ru } from '@/i18n/ru';

export default function PlanPage() {
  return (
    <StubPage title={ru.pages.plan.title} subtitle={ru.pages.plan.subtitle} stage={ru.pages.plan.stage} />
  );
}
