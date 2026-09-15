import { StubPage } from '@/components/common/stub-page';
import { ru } from '@/i18n/ru';

export default function SettingsPage() {
  return (
    <StubPage
      title={ru.pages.settings.title}
      subtitle={ru.pages.settings.subtitle}
      stage={ru.pages.settings.stage}
    />
  );
}
