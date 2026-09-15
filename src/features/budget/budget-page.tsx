import { StubPage } from '@/components/common/stub-page';
import { ru } from '@/i18n/ru';

export default function BudgetPage() {
  return (
    <StubPage
      title={ru.pages.budget.title}
      subtitle={ru.pages.budget.subtitle}
      stage={ru.pages.budget.stage}
    />
  );
}
