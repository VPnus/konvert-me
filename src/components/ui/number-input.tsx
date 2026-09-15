import { forwardRef, type InputHTMLAttributes } from 'react';

import { Input } from '@/components/ui/input';
import { sanitizeNumericInput } from '@/lib/numeric-input';

export interface NumberInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'type' | 'value'
> {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly integer?: boolean;
  readonly allowNegative?: boolean;
}

/**
 * A field that only accepts a number. Letters simply do not appear, so the user never
 * has to guess why a form refuses to save.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onValueChange, integer = false, allowNegative = false, ...props }, ref) => (
    <Input
      ref={ref}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      value={value}
      onChange={(event) =>
        onValueChange(sanitizeNumericInput(event.target.value, { integer, allowNegative }))
      }
      onPaste={(event) => {
        event.preventDefault();
        const pasted = event.clipboardData.getData('text');
        onValueChange(sanitizeNumericInput(value + pasted, { integer, allowNegative }));
      }}
      {...props}
    />
  ),
);
NumberInput.displayName = 'NumberInput';
