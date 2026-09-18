/**
 * The catalogue of dashboard widgets. Every entry knows its sizes, its empty state
 * (inside the component) and how it is called in the interface.
 */

import { z } from 'zod';

import type { Country } from '@/core/country';
import { DEDUCTION_COUNTRIES } from '@/features/deductions/country';
import {
  DebtBurdenWidget,
  FreeCashWidget,
  NetWorthWidget,
  ReserveWidget,
} from '@/features/overview/widgets/basic-widgets';
import { DeductionsWidget } from '@/features/overview/widgets/deductions-widget';
import { GoalProgressWidget, GoalsWidget, WarningsWidget } from '@/features/overview/widgets/goal-widgets';
import { QuickAddWidget } from '@/features/overview/widgets/quick-add-widget';
import { TrendWidget } from '@/features/overview/widgets/trend-widget';
import { UpcomingWidget } from '@/features/overview/widgets/upcoming-widget';
import { LinksWidget, NewsWidget } from '@/features/overview/widgets/source-widgets';
import type { WidgetDefinition } from '@/features/overview/widgets/types';
import { strings } from '@/i18n';
import { currentCountry } from '@/i18n/country';

export const goalWidgetSettingsSchema = z.object({ goalId: z.string().optional() });

export const WIDGET_REGISTRY: readonly WidgetDefinition[] = [
  {
    type: 'free-cash',
    title: strings.widgets.freeCash.title,
    description: strings.widgets.freeCash.description,
    sizes: ['S', 'M', 'L'],
    defaultSize: 'M',
    Component: FreeCashWidget,
  },
  {
    type: 'reserve',
    title: strings.widgets.reserve.title,
    description: strings.widgets.reserve.description,
    sizes: ['S', 'M', 'L'],
    defaultSize: 'M',
    Component: ReserveWidget,
  },
  {
    type: 'trend',
    title: strings.widgets.trend.title,
    description: strings.widgets.trend.description,
    sizes: ['M', 'L'],
    defaultSize: 'M',
    Component: TrendWidget,
  },
  {
    type: 'goal-progress',
    title: strings.widgets.goalProgress.title,
    description: strings.widgets.goalProgress.description,
    sizes: ['S', 'M'],
    defaultSize: 'M',
    Component: GoalProgressWidget,
    repeatable: true,
  },
  {
    type: 'goals',
    title: strings.widgets.goals.title,
    description: strings.widgets.goals.description,
    sizes: ['M', 'L'],
    defaultSize: 'L',
    Component: GoalsWidget,
  },
  {
    type: 'upcoming',
    title: strings.upcoming.title,
    description: strings.upcoming.description,
    sizes: ['M', 'L'],
    defaultSize: 'M',
    Component: UpcomingWidget,
  },
  {
    type: 'deductions',
    title: strings.widgets.deductions.title,
    description: strings.widgets.deductions.description,
    sizes: ['M', 'L'],
    defaultSize: 'M',
    Component: DeductionsWidget,
    countries: DEDUCTION_COUNTRIES,
  },
  {
    type: 'net-worth',
    title: strings.widgets.netWorth.title,
    description: strings.widgets.netWorth.description,
    sizes: ['S', 'M'],
    defaultSize: 'S',
    Component: NetWorthWidget,
  },
  {
    type: 'debt-burden',
    title: strings.widgets.debtBurden.title,
    description: strings.widgets.debtBurden.description,
    sizes: ['S', 'M'],
    defaultSize: 'S',
    Component: DebtBurdenWidget,
  },
  {
    type: 'warnings',
    title: strings.widgets.warnings.title,
    description: strings.widgets.warnings.description,
    sizes: ['M', 'L'],
    defaultSize: 'M',
    Component: WarningsWidget,
  },
  {
    type: 'links',
    title: strings.widgets.links.title,
    description: strings.widgets.links.description,
    sizes: ['S', 'M', 'L'],
    defaultSize: 'M',
    Component: LinksWidget,
  },
  {
    type: 'news',
    title: strings.widgets.news.title,
    description: strings.widgets.news.description,
    sizes: ['M', 'L'],
    defaultSize: 'M',
    Component: NewsWidget,
  },
  {
    type: 'quick-add',
    title: strings.widgets.quickAdd.title,
    description: strings.widgets.quickAdd.description,
    sizes: ['S', 'M'],
    defaultSize: 'M',
    Component: QuickAddWidget,
  },
];

export function findWidget(type: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY.find((widget) => widget.type === type);
}

/**
 * Whether a widget of the layout is shown in the country of the data. A widget of another country
 * stays in the layout and is back with its country; a type the registry does not know is shown as
 * before, by its name.
 */
export function widgetShown(type: string, country: Country = currentCountry()): boolean {
  return findWidget(type)?.countries?.includes(country) ?? true;
}

/** The catalog of the country of the data. */
export function widgetsFor(country: Country = currentCountry()): WidgetDefinition[] {
  return WIDGET_REGISTRY.filter((widget) => widgetShown(widget.type, country));
}
