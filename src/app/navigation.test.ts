import { describe, expect, it } from 'vitest';

import { NAV_ITEMS, navItemsFor } from '@/app/navigation';
import { widgetShown, widgetsFor } from '@/features/overview/widgets/registry';

describe('the sections of a country', () => {
  it('keep the deductions for Russia only', () => {
    expect(navItemsFor('ru')).toEqual(NAV_ITEMS);
    expect(navItemsFor('us').map((item) => item.to)).toEqual([
      '/overview',
      '/budget',
      '/goals',
      '/balance',
      '/plan',
      '/settings',
    ]);
  });

  it('show the widget of the deductions in Russia, and a widget the registry does not know as before', () => {
    expect(widgetShown('deductions', 'ru')).toBe(true);
    expect(widgetShown('deductions', 'us')).toBe(false);
    expect(widgetShown('free-cash', 'us')).toBe(true);
    expect(widgetShown('gone-widget', 'us')).toBe(true);

    const types = (country: 'ru' | 'us') => widgetsFor(country).map((widget) => widget.type);
    expect(types('ru')).toContain('deductions');
    expect(types('us')).not.toContain('deductions');
    expect(types('us')).toHaveLength(types('ru').length - 1);
  });
});
