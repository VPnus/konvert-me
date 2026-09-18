import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useHand } from '@/hooks/use-hand';
import { strings } from '@/i18n';
import { writeHand, type Hand } from '@/lib/hand';

const OPTIONS: readonly { readonly hand: Hand; readonly label: string }[] = [
  { hand: 'right', label: strings.settings.handRight },
  { hand: 'left', label: strings.settings.handLeft },
];

/**
 * The side the tabs of a phone stand on: the choice applies at once and stays on this device. The
 * card itself is for a phone only — on a wide screen the tabs stand above the page, and a choice of
 * the hand there would mean nothing. The same breakpoint as the rail of the tabs.
 */
export function HandCard() {
  const hand = useHand();

  return (
    <Card data-testid="hand-card" className="md:hidden">
      <CardHeader>
        <CardTitle>{strings.settings.handTitle}</CardTitle>
        <CardDescription>{strings.settings.handText}</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="group" aria-label={strings.settings.handTitle} className="flex flex-col gap-2 sm:flex-row">
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
