import { StubPage } from '@/components/common/stub-page';
import { ru } from '@/i18n/ru';

export default function DeductionsPage() {
  return (
    <StubPage
      title={ru.pages.deductions.title}
      subtitle={ru.pages.deductions.subtitle}
      stage={ru.pages.deductions.stage}
    />
  );
}
