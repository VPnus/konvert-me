import { describe, expect, it } from 'vitest';

import { NAV_ITEMS, navItemsFor } from '@/app/navigation';
import { widgetShown, widgetsFor } from '@/features/overview/widgets/registry';

describe('the sections of a country', () => {
  it('keep the deductions for Russia and the tax accounts for the United States', () => {
    expect(navItemsFor('ru').map((item) => item.to)).toEqual([
      '/overview',
      '/budget',
      '/goals',
      '/balance',
      '/deductions',
      '/plan',
      '/settings',
    ]);
    expect(navItemsFor('us').map((item) => item.to)).toEqual([
      '/overview',
      '/budget',
      '/goals',
      '/balance',
      '/tax-accounts',
      '/plan',
      '/settings',
    ]);
    // every tab of the app belongs to one country or to both
    expect(NAV_ITEMS).toHaveLength(8);
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
