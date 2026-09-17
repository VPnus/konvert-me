import { BackupCard } from '@/features/settings/cards/backup-card';
import { CalculationCard } from '@/features/settings/cards/calculation-card';
import { CountryCard } from '@/features/settings/cards/country-card';
import { HandCard } from '@/features/settings/cards/hand-card';
import { InstallCard } from '@/features/settings/cards/install-card';
import { PilotCard } from '@/features/settings/cards/pilot-card';
import { SourcesCard } from '@/features/settings/cards/sources-card';
import { StorageCard } from '@/features/settings/cards/storage-card';
import { strings } from '@/i18n';
import { countryChoiceShown } from '@/lib/preview';

export default function SettingsPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{strings.pages.settings.title}</h1>
        <p className="text-sm text-muted-foreground">{strings.pages.settings.subtitle}</p>
      </div>

      <PilotCard />
      {countryChoiceShown() ? <CountryCard /> : null}
      <CalculationCard />
      <HandCard />
      <BackupCard />
      <StorageCard />
      <InstallCard />
      <SourcesCard />
    </section>
  );
}
