import { useState } from 'react';

import { COUNTRIES, COUNTRY_CURRENCY, type Country } from '@/core/country';
import { formatMinor } from '@/core/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { changeCountry } from '@/db/repositories/settings';
import { fill, strings } from '@/i18n';
import { currentCountry } from '@/i18n/country';

/** The sum the warning shows unconverted: a round one reads at a glance. */
const EXAMPLE_MINOR = 100_000_00;

/**
 * The country of the data. Another one is chosen only after the warning that no sum is converted;
 * the session then draws every screen anew in its currency.
 */
export function CountryCard() {
  const current = currentCountry();
  const [target, setTarget] = useState<Country | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await changeCountry(target);
      setTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : strings.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-testid="country-card">
      <CardHeader>
        <CardTitle>{strings.settings.countryTitle}</CardTitle>
        <CardDescription>{strings.settings.countryText}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div
          role="group"
          aria-label={strings.settings.countryTitle}
          className="flex flex-col gap-2 sm:flex-row"
        >
          {COUNTRIES.map((country) => (
            <Button
              key={country}
              variant={country === current ? 'default' : 'outline'}
              aria-pressed={country === current}
              className="h-auto min-h-10 flex-1 py-2 whitespace-normal"
              data-testid={`country-${country}`}
              onClick={() => {
                if (country !== current) setTarget(country);
              }}
            >
              {strings.budgets[country]}
            </Button>
          ))}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>

      <ConfirmDialog
        open={target !== null}
        title={strings.settings.countryConfirmTitle}
        description={
          target
            ? fill(strings.settings.countryConfirmText, {
                budget: strings.budgets[target],
                from: formatMinor(EXAMPLE_MINOR, { fractionDigits: 0 }),
                to: formatMinor(EXAMPLE_MINOR, { fractionDigits: 0, currency: COUNTRY_CURRENCY[target] }),
              })
            : ''
        }
        confirmLabel={strings.settings.countryConfirm}
        busy={busy}
        onConfirm={() => void confirm()}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      />
    </Card>
  );
}
