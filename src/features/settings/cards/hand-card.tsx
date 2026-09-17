import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useHand } from '@/hooks/use-hand';
import { ru } from '@/i18n/ru';
import { writeHand, type Hand } from '@/lib/hand';

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
        <div role="group" aria-label={ru.settings.handTitle} className="flex flex-col gap-2 sm:flex-row">
          {OPTIONS.map((option) => (
            <Button
              key={option.hand}
              variant={hand === option.hand ? 'default' : 'outline'}
              aria-pressed={hand === option.hand}
              className="h-auto min-h-10 flex-1 py-2 whitespace-normal"
              data-testid={`hand-${option.hand}`}
              onClick={() => writeHand(option.hand)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
