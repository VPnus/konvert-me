import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { strings } from '@/i18n';
import { currentLanguage, writeLanguage, LANGUAGES } from '@/i18n/locale';

/**
 * The language of the interface. One dictionary is loaded before anything is drawn, so another
 * language takes a reload — the page says so and reloads itself.
 */
export function LanguageCard() {
  const current = currentLanguage();

  return (
    <Card data-testid="language-card">
      <CardHeader>
        <CardTitle>{strings.settings.languageTitle}</CardTitle>
        <CardDescription>{strings.settings.languageText}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="group"
          aria-label={strings.settings.languageTitle}
          className="flex flex-col gap-2 sm:flex-row"
        >
          {LANGUAGES.map((language) => (
            <Button
              key={language}
              variant={language === current ? 'default' : 'outline'}
              aria-pressed={language === current}
              className="h-auto min-h-10 flex-1 py-2 whitespace-normal"
              data-testid={`language-${language}`}
              onClick={() => {
                if (language === current) return;
                writeLanguage(language);
                window.location.reload();
              }}
            >
              {strings.languages[language]}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
