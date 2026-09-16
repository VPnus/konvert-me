import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  readonly onValueChange: (value: number) => void;
};

/**
 * A plain range input, styled to the theme. The native element is kept on purpose:
 * it already works with a keyboard, a screen reader and a finger.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ className, onValueChange, ...props }, ref) => (
    <input
      ref={ref}
      type="range"
      className={cn(
        'h-6 w-full cursor-pointer appearance-none bg-transparent',
        '[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted',
        '[&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:size-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
        '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted',
        '[&::-moz-range-thumb]:size-[18px] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary',
        className,
      )}
      onChange={(event) => onValueChange(Number(event.target.value))}
      {...props}
    />
  ),
);
Slider.displayName = 'Slider';
