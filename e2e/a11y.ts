import type { Page } from '@playwright/test';

/**
 * Accessibility checks of docs/PLAN.md for the MVP — contrast, keyboard, names of the
 * controls — without a library: Chromium's own accessibility tree names the controls, and
 * the contrast is the WCAG 2.1 formula over the colours the page really paints.
 */

export interface ContrastIssue {
  readonly text: string;
  readonly ratio: number;
  readonly required: number;
  readonly where: string;
}

/**
 * Every piece of visible text whose contrast with what is painted behind it is below
 * WCAG AA: 4.5 for normal text, 3 for large. Disabled controls are exempt, as WCAG allows.
 */
export async function contrastIssues(page: Page): Promise<ContrastIssue[]> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('no canvas');

    // The canvas turns any CSS colour — oklch included — into the sRGB the screen shows.
    type Rgba = [number, number, number, number];
    const rgba = (color: string): Rgba => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = 'rgba(0, 0, 0, 0)';
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const over = (top: Rgba, bottom: Rgba): Rgba => {
      const alpha = top[3] + bottom[3] * (1 - top[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      const mix = (i: number) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / alpha;
      return [mix(0), mix(1), mix(2), alpha];
    };
    const luminance = ([r, g, b]: Rgba) => {
      const channel = (value: number) => {
        const c = value / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };

    // Siblings share their ancestors: each element's backdrop and opacity is worked out once.
    const backdrops = new Map<Element, Rgba | null>();
    const opacities = new Map<Element, number>();
    const WHITE: Rgba = [255, 255, 255, 1];

    /** What is painted behind an element: its own background over everything above it. */
    const backdrop = (element: Element | null): Rgba | null => {
      if (!element) return WHITE;
      if (backdrops.has(element)) return backdrops.get(element) ?? null;
      const style = getComputedStyle(element);
      let result: Rgba | null;
      // A picture or a gradient behind the text cannot be measured this way.
      if (style.backgroundImage !== 'none') result = null;
      else {
        const color = rgba(style.backgroundColor);
        const below = color[3] >= 1 ? WHITE : backdrop(element.parentElement);
        result = below === null ? null : color[3] > 0 ? over(color, below) : below;
      }
      backdrops.set(element, result);
      return result;
    };

    const opacityOf = (element: Element | null): number => {
      if (!element) return 1;
      const known = opacities.get(element);
      if (known !== undefined) return known;
      const opacity = Number(getComputedStyle(element).opacity) * opacityOf(element.parentElement);
      opacities.set(element, opacity);
      return opacity;
    };

    const issues: { text: string; ratio: number; required: number; where: string }[] = [];
    const seen = new Set<Element>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const element = node.parentElement;
      if (!text || !element || seen.has(element)) continue;
      seen.add(element);

      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || style.visibility === 'hidden') continue;
      if (element.closest('[disabled], [aria-disabled="true"], .sr-only, svg')) continue;
      const opacity = opacityOf(element);
      if (opacity === 0) continue;

      const behind = backdrop(element);
      if (!behind) continue;
      const color = rgba(style.color);
      const ink = over([color[0], color[1], color[2], color[3] * opacity], behind);

      const [light, dark] = [luminance(ink), luminance(behind)].sort((a, b) => b - a);
      const ratio = (light + 0.05) / (dark + 0.05);
      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      const required = large ? 3 : 4.5;

      if (ratio + 0.005 < required) {
        const marked = element.closest('[data-testid]');
        issues.push({
          text: text.slice(0, 60),
          ratio: Math.round(ratio * 100) / 100,
          required,
          where: marked
            ? `[data-testid="${marked.getAttribute('data-testid')}"]`
            : element.tagName.toLowerCase(),
        });
      }
    }
    return issues;
  });
}

const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'combobox',
  'listbox',
  'checkbox',
  'radio',
  'switch',
  'slider',
  'spinbutton',
  'tab',
  'menuitem',
  'option',
]);

/** Controls the screen reader would announce without a name: "button", "text field" — and nothing else. */
export async function unnamedControls(page: Page): Promise<string[]> {
  const client = await page.context().newCDPSession(page);
  try {
    const { nodes } = (await client.send('Accessibility.getFullAXTree')) as {
      nodes: {
        ignored: boolean;
        role?: { value: string };
        name?: { value: string };
        backendDOMNodeId?: number;
      }[];
    };

    const unnamed: string[] = [];
    for (const node of nodes) {
      const role = node.role?.value ?? '';
      if (node.ignored || !INTERACTIVE_ROLES.has(role) || node.name?.value.trim()) continue;

      let where = '';
      if (node.backendDOMNodeId !== undefined) {
        const { node: dom } = (await client.send('DOM.describeNode', {
          backendNodeId: node.backendDOMNodeId,
        })) as { node: { nodeName: string; attributes?: string[] } };
        const attributes = dom.attributes ?? [];
        const attribute = (name: string) => {
          const index = attributes.indexOf(name);
          return index === -1 ? undefined : attributes[index + 1];
        };
        where = `${dom.nodeName.toLowerCase()}${attribute('data-testid') ? `[data-testid="${attribute('data-testid')}"]` : ''}${attribute('type') ? `[type=${attribute('type')}]` : ''}`;
      }
      unnamed.push(`${role} ${where}`.trim());
    }
    return unnamed;
  } finally {
    await client.detach();
  }
}

export interface KeyboardReport {
  /** Controls Tab lands on that show no sign of having the focus. */
  readonly invisibleFocus: string[];
  /** Visible controls Tab never reaches. */
  readonly unreachable: string[];
}

/**
 * Walks the page with Tab from the top: every visible control has to be reached, and every
 * stop has to show where the focus is — an outline or a ring.
 */
export async function keyboardReport(
  page: Page,
  options: { scope?: string; maxStops?: number } = {},
): Promise<KeyboardReport> {
  const { scope = 'body', maxStops = 250 } = options;
  // Tab goes on from wherever the focus was last, even after a blur: the walk starts from a
  // mark put at the very beginning of the area instead.
  await page.evaluate((root) => {
    for (const element of document.querySelectorAll('[data-a11y-reached]')) {
      element.removeAttribute('data-a11y-reached');
    }
    const area = document.querySelector(root) ?? document.body;
    const start = document.createElement('span');
    start.tabIndex = -1;
    start.setAttribute('data-a11y-start', '');
    area.prepend(start);
    start.focus();
  }, scope);

  const invisibleFocus = new Set<string>();
  const visited = new Set<string>();
  let sinceNew = 0;

  for (let stop = 0; stop < maxStops; stop += 1) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;

      const describe = (target: Element) => {
        const marked = target.closest('[data-testid]');
        const label = target.getAttribute('aria-label') ?? (target.textContent ?? '').trim().slice(0, 30);
        return `${target.tagName.toLowerCase()}${marked ? `[data-testid="${marked.getAttribute('data-testid')}"]` : ''} «${label}»`;
      };
      if (!element.hasAttribute('data-a11y-id')) {
        element.setAttribute('data-a11y-id', String(Math.random()));
      }
      element.setAttribute('data-a11y-reached', '');

      const style = getComputedStyle(element);
      const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
      const ring = style.boxShadow !== 'none';
      // A date or a month field shows the focus inside itself: the part being typed is highlighted.
      const segmented =
        element instanceof HTMLInputElement &&
        ['date', 'month', 'time', 'datetime-local'].includes(element.type);
      return {
        id: element.getAttribute('data-a11y-id') ?? '',
        where: describe(element),
        visible: outline || ring || segmented,
      };
    });

    if (!state) continue;
    // The walk is over after a whole round that finds nothing new. Not at the first control
    // met again: a field with parts (a month and a year) takes several stops, and a dialog may
    // hand the focus round once before settling into its order.
    if (visited.has(state.id)) {
      sinceNew += 1;
      if (sinceNew > visited.size) break;
      continue;
    }
    sinceNew = 0;
    visited.add(state.id);
    if (!state.visible) invisibleFocus.add(state.where);
  }

  await page.evaluate(() => document.querySelector('[data-a11y-start]')?.remove());

  const unreachable = await page.evaluate((root) => {
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return [...(document.querySelector(root)?.querySelectorAll(selector) ?? [])]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          !element.hasAttribute('data-a11y-reached')
        );
      })
      .map((element) => {
        const marked = element.closest('[data-testid]');
        return `${element.tagName.toLowerCase()}${marked ? `[data-testid="${marked.getAttribute('data-testid')}"]` : ''}`;
      });
  }, scope);

  return { invisibleFocus: [...invisibleFocus], unreachable };
}
