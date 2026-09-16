import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { NumberInput } from '@/components/ui/number-input';

function Controlled({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return <NumberInput aria-label="Сумма" value={value} onValueChange={setValue} />;
}

afterEach(cleanup);

describe('number input: pasting', () => {
  it('replaces the selected text instead of adding to the end', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="100000" />);
    const input = screen.getByLabelText<HTMLInputElement>('Сумма');

    await user.click(input);
    input.setSelectionRange(0, input.value.length);
    await user.paste('65000');

    // it used to become 10000065000: a goal of ten billion instead of sixty-five thousand
    expect(input).toHaveValue('65000');
  });

  it('puts the text where the caret is', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="1000" />);
    const input = screen.getByLabelText<HTMLInputElement>('Сумма');

    await user.click(input);
    input.setSelectionRange(1, 1);
    await user.paste('5');

    expect(input).toHaveValue('15000');
  });

  it('still keeps letters out of what is pasted', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="" />);
    const input = screen.getByLabelText<HTMLInputElement>('Сумма');

    await user.click(input);
    await user.paste('12 500 ₽');

    expect(input).toHaveValue('12500');
  });
});
