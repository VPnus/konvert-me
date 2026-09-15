import { StubPage } from '@/components/common/stub-page';
import { ru } from '@/i18n/ru';

export default function OverviewPage() {
  return (
    <StubPage
      title={ru.pages.overview.title}
      subtitle={ru.pages.overview.subtitle}
      stage={ru.pages.overview.stage}
    />
  );
}
