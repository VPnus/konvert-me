import {
  ArrowRight,
  ClipboardList,
  Landmark,
  Laptop,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Tablet,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { SITE } from '@/app/site';
import { buttonVariants } from '@/components/ui/button';
import { SiteFrame } from '@/features/site/site-frame';
import { ru } from '@/i18n/ru';

type FeatureKey = (typeof ru.site.landing.features)[number]['key'];
type InstallKey = (typeof ru.site.landing.install)[number]['key'];

const FEATURE_ICONS: Record<FeatureKey, LucideIcon> = {
  budget: Wallet,
  goals: Target,
  envelopes: PiggyBank,
  balance: Landmark,
  deductions: ReceiptText,
  plan: ClipboardList,
};

const INSTALL_ICONS: Record<InstallKey, LucideIcon> = {
  android: Smartphone,
  iphone: Tablet,
  computer: Laptop,
};

const section = 'mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16';
const heading = 'text-2xl font-semibold tracking-tight md:text-3xl';

/**
 * What Konverkot is, for someone who has not opened it yet: what it counts, where the data lives,
 * how to install it. One way on from every screen of it: into the onboarding.
 */
export default function LandingPage() {
  const t = ru.site.landing;

  return (
    <SiteFrame action={{ to: '/welcome', label: t.start, testId: 'landing-header-start' }}>
      <main>
        <section
          className={`${section} grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-center`}
        >
          <div className="flex flex-col items-start gap-5">
            <p className="text-sm font-medium text-muted-foreground">{t.eyebrow}</p>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{t.title}</h1>
            <p className="text-base md:text-lg">{t.lead}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/welcome" className={buttonVariants({ size: 'lg' })} data-testid="landing-start">
                {t.start}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a href="#features" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
                {t.more}
              </a>
            </div>
            <p className="text-sm text-muted-foreground">{t.startNote}</p>
          </div>
          <img
            src="/landing/overview.png"
            alt={t.overviewAlt}
            width={1280}
            height={860}
            className="h-auto w-full rounded-xl border border-border shadow-sm"
          />
        </section>

        <section
          id="features"
          aria-labelledby="landing-features"
          className="scroll-mt-16 border-t border-border"
        >
          <div className={section}>
            <h2 id="landing-features" className={heading}>
              {t.featuresTitle}
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {t.features.map((feature) => {
                const Icon = FEATURE_ICONS[feature.key];
                return (
                  <li key={feature.key} className="rounded-xl border border-border bg-card p-5">
                    <Icon className="size-6" aria-hidden />
                    <h3 className="mt-3 font-semibold">{feature.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{feature.text}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="landing-plan"
          className={`${section} grid gap-8 border-t border-border md:grid-cols-2 md:items-center`}
        >
          <div className="flex flex-col gap-3">
            <h2 id="landing-plan" className={heading}>
              {t.planTitle}
            </h2>
            <p className="text-base text-muted-foreground">{t.planText}</p>
          </div>
          <img
            src="/landing/plan.png"
            alt={t.planAlt}
            width={1280}
            height={860}
            loading="lazy"
            className="h-auto w-full rounded-xl border border-border shadow-sm"
          />
        </section>

        <section aria-labelledby="landing-privacy" className="border-t border-border">
          <div className={`${section} flex flex-col gap-5`}>
            <h2 id="landing-privacy" className={heading}>
              {t.privacyTitle}
            </h2>
            <ul className="flex flex-col gap-3">
              {t.privacyPoints.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
              {t.privacyWarning}
            </p>
            <Link
              to="/privacy"
              className="text-sm underline underline-offset-2"
              data-testid="landing-privacy"
            >
              {ru.site.privacyLink}
            </Link>
          </div>
        </section>

        <section aria-labelledby="landing-install" className="border-t border-border">
          <div className={section}>
            <h2 id="landing-install" className={heading}>
              {t.installTitle}
            </h2>
            <p className="mt-3 text-base text-muted-foreground">{t.installText}</p>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {t.install.map((way) => {
                const Icon = INSTALL_ICONS[way.key];
                return (
                  <li key={way.key} className="rounded-xl border border-border bg-card p-5">
                    <Icon className="size-6" aria-hidden />
                    <h3 className="mt-3 font-semibold">{way.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{way.text}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {SITE.pilotActive ? (
          <section
            aria-labelledby="landing-pilot"
            className="border-t border-border"
            data-testid="landing-pilot"
          >
            <div className={`${section} flex flex-col items-start gap-4`}>
              <h2 id="landing-pilot" className={heading}>
                {t.pilotTitle}
              </h2>
              <p className="text-base text-muted-foreground">{t.pilotText}</p>
              <div className="flex flex-wrap gap-3">
                <Link to="/welcome" className={buttonVariants()}>
                  {t.start}
                </Link>
                {SITE.feedbackFormUrl ? (
                  <a
                    href={SITE.feedbackFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: 'outline' })}
                  >
                    {t.pilotForm}
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </SiteFrame>
  );
}
