import { useState } from 'react';

import { parseNumericInput } from '@/lib/numeric-input';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { NumberInput } from '@/components/ui/number-input';
import { updateSettings } from '@/db/repositories/settings';
import { ru } from '@/i18n/ru';
import { useSettings } from '@/hooks/use-settings';
import { publishAppEvent } from '@/lib/broadcast';

const toPercent = (rate: number): string => String(Math.round(rate * 1000) / 10);

export function CalculationCard() {
  const settings = useSettings();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const fieldValue = (key: string, stored: string): string => draft[key] ?? stored;
  const editField = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));

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
            <NumberInput
              id={id}
              value={fieldValue('inflation', toPercent(settings.inflationRate))}
              data-testid="settings-inflation"
              onValueChange={(value) => editField('inflation', value)}
              onBlur={(event) => void save({ inflationRate: parseNumericInput(event.target.value) / 100 })}
            />
          )}
        </Field>

        <Field label={ru.settings.defaultReturn}>
          {(id) => (
            <NumberInput
              id={id}
              value={fieldValue('return', toPercent(settings.defaultReturnRate))}
              data-testid="settings-return"
              onValueChange={(value) => editField('return', value)}
              onBlur={(event) =>
                void save({ defaultReturnRate: parseNumericInput(event.target.value) / 100 })
              }
            />
          )}
        </Field>

        <Field label={ru.settings.reserveMonths}>
          {(id) => (
            <NumberInput
              id={id}
              integer
              maxLength={2}
              value={fieldValue('reserve', String(settings.reserveTargetMonths))}
              data-testid="settings-reserve-months"
              onValueChange={(value) => editField('reserve', value)}
              onBlur={(event) => void save({ reserveTargetMonths: parseNumericInput(event.target.value) })}
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
