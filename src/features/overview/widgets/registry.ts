/**
 * The catalogue of dashboard widgets. Every entry knows its sizes, its empty state
 * (inside the component) and how it is called in the interface.
 */

import { z } from 'zod';

import {
  DebtBurdenWidget,
  FreeCashWidget,
  NetWorthWidget,
  ReserveWidget,
} from '@/features/overview/widgets/basic-widgets';
import { GoalProgressWidget, GoalsWidget, WarningsWidget } from '@/features/overview/widgets/goal-widgets';
import { QuickAddWidget } from '@/features/overview/widgets/quick-add-widget';
import { LinksWidget, NewsWidget } from '@/features/overview/widgets/source-widgets';
import type { WidgetDefinition } from '@/features/overview/widgets/types';
import { ru } from '@/i18n/ru';

export const goalWidgetSettingsSchema = z.object({ goalId: z.string().optional() });

export const WIDGET_REGISTRY: readonly WidgetDefinition[] = [
  {
    type: 'free-cash',
    title: ru.widgets.freeCash.title,
    description: ru.widgets.freeCash.description,
    sizes: ['S', 'M', 'L'],
    defaultSize: 'M',
    Component: FreeCashWidget,
  },
  {
    type: 'reserve',
    title: ru.widgets.reserve.title,
    description: ru.widgets.reserve.description,
    sizes: ['S', 'M', 'L'],
    defaultSize: 'M',
    Component: ReserveWidget,
  },
  {
    type: 'goal-progress',
    title: ru.widgets.goalProgress.title,
    description: ru.widgets.goalProgress.description,
    sizes: ['S', 'M'],
    defaultSize: 'M',
    Component: GoalProgressWidget,
    repeatable: true,
  },
  {
    type: 'goals',
    title: ru.widgets.goals.title,
    description: ru.widgets.goals.description,
    sizes: ['M', 'L'],
    defaultSize: 'L',
    Component: GoalsWidget,
  },
  {
    type: 'net-worth',
    title: ru.widgets.netWorth.title,
    description: ru.widgets.netWorth.description,
    sizes: ['S', 'M'],
    defaultSize: 'S',
    Component: NetWorthWidget,
  },
  {
    type: 'debt-burden',
    title: ru.widgets.debtBurden.title,
    description: ru.widgets.debtBurden.description,
    sizes: ['S', 'M'],
    defaultSize: 'S',
    Component: DebtBurdenWidget,
  },
  {
    type: 'warnings',
    title: ru.widgets.warnings.title,
    description: ru.widgets.warnings.description,
    sizes: ['M', 'L'],
    defaultSize: 'M',
    Component: WarningsWidget,
  },
  {
    type: 'links',
    title: ru.widgets.links.title,
    description: ru.widgets.links.description,
    sizes: ['S', 'M', 'L'],
    defaultSize: 'M',
    Component: LinksWidget,
  },
  {
    type: 'news',
    title: ru.widgets.news.title,
    description: ru.widgets.news.description,
    sizes: ['M', 'L'],
    defaultSize: 'M',
    Component: NewsWidget,
  },
  {
    type: 'quick-add',
    title: ru.widgets.quickAdd.title,
    description: ru.widgets.quickAdd.description,
    sizes: ['S', 'M'],
    defaultSize: 'M',
    Component: QuickAddWidget,
  },
];

export function findWidget(type: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY.find((widget) => widget.type === type);
}
