import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, ArchiveRestore, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { Category } from '@/db/models';
import { createCategory, listCategories, setCategoryArchived } from '@/db/repositories/categories';
import { fill } from '@/features/deductions/fill';
import { useDataVersion } from '@/hooks/use-data-version';
import { ru } from '@/i18n/ru';

const t = ru.categories;

type Group = keyof typeof t.groups;

const groupOf = (category: Category): Group =>
  category.kind === 'income' ? 'income' : category.group === 'mandatory' ? 'mandatory' : 'variable';

/** The categories of the budget: one of one's own is added here, a needless one goes to the archive. */
export function CategoriesCard() {
  const dataVersion = useDataVersion();
  const categories = useLiveQuery(() => listCategories({ includeArchived: true }), [dataVersion]);
  const [name, setName] = useState('');
  const [group, setGroup] = useState<Group>('variable');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);

  if (!categories) return null;
  const active = categories.filter((category) => !category.archived);
  const archived = categories.filter((category) => category.archived);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await createCategory({
        name,
        kind: group === 'income' ? 'income' : 'expense',
        group: group === 'income' ? undefined : group,
      });
      setName('');
      setMessage({ text: fill(t.added, { name: created.name }), error: false });
    } catch (cause) {
      setMessage({ text: cause instanceof Error ? cause.message : ru.common.error, error: true });
    } finally {
      setBusy(false);
    }
  };

  const row = (category: Category) => (
    <li key={category.id} className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="min-w-0 truncate">{category.name}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`${category.archived ? t.restore : t.archive}: ${category.name}`}
        data-testid={`category-archive-${category.name}`}
        onClick={() => void setCategoryArchived(category.id, !category.archived)}
      >
        {category.archived ? (
          <ArchiveRestore className="size-4" aria-hidden />
        ) : (
          <Archive className="size-4" aria-hidden />
        )}
      </Button>
    </li>
  );

  return (
    <Card data-testid="categories-card">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">{t.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{t.lead}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-3">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => void add(event)}>
          <Field label={t.name} className="flex-1">
            {(id) => (
              <Input
                id={id}
                value={name}
                required
                maxLength={120}
                placeholder={t.namePlaceholder}
                data-testid="category-name"
                onChange={(event) => {
                  setName(event.target.value);
                  setMessage(null);
                }}
              />
            )}
          </Field>
          <Field label={t.kind}>
            {(id) => (
              <Select
                id={id}
                value={group}
                data-testid="category-group"
                onChange={(event) => setGroup(event.target.value as Group)}
              >
                {(Object.keys(t.groups) as Group[]).map((key) => (
                  <option key={key} value={key}>
                    {t.groups[key]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Button type="submit" disabled={busy} data-testid="category-add">
            <Plus className="size-4" aria-hidden />
            {t.add}
          </Button>
        </form>

        <p
          role="status"
          data-testid="category-message"
          className={`text-sm empty:hidden ${message?.error ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {message?.text ?? ''}
        </p>

        <Button
          variant="ghost"
          size="sm"
          className="w-fit px-0"
          aria-expanded={shown}
          data-testid="categories-toggle"
          onClick={() => setShown(!shown)}
        >
          {fill(t.show, { count: active.length })}
        </Button>
        {shown ? (
          <div data-testid="categories-list">
            <div className="grid gap-4 sm:grid-cols-3">
              {(Object.keys(t.groups) as Group[]).map((key) => (
                <div key={key}>
                  <p className="text-xs font-medium text-muted-foreground">{t.groups[key]}</p>
                  <ul>{active.filter((category) => groupOf(category) === key).map(row)}</ul>
                </div>
              ))}
            </div>
            {archived.length > 0 ? (
              <div className="mt-2">
                <p className="text-xs font-medium text-muted-foreground">{t.archived}</p>
                <ul>{archived.map(row)}</ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
