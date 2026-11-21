import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge as="span"', () => {
  it('calls onClick on a plain badge, as it does on a removable one', () => {
    const plain = vi.fn();
    const removable = vi.fn();
    const { getByText } = render(
      <>
        <Badge as="span" onClick={plain}>a</Badge>
        <Badge as="span" onClick={removable} onRemove={() => {}} tooltip="t">b</Badge>
      </>,
    );
    fireEvent.click(getByText('a'));
    fireEvent.click(getByText('b'));
    expect(plain).toHaveBeenCalledTimes(1);
    expect(removable).toHaveBeenCalledTimes(1);
  });
});
