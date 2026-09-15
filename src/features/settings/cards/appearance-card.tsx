import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/components/theme/theme-provider';
import { ru } from '@/i18n/ru';

export function AppearanceCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ru.settings.appearanceTitle}</CardTitle>
        <CardDescription>{ru.settings.appearanceText}</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button
          size="sm"
          variant={theme === 'dark' ? 'default' : 'outline'}
          onClick={() => setTheme('dark')}
          aria-pressed={theme === 'dark'}
        >
          {ru.theme.dark}
        </Button>
        <Button
          size="sm"
          variant={theme === 'light' ? 'default' : 'outline'}
          onClick={() => setTheme('light')}
          aria-pressed={theme === 'light'}
        >
          {ru.theme.light}
        </Button>
      </CardContent>
    </Card>
  );
}
