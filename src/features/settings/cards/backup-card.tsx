import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { backupCountry, summarizeBackup, type BackupFile } from '@/db/backup';
import { fill, strings } from '@/i18n';
import { currentCountry } from '@/i18n/country';
import { useSettings } from '@/hooks/use-settings';
import {
  downloadBackup,
  fileNeedsPassword,
  importBackup,
  lastBackupLabel,
  readBackupFile,
  wipeEverything,
} from '@/features/settings/backup-actions';
import { BackupFirst } from '@/features/settings/backup-first';

/**
 * The report of an import that brought another country. The session draws every screen anew for it,
 * this card included, and the card that comes back shows the report kept here.
 */
let reportAfterRedraw: string | null = null;

export function BackupCard() {
  const settings = useSettings();
  const fileInput = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  // The file read before it replaces anything, so its country is known in time for the warning.
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(() => reportAfterRedraw);
  const [error, setError] = useState<string | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);

  useEffect(() => {
    reportAfterRedraw = null;
  }, []);

  const exportNow = async () => {
    setError(null);
    try {
      await downloadBackup(password);
      setMessage(strings.settings.backupExported);
      setPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : strings.common.error);
    }
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setMessage(null);
    const encrypted = await fileNeedsPassword(file);
    setNeedsPassword(encrypted);
    setImportPassword('');
    // A broken file is refused on confirmation, as before; an encrypted one is read with its password.
    setPendingBackup(encrypted ? null : await readBackupFile(file).catch(() => null));
    setPendingFile(file);
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    setBusy(true);
    setError(null);
    try {
      const backup = pendingBackup ?? (await readBackupFile(pendingFile, importPassword || undefined));
      const otherCountry = backupCountry(backup) !== currentCountry();
      if (otherCountry && !pendingBackup) {
        // An encrypted copy names its country only now: the warning is read before the data is replaced.
        setPendingBackup(backup);
        return;
      }

      const report = `${strings.settings.backupImported} ${fill(strings.settings.backupImportedCount, { count: summarizeBackup(backup).total })}`;
      if (otherCountry) reportAfterRedraw = report;
      await importBackup(backup);
      setMessage(report);
      setPendingFile(null);
      setPendingBackup(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (cause) {
      reportAfterRedraw = null;
      setError(cause instanceof Error ? cause.message : strings.common.error);
    } finally {
      setBusy(false);
    }
  };

  const confirmWipe = async () => {
    setBusy(true);
    try {
      await wipeEverything();
      setWipeOpen(false);
      setMessage(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{strings.settings.backupTitle}</CardTitle>
        <CardDescription>{strings.settings.backupText}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground" data-testid="last-backup">
          {strings.settings.backupLast}: {lastBackupLabel(settings.lastBackupAt)}
        </p>

        <div className="flex flex-col gap-3">
          <Field
            label={`${strings.settings.backupPassword} (${strings.common.optional})`}
            hint={strings.settings.backupPasswordHint}
          >
            {(id) => (
              <Input
                id={id}
                type="password"
                value={password}
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
                data-testid="backup-password"
              />
            )}
          </Field>
          <Button className="w-fit" onClick={() => void exportNow()} data-testid="backup-export">
            {strings.settings.backupExport}
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-sm font-medium">{strings.settings.backupImport}</p>
          <p className="text-xs text-muted-foreground">{strings.settings.backupImportHint}</p>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            data-testid="backup-import"
            onChange={(event) => void chooseFile(event.target.files?.[0])}
            className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-secondary-foreground"
          />
        </div>

        {message ? (
          <p role="status" className="text-sm text-success" data-testid="backup-message">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive" data-testid="backup-error">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-sm font-medium">{strings.settings.dangerTitle}</p>
          <p className="text-xs text-muted-foreground">{strings.settings.dangerText}</p>
          <Button
            variant="destructive"
            size="sm"
            className="w-fit"
            onClick={() => setWipeOpen(true)}
            data-testid="wipe-data"
          >
            {strings.settings.dangerAction}
          </Button>
        </div>
      </CardContent>

      <ConfirmDialog
        open={pendingFile !== null}
        title={strings.settings.backupImportConfirmTitle}
        description={strings.settings.backupImportConfirmText}
        confirmLabel={strings.settings.backupImport}
        destructive
        busy={busy}
        onConfirm={() => void confirmImport()}
        onOpenChange={(open) => {
          if (open) return;
          setPendingFile(null);
          setPendingBackup(null);
        }}
      >
        <div className="flex flex-col gap-3">
          {pendingBackup && backupCountry(pendingBackup) !== currentCountry() ? (
            <p
              className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
              data-testid="backup-country-warning"
            >
              {fill(strings.settings.backupCountry, {
                country: strings.countries[backupCountry(pendingBackup)],
              })}
            </p>
          ) : null}
          <BackupFirst />
          {needsPassword ? (
            <Field label={strings.settings.backupImportPassword}>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  value={importPassword}
                  autoComplete="current-password"
                  onChange={(event) => setImportPassword(event.target.value)}
                  data-testid="import-password"
                />
              )}
            </Field>
          ) : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={wipeOpen}
        title={strings.settings.dangerConfirmTitle}
        description={strings.settings.dangerConfirmText}
        confirmLabel={strings.settings.dangerAction}
        destructive
        busy={busy}
        onConfirm={() => void confirmWipe()}
        onOpenChange={setWipeOpen}
      >
        <BackupFirst />
      </ConfirmDialog>
    </Card>
  );
}
