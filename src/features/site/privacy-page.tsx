import { useEffect } from 'react';

import { SITE } from '@/app/site';
import { SiteFrame } from '@/features/site/site-frame';
import { strings } from '@/i18n';

const t = strings.site.privacy;

/** Where to ask about the data: an address, else the questionnaire, else nothing is promised. */
function Contact() {
  const link = 'underline underline-offset-2';

  if (SITE.contactEmail) {
    const [before, after] = t.contactEmail.split('{email}');
    return (
      <p className="mt-3 leading-relaxed">
        {before}
        <a href={`mailto:${SITE.contactEmail}`} className={link}>
          {SITE.contactEmail}
        </a>
        {after}
      </p>
    );
  }

  if (SITE.feedbackFormUrl) {
    return (
      <p className="mt-3 leading-relaxed">
        {t.contactForm}{' '}
        <a href={SITE.feedbackFormUrl} target="_blank" rel="noopener noreferrer" className={link}>
          {t.form}
        </a>
      </p>
    );
  }

  return null;
}

export default function PrivacyPage() {
  // A link from the bottom of the landing would otherwise open the policy at its bottom too.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <SiteFrame
      action={{
        to: '/overview',
        label: strings.site.openApp,
        shortLabel: strings.site.openAppShort,
        testId: 'privacy-open-app',
      }}
    >
      <main className="mx-auto w-full max-w-3xl px-4 py-10 text-sm md:px-8 md:py-14 md:text-base">
        {/* «конфиденциальности» is wider than a phone at 30px in a wide font (DejaVu Sans): smaller
            there, and hyphenated or broken rather than scrolled sideways on a narrower screen still */}
        <h1 className="text-2xl font-semibold tracking-tight break-words hyphens-auto sm:text-3xl">
          {t.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.edition}</p>
        <p className="mt-6 leading-relaxed font-medium">{t.summary}</p>

        {t.sections.map((part) => (
          <section key={part.key} aria-labelledby={`privacy-${part.key}`} className="mt-8">
            <h2 id={`privacy-${part.key}`} className="text-xl font-semibold tracking-tight">
              {part.title}
            </h2>
            {part.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-3 leading-relaxed">
                {paragraph}
              </p>
            ))}
            {part.key === 'changes' ? <Contact /> : null}
          </section>
        ))}
      </main>
    </SiteFrame>
  );
}
