import * as Dialog from '@radix-ui/react-dialog';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { formatForecast } from '@/core/money';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { Account, Category } from '@/db/models';
import { importTransactions, type ImportedRow } from '@/db/repositories/transactions';
import { ru } from '@/i18n/ru';
import { decodeStatement } from '@/lib/statement/decode';
import { guessMapping, isMappingReady, type ColumnMapping } from '@/lib/statement/mapping';
import {
  applyRules,
  buildRows,
  markDuplicates,
  type CategoryRule,
  type DuplicateState,
  type ExistingOperation,
  type StatementRow,
} from '@/lib/statement/rows';
import { parseCsv, parseXlsx, type RawTable } from '@/lib/statement/table';

type Step = 'file' | 'columns' | 'preview';

interface ImportWizardProps {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly existing: readonly ExistingOperation[];
  readonly onOpenChange: (open: boolean) => void;
}

function columnOptions(headers: readonly string[]): { value: string; label: string }[] {
  return headers.map((header, index) => ({
    value: String(index),
    label: header || `${index + 1}`,
  }));
}

/**
 * File → columns → what will be added. The parsing libraries live in this chunk, so
 * nothing of them is downloaded until somebody imports a statement.
 */
export default function ImportWizard({ accounts, categories, existing, onOpenChange }: ImportWizardProps) {
  const expenses = categories.filter((category) => category.kind === 'expense');
  const incomes = categories.filter((category) => category.kind === 'income');

  const [step, setStep] = useState<Step>('file');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [table, setTable] = useState<RawTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [keyword, setKeyword] = useState('');
  const [ruleCategory, setRuleCategory] = useState(expenses[0]?.id ?? '');
  const [defaultExpense, setDefaultExpense] = useState(
    expenses.find((category) => category.id === 'other-variable')?.id ?? expenses[0]?.id ?? '',
  );
  const [defaultIncome, setDefaultIncome] = useState(
    incomes.find((category) => category.id === 'other-income')?.id ?? incomes[0]?.id ?? '',
  );
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState<number | null>(null);

  const readFile = async (file: File) => {
    setError(null);
    setBusy(true);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = file.name.toLowerCase().endsWith('.xlsx')
        ? await parseXlsx(buffer)
        : parseCsv(decodeStatement(buffer));

      if (parsed.rows.length === 0) {
        setTable(null);
        setError(ru.import.emptyFile);
        return;
      }

      setTable(parsed);
      setMapping(guessMapping(parsed));
    } catch (cause) {
      setTable(null);
      setError(`${ru.import.readFailed}: ${cause instanceof Error ? cause.message : ''}`);
    } finally {
      setBusy(false);
    }
  };

  const built = table && mapping ? buildRows(table, mapping) : null;
  const rows: StatementRow[] = built?.rows ?? [];
  const duplicates = markDuplicates(rows, existing);

  const categoryFor = (row: StatementRow): string =>
    applyRules(row.note, rules) ?? (row.kind === 'income' ? defaultIncome : defaultExpense);

  const isTaken = (row: StatementRow): boolean =>
    !excluded.has(row.index) && duplicates.get(row.index) !== 'exact';

  const taken = rows.filter(isTaken);
  const incomeMinor = taken
    .filter((row) => row.kind === 'income')
    .reduce((total, row) => total + row.amountMinor, 0);
  const expenseMinor = taken
    .filter((row) => row.kind === 'expense')
    .reduce((total, row) => total + row.amountMinor, 0);

  const matchesOf = (rule: CategoryRule): number =>
    rows.filter((row) => applyRules(row.note, [rule]) !== null).length;

  const addRule = () => {
    if (!keyword.trim() || !ruleCategory) return;
    setRules((current) => [...current, { keyword: keyword.trim(), categoryId: ruleCategory }]);
    setKeyword('');
  };

  const toggleRow = (index: number) => {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);

    const payload: ImportedRow[] = taken.map((row) => ({
      date: row.date,
      amountMinor: row.amountMinor,
      kind: row.kind,
      accountId,
      categoryId: categoryFor(row),
      note: row.note || undefined,
      importRowHash: row.hash,
    }));

    try {
      const result = await importTransactions(payload);
      setImported(result.imported);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ru.common.error);
    } finally {
      setBusy(false);
    }
  };

  const options = columnOptions(table?.headers ?? []);
  const patchMapping = (patch: Partial<ColumnMapping>) =>
    setMapping((current) => (current ? { ...current, ...patch } : current));

  const columnSelect = (
    label: string,
    value: number | null,
    onPick: (index: number | null) => void,
    testId: string,
    optional = true,
  ) => (
    <Field label={label}>
      {(id) => (
        <Select
          id={id}
          value={value === null || value < 0 ? '' : String(value)}
          data-testid={testId}
          onChange={(event) => onPick(event.target.value === '' ? null : Number(event.target.value))}
        >
          {optional ? <option value="">{ru.import.columnNone}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold">{ru.import.title}</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {ru.import.subtitle}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={ru.nav.close}
              data-testid="import-dismiss"
              className="rounded-md p-1 hover:bg-accent"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>

          {imported === null ? (
            <ol className="mt-3 flex gap-2 text-xs text-muted-foreground">
              {(['file', 'columns', 'preview'] as const).map((name, index) => (
                <li
                  key={name}
                  className={step === name ? 'font-semibold text-foreground' : undefined}
                  data-testid={`import-step-${name}`}
                >
                  {index + 1}.{' '}
                  {name === 'file'
                    ? ru.import.stepFile
                    : name === 'columns'
                      ? ru.import.stepColumns
                      : ru.import.stepPreview}
                </li>
              ))}
            </ol>
          ) : null}

          {imported !== null ? (
            <div className="mt-6 flex flex-col items-start gap-3">
              <p className="text-sm" data-testid="import-done">
                {ru.import.done.replace('{count}', String(imported))}
              </p>
              <Button size="sm" data-testid="import-close" onClick={() => onOpenChange(false)}>
                {ru.import.close}
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {step === 'file' ? (
                <>
                  <Field label={ru.import.file} hint={ru.import.fileHint}>
                    {(id) => (
                      <input
                        id={id}
                        type="file"
                        accept=".csv,.txt,.xlsx,text/csv"
                        data-testid="import-file"
                        className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void readFile(file);
                        }}
                      />
                    )}
                  </Field>

                  <Field label={ru.import.account} hint={ru.import.accountHint}>
                    {(id) => (
                      <Select
                        id={id}
                        value={accountId}
                        data-testid="import-account"
                        onChange={(event) => setAccountId(event.target.value)}
                      >
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>

                  {busy ? <p className="text-sm text-muted-foreground">{ru.import.reading}</p> : null}
                  {table ? (
                    <p className="text-sm text-muted-foreground" data-testid="import-found">
                      {ru.import.foundRows.replace('{count}', String(table.rows.length))}
                    </p>
                  ) : null}
                </>
              ) : null}

              {step === 'columns' && mapping ? (
                <>
                  <p className="text-xs text-muted-foreground">{ru.import.columnsHint}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {columnSelect(
                      ru.import.columnDate,
                      mapping.date,
                      (index) => patchMapping({ date: index ?? -1 }),
                      'import-column-date',
                      false,
                    )}
                    {columnSelect(
                      ru.import.columnAmount,
                      mapping.amount,
                      (index) => patchMapping({ amount: index, income: null, expense: null }),
                      'import-column-amount',
                    )}
                    {columnSelect(
                      ru.import.columnIncome,
                      mapping.income,
                      (index) => patchMapping({ income: index, amount: null }),
                      'import-column-income',
                    )}
                    {columnSelect(
                      ru.import.columnExpense,
                      mapping.expense,
                      (index) => patchMapping({ expense: index, amount: null }),
                      'import-column-expense',
                    )}
                    {columnSelect(
                      ru.import.columnNote,
                      mapping.note,
                      (index) => patchMapping({ note: index }),
                      'import-column-note',
                    )}
                  </div>

                  {isMappingReady(mapping) ? null : (
                    <p className="text-sm text-destructive">{ru.import.columnsIncomplete}</p>
                  )}
                </>
              ) : null}

              {step === 'preview' ? (
                <>
                  <section className="flex flex-col gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">{ru.import.rulesTitle}</h3>
                      <p className="text-xs text-muted-foreground">{ru.import.rulesHint}</p>
                    </div>

                    {rules.length > 0 ? (
                      <ul className="flex flex-col gap-1">
                        {rules.map((rule, index) => (
                          <li
                            key={`${rule.keyword}:${index}`}
                            className="flex items-center justify-between gap-2 text-sm"
                            data-testid="import-rule"
                          >
                            <span className="min-w-0 truncate">
                              «{rule.keyword}» →{' '}
                              {categories.find((category) => category.id === rule.categoryId)?.name ?? '—'}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {ru.import.ruleMatches.replace('{count}', String(matchesOf(rule)))}
                              </span>
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 shrink-0"
                              aria-label={`${ru.import.ruleRemove}: ${rule.keyword}`}
                              onClick={() => setRules((current) => current.filter((_, at) => at !== index))}
                            >
                              <X className="size-4" aria-hidden />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <Input
                        value={keyword}
                        aria-label={ru.import.ruleKeyword}
                        placeholder={ru.import.ruleKeyword}
                        data-testid="import-rule-keyword"
                        onChange={(event) => setKeyword(event.target.value)}
                      />
                      <Select
                        value={ruleCategory}
                        aria-label={ru.import.ruleCategory}
                        data-testid="import-rule-category"
                        onChange={(event) => setRuleCategory(event.target.value)}
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </Select>
                      <Button size="sm" variant="outline" data-testid="import-rule-add" onClick={addRule}>
                        <Plus className="size-4" aria-hidden />
                        {ru.import.ruleAdd}
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={ru.import.defaultExpense}>
                        {(id) => (
                          <Select
                            id={id}
                            value={defaultExpense}
                            data-testid="import-default-expense"
                            onChange={(event) => setDefaultExpense(event.target.value)}
                          >
                            {expenses.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>

                      <Field label={ru.import.defaultIncome}>
                        {(id) => (
                          <Select
                            id={id}
                            value={defaultIncome}
                            data-testid="import-default-income"
                            onChange={(event) => setDefaultIncome(event.target.value)}
                          >
                            {incomes.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                    </div>
                  </section>

                  <section className="flex flex-col gap-2 border-t border-border pt-3">
                    <div>
                      <h3 className="text-sm font-semibold">{ru.import.previewTitle}</h3>
                      <p className="text-xs text-muted-foreground">{ru.import.previewHint}</p>
                    </div>

                    <ul className="max-h-64 overflow-y-auto">
                      {rows.map((row) => {
                        const state: DuplicateState = duplicates.get(row.index) ?? 'none';
                        const category = categories.find((item) => item.id === categoryFor(row));

                        return (
                          <li
                            key={row.hash}
                            className="flex items-center gap-2 border-b border-border/60 py-1.5 text-sm last:border-b-0"
                            data-testid="import-row"
                          >
                            <input
                              type="checkbox"
                              checked={isTaken(row)}
                              disabled={state === 'exact'}
                              className="size-4 shrink-0 accent-[var(--color-primary)]"
                              aria-label={`${row.date} ${row.note}`}
                              data-testid={`import-row-${row.index}`}
                              onChange={() => toggleRow(row.index)}
                            />
                            <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
                              {row.date}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              {row.note || '—'}
                              <span className="ml-2 text-xs text-muted-foreground">{category?.name}</span>
                              {state === 'exact' ? (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {ru.import.duplicateExact}
                                </span>
                              ) : null}
                              {state === 'possible' ? (
                                <span className="ml-2 text-xs text-warning" data-testid="import-possible">
                                  {ru.import.duplicatePossible}
                                </span>
                              ) : null}
                            </span>
                            <span
                              className={`shrink-0 tabular-nums ${row.kind === 'expense' ? 'text-destructive' : ''}`}
                            >
                              {row.kind === 'expense' ? '−' : '+'}
                              {formatForecast(row.amountMinor, { withCurrency: false })}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    <p className="text-xs text-muted-foreground">{ru.import.duplicateHint}</p>
                    {built && built.skipped > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {ru.import.skipped.replace('{count}', String(built.skipped))}
                      </p>
                    ) : null}

                    <p className="text-sm font-medium" data-testid="import-summary">
                      {ru.import.summary
                        .replace('{count}', String(taken.length))
                        .replace('{income}', formatForecast(incomeMinor))
                        .replace('{expense}', formatForecast(expenseMinor))}
                    </p>

                    {rows.length > 0 && taken.length === 0 ? (
                      <p className="text-sm text-muted-foreground" data-testid="import-nothing">
                        {ru.import.nothingToImport}
                      </p>
                    ) : null}
                  </section>
                </>
              ) : null}

              {error ? (
                <p role="alert" className="text-sm text-destructive" data-testid="import-error">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                {step !== 'file' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="import-back"
                    onClick={() => setStep(step === 'preview' ? 'columns' : 'file')}
                  >
                    {ru.import.back}
                  </Button>
                ) : null}

                {step === 'preview' ? (
                  <Button
                    size="sm"
                    disabled={busy || taken.length === 0 || !accountId}
                    data-testid="import-confirm"
                    onClick={() => void confirm()}
                  >
                    {busy ? ru.import.importing : ru.import.confirm}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={
                      step === 'file'
                        ? !table || !accountId
                        : !mapping || !isMappingReady(mapping) || rows.length === 0
                    }
                    data-testid="import-next"
                    onClick={() => setStep(step === 'file' ? 'columns' : 'preview')}
                  >
                    {ru.import.next}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
