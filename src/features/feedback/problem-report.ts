import { fill } from '@/features/deductions/fill';
import { ru } from '@/i18n/ru';

const t = ru.feedback;

/**
 * A message about a problem. The app only prepares the letter: the person sends it from their own
 * mail and sees every word of it first. Besides their text it may carry where and on what the
 * problem happened, never anything of the data: no sums, no names, no counts.
 */
export interface ReportEnvironment {
  readonly version: string;
  /** The address inside the app, e.g. /plan?step=7: no data lives in it. */
  readonly page: string;
  readonly userAgent: string;
  readonly width: number;
  readonly height: number;
  /** Below the width where the tab bar keeps one name only. */
  readonly narrowScreen: boolean;
  readonly installed: boolean;
  readonly theme: 'light' | 'dark';
  readonly lastError: string | null;
}

/** A browser as people call it, with its major version, and the system under it: "Chrome 140, Android". */
export function browserOf(userAgent: string): string {
  const browsers: readonly [RegExp, string][] = [
    [/YaBrowser\/(\d+)/, 'Яндекс Браузер'],
    [/SamsungBrowser\/(\d+)/, 'Samsung Internet'],
    [/(?:OPR|OPiOS)\/(\d+)/, 'Opera'],
    [/Edg(?:A|iOS)?\/(\d+)/, 'Edge'],
    [/(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'],
    [/(?:Chrome|CriOS)\/(\d+)/, 'Chrome'],
    [/Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari\//, 'Safari'],
  ];
  const systems: readonly [RegExp, string][] = [
    [/Android/, 'Android'],
    [/iPhone|iPad|iPod/, 'iOS'],
    [/Windows/, 'Windows'],
    [/CrOS/, 'ChromeOS'],
    [/Macintosh|Mac OS X/, 'macOS'],
    [/Linux/, 'Linux'],
  ];

  let browser: string | null = null;
  for (const [pattern, name] of browsers) {
    const match = pattern.exec(userAgent);
    if (match) {
      browser = `${name} ${match[1]}`;
      break;
    }
  }
  const system = systems.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;

  const parts = [browser, system].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(', ') : t.unknownBrowser;
}

/** What goes with the text, one fact a line, exactly as the dialog shows it. */
export function technicalLines(env: ReportEnvironment): string[] {
  return [
    fill(t.version, { value: env.version }),
    fill(t.page, { value: env.page }),
    fill(t.device, {
      kind: env.narrowScreen ? t.phone : t.computer,
      width: Math.round(env.width),
      height: Math.round(env.height),
    }),
    fill(t.browser, { value: browserOf(env.userAgent) }),
    fill(t.opened, { value: env.installed ? t.installedApp : t.browserTab }),
    fill(t.theme, { value: env.theme === 'dark' ? t.themeDark : t.themeLight }),
    fill(t.lastError, { value: env.lastError ?? t.noError }),
  ];
}

/** The letter: the person's own words first, the technical lines after them when they chose to attach them. */
export function reportBody(message: string, lines: readonly string[] | null): string {
  const text = message.trim();
  if (!lines || lines.length === 0) return text;
  return [text, '', t.technical, ...lines].join('\n');
}

export function reportSubject(version: string): string {
  return fill(t.subject, { version });
}

/** A mailto link as RFC 6068 asks: every line break is CRLF, every part percent-encoded. */
export function mailtoHref(email: string, subject: string, body: string): string {
  const encode = (value: string) => encodeURIComponent(value.replace(/\r?\n/g, '\r\n'));
  return `mailto:${email}?subject=${encode(subject)}&body=${encode(body)}`;
}
