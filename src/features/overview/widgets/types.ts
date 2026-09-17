import type { Country } from '@/core/country';
import type { OverviewData } from '@/features/overview/overview-data';
import type { WidgetSize } from '@/db/repositories/dashboard';

export interface WidgetProps {
  readonly data: OverviewData;
  readonly settings: Record<string, unknown>;
}

export interface WidgetDefinition {
  readonly type: string;
  readonly title: string;
  readonly description: string;
  readonly sizes: readonly WidgetSize[];
  readonly defaultSize: WidgetSize;
  readonly Component: (props: WidgetProps) => React.ReactNode;
  /** Widgets that make sense more than once on the dashboard (a goal card, say). */
  readonly repeatable?: boolean;
  /** A widget of some countries only; without it, a widget of every one. */
  readonly countries?: readonly Country[];
}
