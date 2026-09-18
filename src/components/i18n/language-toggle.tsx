import { Button } from '@/components/ui/button';
import { fill, strings } from '@/i18n';
import { currentLanguage, writeLanguage, LANGUAGES } from '@/i18n/locale';

/**
 * The language of the page in one press, where there is no room for the card of the settings: the
 * header of the site and of the introduction. One dictionary is loaded before anything is drawn, so
 * the other language takes a reload.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const current = currentLanguage();
  const other = LANGUAGES.find((language) => language !== current) ?? current;
  const label = fill(strings.languageSwitch, { language: strings.languages[other] });

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      data-testid="language-toggle"
      data-language={other}
      className={className}
      onClick={() => {
        writeLanguage(other);
        window.location.reload();
      }}
    >
      <span className="text-sm font-semibold" aria-hidden>
        {other.toUpperCase()}
      </span>
    </Button>
  );
}
