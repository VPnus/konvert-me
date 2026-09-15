import { Fragment } from 'react';

import { CAT_MARK_SHAPES, CAT_MARK_VIEWBOX, type Paint, type Shape } from '@/components/brand/cat-mark';
import { cn } from '@/lib/utils';

/**
 * The cat is drawn with currentColor, so it follows the theme: deep green ink on the
 * light theme, bright green on the dark one. The card it holds takes the colour of the
 * surface behind the logo (override it with --logo-card where that surface differs).
 */
const CAT_INK = 'currentColor';
const CARD_INK = 'var(--logo-card, var(--color-card))';

function paintOf(paint: Paint | undefined): string {
  if (paint === 'cat') return CAT_INK;
  if (paint === 'card') return CARD_INK;
  return 'none';
}

function renderShape(shape: Shape, key: string) {
  if (shape.kind === 'group') {
    return (
      <g key={key} transform={shape.transform}>
        {shape.children.map((child, index) => (
          <Fragment key={`${key}-${index}`}>{renderShape(child, `${key}-${index}`)}</Fragment>
        ))}
      </g>
    );
  }

  const fill = paintOf(shape.fill);
  const stroke = 'stroke' in shape && shape.stroke ? paintOf(shape.stroke) : undefined;
  const strokeWidth = 'width' in shape ? shape.width : undefined;
  const linecap = 'round' in shape && shape.round ? ('round' as const) : undefined;

  switch (shape.kind) {
    case 'path':
      return (
        <path
          key={key}
          d={shape.d}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap={linecap}
          strokeLinejoin={linecap}
        />
      );
    case 'circle':
      return (
        <circle
          key={key}
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'ellipse':
      return <ellipse key={key} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} fill={fill} />;
    case 'rect':
      return (
        <rect
          key={key}
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={shape.rx}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
  }
}

export function CatLogo({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox={CAT_MARK_VIEWBOX}
      className={cn('text-primary', className)}
      fill="none"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-testid="cat-logo"
    >
      {title ? <title>{title}</title> : null}
      {CAT_MARK_SHAPES.map((shape, index) => (
        <Fragment key={index}>{renderShape(shape, String(index))}</Fragment>
      ))}
    </svg>
  );
}
