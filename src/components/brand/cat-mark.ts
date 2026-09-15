/**
 * The Конверкот mark: a cat holding a card with two big eyes.
 *
 * The geometry lives here as data so that the React logo and the generated app
 * icons (scripts/generate-icons.ts) never drift apart. Two paints only:
 * "cat" is the ink of the current theme, "card" is the surface behind it.
 */

export type Paint = 'cat' | 'card' | 'none';

export type Shape =
  | { kind: 'path'; d: string; fill?: Paint; stroke?: Paint; width?: number; round?: boolean }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: Paint; stroke?: Paint; width?: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill?: Paint }
  | {
      kind: 'rect';
      x: number;
      y: number;
      w: number;
      h: number;
      rx: number;
      fill?: Paint;
      stroke?: Paint;
      width?: number;
    }
  | { kind: 'group'; transform: string; children: Shape[] };

export const CAT_MARK_VIEWBOX = '0 0 64 64';

export const CAT_MARK_SHAPES: readonly Shape[] = [
  // tail
  { kind: 'path', d: 'M47 52.5 C 58.5 51.5 60 41 55 35.5', stroke: 'cat', width: 4.4, round: true },
  // ears
  { kind: 'path', d: 'M23.5 15 L23.5 4 L33 12 Z', fill: 'cat' },
  { kind: 'path', d: 'M40.5 15 L40.5 4 L31 12 Z', fill: 'cat' },
  // head, body, feet
  { kind: 'circle', cx: 32, cy: 22, r: 11.5, fill: 'cat' },
  { kind: 'rect', x: 14, y: 26, w: 36, h: 30, rx: 12, fill: 'cat' },
  { kind: 'ellipse', cx: 23, cy: 57.5, rx: 5.2, ry: 3, fill: 'cat' },
  { kind: 'ellipse', cx: 41, cy: 57.5, rx: 5.2, ry: 3, fill: 'cat' },
  // the card the cat is holding covers its face, slightly tilted
  {
    kind: 'group',
    transform: 'rotate(-4 32 42)',
    children: [
      { kind: 'rect', x: 19, y: 30, w: 26, h: 24, rx: 3, fill: 'card', stroke: 'cat', width: 2.4 },
      { kind: 'circle', cx: 26.5, cy: 39.5, r: 4, fill: 'card', stroke: 'cat', width: 2.3 },
      { kind: 'circle', cx: 37.5, cy: 39.5, r: 4, fill: 'card', stroke: 'cat', width: 2.3 },
      { kind: 'circle', cx: 26.5, cy: 39.5, r: 1.4, fill: 'cat' },
      { kind: 'circle', cx: 37.5, cy: 39.5, r: 1.4, fill: 'cat' },
      { kind: 'circle', cx: 32, cy: 47.5, r: 1.7, fill: 'card', stroke: 'cat', width: 1.6 },
    ],
  },
  // paws holding the card
  { kind: 'circle', cx: 18.2, cy: 44, r: 3.9, fill: 'cat' },
  { kind: 'circle', cx: 45.8, cy: 44, r: 3.9, fill: 'cat' },
];

/** Renders the mark as an SVG string. Used by the icon generator, not by the app. */
export function catMarkSvg(options: {
  size: number;
  cat: string;
  card: string;
  background?: string;
  padding?: number;
}): string {
  const { size, cat, card, background, padding = 0 } = options;
  const paint = (value: Paint | undefined): string =>
    value === 'cat' ? cat : value === 'card' ? card : 'none';

  const render = (shape: Shape): string => {
    if (shape.kind === 'group') {
      return `<g transform="${shape.transform}">${shape.children.map(render).join('')}</g>`;
    }
    const common =
      `fill="${paint(shape.fill)}"` +
      ('stroke' in shape && shape.stroke
        ? ` stroke="${paint(shape.stroke)}" stroke-width="${shape.width ?? 2}"`
        : '') +
      ('round' in shape && shape.round ? ' stroke-linecap="round" stroke-linejoin="round"' : '');

    switch (shape.kind) {
      case 'path':
        return `<path d="${shape.d}" ${common} />`;
      case 'circle':
        return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" ${common} />`;
      case 'ellipse':
        return `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}" ${common} />`;
      case 'rect':
        return `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" rx="${shape.rx}" ${common} />`;
    }
  };

  const scale = (64 - padding * 2) / 64;
  const body = `<g transform="translate(${padding} ${padding}) scale(${scale})">${CAT_MARK_SHAPES.map(render).join('')}</g>`;
  const backdrop = background ? `<rect width="64" height="64" rx="14" fill="${background}" />` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CAT_MARK_VIEWBOX}" width="${size}" height="${size}" fill="none">${backdrop}${body}</svg>`;
}
