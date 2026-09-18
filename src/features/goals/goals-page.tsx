import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, GripVertical, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';

import { formatForecast } from '@/core/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { Goal } from '@/db/models';
import type { Allocation } from '@/core/goals';
import { deleteGoal, reorderGoals, updateGoal } from '@/db/repositories/goals';
import { monthLabel } from '@/features/budget/month-label';
import { GoalDetails } from '@/features/goals/goal-details';
import { GoalForm } from '@/features/goals/goal-form';
import { loadGoals, type GoalsData, type GoalView } from '@/features/goals/goals-data';
import { monthsLabel } from '@/features/goals/months-label';
import { useDataVersion } from '@/hooks/use-data-version';
import { fill, strings } from '@/i18n';
import { cn } from '@/lib/utils';

const DonutChart = lazy(() => import('@/components/common/donut-chart'));

function statusOf(view: GoalView): string {
  if (view.goal.status === 'done') return strings.goals.statusDone;
  if (view.goal.status === 'paused') return strings.goals.statusPaused;
  if (view.plan?.status === 'overdue') return strings.goals.statusOverdue;
  if (view.plan?.status === 'funded') return strings.goals.statusFunded;
  return strings.goals.statusActive;
}

interface GoalRowProps {
  readonly view: GoalView;
  readonly allocation: Allocation | null;
  readonly onOpen: (view: GoalView) => void;
  readonly onEdit: (goal: Goal) => void;
  readonly onDelete: (goal: Goal) => void;
}

function GoalRow({ view, allocation, onOpen, onEdit, onDelete }: GoalRowProps) {
  const { goal } = view;
  const isReserve = goal.kind === 'reserve';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: goal.id,
    disabled: isReserve,
  });

  const contribution = view.plan?.contributionMinor ?? 0;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex flex-col gap-2 border-b border-border py-3 last:border-b-0',
        isDragging && 'opacity-60',
      )}
      data-testid="goal-row"
    >
      {/* on a narrow page the sums and buttons move under the name rather than squeeze it out */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 basis-40 items-start gap-2">
          {isReserve ? (
            <span className="mt-1 size-5 shrink-0" aria-hidden />
          ) : (
            <button
              type="button"
              aria-label={`${strings.goals.drag}: ${goal.name}`}
              className="mt-0.5 cursor-grab rounded p-1 text-muted-foreground hover:bg-accent"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" aria-hidden />
            </button>
          )}

          <div className="min-w-0">
            <button
              type="button"
              className="truncate text-left text-sm font-medium underline-offset-2 hover:underline"
              data-testid={`goal-open-${goal.name}`}
              onClick={() => onOpen(view)}
            >
              {goal.name}
            </button>
            <p className="truncate text-xs text-muted-foreground">
              {goal.targetMonth ? `${monthLabel(goal.targetMonth)} · ` : ''}
              {statusOf(view)}
              {view.plan ? ` · ${monthsLabel(view.plan.months)}` : ''}
            </p>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <div className="mr-1 text-right">
            <p className="text-sm font-semibold tabular-nums" data-testid={`goal-contribution-${goal.name}`}>
              {view.plan
                ? formatForecast(contribution)
                : allocation
                  ? formatForecast(allocation.requiredMinor)
                  : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">{strings.goals.contribution}</p>
          </div>

          {isReserve ? null : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={goal.status === 'paused' ? strings.goals.resume : strings.goals.pause}
                data-testid={`goal-pause-${goal.name}`}
                onClick={() =>
                  void updateGoal(goal.id, { status: goal.status === 'paused' ? 'active' : 'paused' })
                }
              >
                {goal.status === 'paused' ? (
                  <Play className="size-4" aria-hidden />
                ) : (
                  <Pause className="size-4" aria-hidden />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={goal.status === 'done' ? strings.goals.markActive : strings.goals.markDone}
                data-testid={`goal-done-${goal.name}`}
                onClick={() =>
                  void updateGoal(goal.id, { status: goal.status === 'done' ? 'active' : 'done' })
                }
              >
                <CheckCircle2 className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`${strings.common.edit}: ${goal.name}`}
                data-testid={`goal-edit-${goal.name}`}
                onClick={() => onEdit(goal)}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`${strings.goals.remove}: ${goal.name}`}
                onClick={() => onDelete(goal)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pl-7">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.round(view.progress * 100)}%` }}
          />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatForecast(view.savedMinor)} / {formatForecast(view.costMinor)}
        </span>
      </div>

      {allocation === null ? null : (
        <p className="pl-7 text-xs text-muted-foreground" data-testid={`goal-allocated-${goal.name}`}>
          {strings.goals.allocationGets}: {formatForecast(allocation.allocatedMinor)}
          {allocation.deficitMinor > 0.5
            ? ` · ${strings.goals.allocationDeficit} ${formatForecast(allocation.deficitMinor)}`
            : ''}
        </p>
      )}
    </li>
  );
}

function AllocationCard({ data }: { data: GoalsData }) {
  const needed = data.allocations.reduce((total, item) => total + item.requiredMinor, 0);
  const basis =
    data.basis.source === 'fact'
      ? fill(strings.goals.allocationBasisFact, { months: monthsLabel(data.basis.months.length) })
      : data.basis.source === 'plan'
        ? strings.goals.allocationBasisPlan
        : strings.goals.allocationBasisMonth;

  return (
    <Card data-testid="allocation-card">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">{strings.goals.allocationTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">{strings.goals.allocationHint}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {strings.goals.allocationFree} ({basis})
            </p>
            <p
              className={cn(
                'text-sm font-semibold tabular-nums',
                data.freeCashMinor < 0 && 'text-destructive',
              )}
              data-testid="allocation-free"
            >
              {formatForecast(data.freeCashMinor)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground" title={strings.goals.allocationPrincipalHint}>
              {strings.goals.allocationPrincipal}
            </p>
            <p className="text-sm font-semibold tabular-nums" data-testid="allocation-principal">
              {formatForecast(data.principalDueMinor)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{strings.goals.allocationAvailable}</p>
            <p
              className={cn(
                'text-sm font-semibold tabular-nums',
                data.availableMinor < 0 && 'text-destructive',
              )}
              data-testid="allocation-available"
            >
              {formatForecast(data.availableMinor)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{strings.goals.allocationNeeded}</p>
            <p className="text-sm font-semibold tabular-nums" data-testid="allocation-needed">
              {formatForecast(needed)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{strings.goals.allocationLeftover}</p>
            <p className="text-sm font-semibold tabular-nums" data-testid="allocation-leftover">
              {formatForecast(data.leftoverMinor)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{strings.goals.allocationDeficit}</p>
            <p
              className={cn(
                'text-sm font-semibold tabular-nums',
                data.totalDeficitMinor > 0 && 'text-destructive',
              )}
              data-testid="allocation-deficit"
            >
              {formatForecast(data.totalDeficitMinor)}
            </p>
          </div>
        </div>

        {data.freeCashMinor > 0 ? (
          <Suspense fallback={<p className="text-sm text-muted-foreground">{strings.common.loading}</p>}>
            <DonutChart
              testId="allocation-chart"
              caption={strings.goals.allocationTitle}
              parts={[
                {
                  key: 'principal',
                  label: strings.goals.allocationPrincipal,
                  amountMinor: Math.max(0, Math.round(data.principalDueMinor)),
                },
                {
                  key: 'goals',
                  label: strings.goals.allocationToGoals,
                  amountMinor: Math.max(
                    0,
                    Math.round(data.availableMinor) - Math.max(0, Math.round(data.leftoverMinor)),
                  ),
                },
                {
                  key: 'leftover',
                  label: strings.goals.allocationLeftover,
                  amountMinor: Math.max(0, Math.round(data.leftoverMinor)),
                },
              ].filter((part) => part.amountMinor > 0)}
            />
          </Suspense>
        ) : null}

        {data.allocations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{strings.goals.allocationNone}</p>
        ) : null}

        {data.principalDueMinor > 0 ? (
          <p className="text-xs text-muted-foreground">{strings.goals.allocationPrincipalHint}</p>
        ) : null}

        {data.totalDeficitMinor > 0 ? (
          <p className="text-xs text-warning" data-testid="allocation-deficit-hint">
            {strings.goals.allocationDeficitHint}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function GoalsPage() {
  const dataVersion = useDataVersion();
  const [showDone, setShowDone] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | undefined>();
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);

  const data = useLiveQuery(() => loadGoals(), [dataVersion]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!data) {
    return <p className="text-sm text-muted-foreground">{strings.common.loading}</p>;
  }

  const visible = data.goals.filter((view) => showDone || view.goal.status !== 'done');
  const allocated = new Map(data.allocations.map((item) => [item.goalId, item]));
  const opened = data.goals.find((view) => view.goal.id === openedId) ?? null;

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = visible.map((view) => view.goal.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;

    const next = [...ids];
    next.splice(to, 0, ...next.splice(from, 1));
    void reorderGoals(next);
  };

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{strings.goals.title}</h1>
          <p className="text-sm text-muted-foreground">{strings.goals.subtitle}</p>
        </div>
        <Button onClick={openCreate} data-testid="add-goal">
          <Plus className="size-4" aria-hidden />
          {strings.goals.add}
        </Button>
      </div>

      <AllocationCard data={data} />

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">{strings.goals.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{strings.goals.priorityHint}</p>
        </CardHeader>
        <CardContent className="pt-2">
          {visible.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground" data-testid="goals-empty">
              {strings.goals.empty}
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={visible.map((view) => view.goal.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul>
                  {visible.map((view) => (
                    <GoalRow
                      key={view.goal.id}
                      view={view}
                      allocation={allocated.get(view.goal.id) ?? null}
                      onOpen={(opened) => setOpenedId(opened.goal.id)}
                      onEdit={(goal) => {
                        setEditing(goal);
                        setFormOpen(true);
                      }}
                      onDelete={setPendingDelete}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={showDone}
          className="size-4 accent-[var(--color-primary)]"
          data-testid="show-done-goals"
          onChange={(event) => setShowDone(event.target.checked)}
        />
        {strings.goals.showDone}
      </label>

      {formOpen ? (
        <GoalForm
          key={editing?.id ?? 'new'}
          goal={editing}
          settings={data.settings}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      ) : null}

      {opened ? (
        <GoalDetails
          key={opened.goal.id}
          view={opened}
          data={data}
          open
          onOpenChange={(open) => {
            if (!open) setOpenedId(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={strings.goals.deleteConfirmTitle}
        description={strings.goals.deleteConfirmText}
        confirmLabel={strings.common.delete}
        destructive
        onConfirm={() => {
          if (pendingDelete) void deleteGoal(pendingDelete.id);
          setPendingDelete(null);
        }}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      />
    </section>
  );
}
