import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ru } from '@/i18n/ru';
import { detectPlatform } from '@/lib/platform';

export function InstallCard() {
  const platform = detectPlatform();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ru.settings.installTitle}</CardTitle>
        <CardDescription>{ru.settings.installText}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p className={platform.isIos ? 'font-medium' : 'text-muted-foreground'}>{ru.settings.installIos}</p>
        <p className={platform.isSafari && !platform.isIos ? 'font-medium' : 'text-muted-foreground'}>
          {ru.settings.installMac}
        </p>
        <p className={!platform.isSafari && !platform.isIos ? 'font-medium' : 'text-muted-foreground'}>
          {ru.settings.installOther}
        </p>
      </CardContent>
    </Card>
  );
}
