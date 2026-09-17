import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useHand } from '@/hooks/use-hand';
import { ru } from '@/i18n/ru';
import { writeHand, type Hand } from '@/lib/hand';
import { cn } from '@/lib/utils';

const OPTIONS: readonly { readonly hand: Hand; readonly label: string }[] = [
  { hand: 'right', label: ru.settings.handRight },
  { hand: 'left', label: ru.settings.handLeft },
];

/** The side the tabs of a phone stand on: the choice applies at once and stays on this device. */
export function HandCard() {
  const hand = useHand();

  return (
    <Card data-testid="hand-card">
      <CardHeader>
        <CardTitle>{ru.settings.handTitle}</CardTitle>
        <CardDescription>{ru.settings.handText}</CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset className="flex flex-col gap-2 sm:flex-row">
          <legend className="sr-only">{ru.settings.handTitle}</legend>
          {OPTIONS.map((option) => (
            <label
              key={option.hand}
              className={cn(
                'flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                hand === option.hand ? 'border-primary bg-primary/10 font-medium' : 'border-border',
              )}
            >
              <input
                type="radio"
                name="hand"
                value={option.hand}
                checked={hand === option.hand}
                className="size-4 accent-[var(--color-primary)]"
                data-testid={`hand-${option.hand}`}
                onChange={() => writeHand(option.hand)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      </CardContent>
    </Card>
  );
}
