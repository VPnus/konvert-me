import { AppearanceCard } from '@/features/settings/cards/appearance-card';
import { BackupCard } from '@/features/settings/cards/backup-card';
import { CalculationCard } from '@/features/settings/cards/calculation-card';
import { InstallCard } from '@/features/settings/cards/install-card';
import { StorageCard } from '@/features/settings/cards/storage-card';
import { ru } from '@/i18n/ru';

export default function SettingsPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{ru.pages.settings.title}</h1>
        <p className="text-sm text-muted-foreground">{ru.pages.settings.subtitle}</p>
      </div>

      <CalculationCard />
      <BackupCard />
      <StorageCard />
      <InstallCard />
      <AppearanceCard />
    </section>
  );
}
