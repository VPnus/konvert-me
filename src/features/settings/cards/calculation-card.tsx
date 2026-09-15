import { useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { updateSettings } from '@/db/repositories/settings';
import { ru } from '@/i18n/ru';
import { useSettings } from '@/hooks/use-settings';
import { publishAppEvent } from '@/lib/broadcast';

const toPercent = (rate: number): string => String(Math.round(rate * 1000) / 10);

export function CalculationCard() {
  const settings = useSettings();
  const [error, setError] = useState<string | null>(null);

  const save = async (patch: Parameters<typeof updateSettings>[0]) => {
    try {
      await updateSettings(patch);
      publishAppEvent({ type: 'settings-changed' });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ru.common.error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ru.settings.calculationTitle}</CardTitle>
        <CardDescription>{ru.settings.calculationText}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <Field label={ru.settings.inflation}>
          {(id) => (
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              step="0.1"
              defaultValue={toPercent(settings.inflationRate)}
              data-testid="settings-inflation"
              onBlur={(event) => void save({ inflationRate: Number(event.target.value) / 100 })}
            />
          )}
        </Field>

        <Field label={ru.settings.defaultReturn}>
          {(id) => (
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              step="0.1"
              defaultValue={toPercent(settings.defaultReturnRate)}
              onBlur={(event) => void save({ defaultReturnRate: Number(event.target.value) / 100 })}
            />
          )}
        </Field>

        <Field label={ru.settings.reserveMonths}>
          {(id) => (
            <Input
              id={id}
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              max="24"
              defaultValue={settings.reserveTargetMonths}
              onBlur={(event) => void save({ reserveTargetMonths: Number(event.target.value) })}
            />
          )}
        </Field>

        {error ? (
          <p role="alert" className="text-sm text-destructive sm:col-span-3">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
