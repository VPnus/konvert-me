import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { strings } from '@/i18n';
import { detectPlatform } from '@/lib/platform';

export function InstallCard() {
  const platform = detectPlatform();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{strings.settings.installTitle}</CardTitle>
        <CardDescription>{strings.settings.installText}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p className={platform.isIos ? 'font-medium' : 'text-muted-foreground'}>
          {strings.settings.installIos}
        </p>
        <p className={platform.isSafari && !platform.isIos ? 'font-medium' : 'text-muted-foreground'}>
          {strings.settings.installMac}
        </p>
        <p className={!platform.isSafari && !platform.isIos ? 'font-medium' : 'text-muted-foreground'}>
          {strings.settings.installOther}
        </p>
      </CardContent>
    </Card>
  );
}
