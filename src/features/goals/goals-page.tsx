import { StubPage } from '@/components/common/stub-page';
import { ru } from '@/i18n/ru';

export default function GoalsPage() {
  return (
    <StubPage title={ru.pages.goals.title} subtitle={ru.pages.goals.subtitle} stage={ru.pages.goals.stage} />
  );
}
