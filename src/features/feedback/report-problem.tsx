import * as Dialog from '@radix-ui/react-dialog';
import { Bug, Copy, Mail } from 'lucide-react';
import { useId, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { SITE } from '@/app/site';
import { useTheme } from '@/components/theme/theme-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  mailtoHref,
  reportBody,
  reportSubject,
  technicalLines,
  type ReportEnvironment,
} from '@/features/feedback/problem-report';
import { fill, strings } from '@/i18n';
import { copyText } from '@/lib/clipboard';
import { lastErrorMessage } from '@/lib/last-error';
import { isStandaloneDisplay } from '@/lib/platform';

const t = strings.feedback;
const MAX_MESSAGE = 1000;
/** The same width the tab bar and the pilot stats call a phone. */
const NARROW_SCREEN = '(max-width: 767px)';

function useEnvironment(): ReportEnvironment {
  const { pathname, search } = useLocation();
  const { theme } = useTheme();

  return {
    version: __APP_VERSION__,
    page: `${pathname}${search}`,
    userAgent: navigator.userAgent,
    width: window.innerWidth,
    height: window.innerHeight,
    narrowScreen: window.matchMedia?.(NARROW_SCREEN).matches ?? false,
    installed: isStandaloneDisplay(),
    theme,
    lastError: lastErrorMessage(),
  };
}

function ReportDialog({ email, onOpenChange }: { email: string; onOpenChange: (open: boolean) => void }) {
  const environment = useEnvironment();
  const [message, setMessage] = useState('');
  const [attach, setAttach] = useState(true);
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null);
  const messageId = useId();

  const lines = technicalLines(environment);
  const body = reportBody(message, attach ? lines : null);
  const subject = reportSubject(environment.version);
  const ready = message.trim().length > 0;

  const copy = async () => {
    setCopied((await copyText(`${subject}\n\n${body}`)) ? 'done' : 'failed');
  };

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="report-dialog"
          className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
        >
          <Dialog.Title className="text-base font-semibold">{t.title}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">{t.lead}</Dialog.Description>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={messageId} className="text-sm font-medium">
                {t.message}
              </label>
              <textarea
                id={messageId}
                value={message}
                rows={5}
                maxLength={MAX_MESSAGE}
                autoFocus
                placeholder={t.placeholder}
                data-testid="report-message"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                onChange={(event) => {
                  setMessage(event.target.value);
                  setCopied(null);
                }}
              />
              <p className="text-xs text-muted-foreground">{t.noData}</p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={attach}
                className="size-4 accent-[var(--color-primary)]"
                data-testid="report-attach"
                onChange={(event) => {
                  setAttach(event.target.checked);
                  setCopied(null);
                }}
              />
              {t.attach}
            </label>

            {attach ? (
              <pre
                data-testid="report-technical"
                className="rounded-lg border border-border bg-muted/40 p-3 font-sans text-xs leading-relaxed break-words whitespace-pre-wrap"
              >
                {lines.join('\n')}
              </pre>
            ) : null}

            <p className="text-xs text-muted-foreground" data-testid="report-address">
              {fill(t.noMail, { email })}
            </p>

            <p role="status" data-testid="report-copy-status" className="text-sm empty:hidden">
              {copied === 'done' ? fill(t.copied, { email }) : copied === 'failed' ? t.copyFailed : ''}
            </p>

            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" size="sm">
                  {strings.common.cancel}
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!ready}
                data-testid="report-copy"
                onClick={() => void copy()}
              >
                <Copy className="size-4" aria-hidden />
                {t.copy}
              </Button>
              {ready ? (
                <a
                  href={mailtoHref(email, subject, body)}
                  className={buttonVariants({ size: 'sm' })}
                  data-testid="report-send"
                >
                  <Mail className="size-4" aria-hidden />
                  {t.send}
                </a>
              ) : (
                <Button type="button" size="sm" disabled data-testid="report-send">
                  <Mail className="size-4" aria-hidden />
                  {t.send}
                </Button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * The bug beside the theme toggle: a quick letter to the author about what went wrong. The app writes
 * nothing anywhere by itself; the letter leaves from the person's own mail, if they send it.
 */
export function ReportProblemButton() {
  const [open, setOpen] = useState(false);
  const email = SITE.contactEmail;
  if (!email) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t.open}
        title={t.open}
        data-testid="report-problem"
        onClick={() => setOpen(true)}
      >
        <Bug className="size-5" aria-hidden />
      </Button>
      {open ? <ReportDialog email={email} onOpenChange={setOpen} /> : null}
    </>
  );
}
