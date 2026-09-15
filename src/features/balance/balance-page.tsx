import { StubPage } from '@/components/common/stub-page';
import { ru } from '@/i18n/ru';

export default function BalancePage() {
  return (
    <StubPage
      title={ru.pages.balance.title}
      subtitle={ru.pages.balance.subtitle}
      stage={ru.pages.balance.stage}
    />
  );
}
