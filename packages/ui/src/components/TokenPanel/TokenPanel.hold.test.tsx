import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { renderWithIcons } from '../../testing/withIcons';
import { Disabled, ReadOnly } from '../Disabled';
import { TokenPanel, type TokenPanelProps } from './TokenPanel';
import type { TokenEntry } from './tokenTypes';

const TOKENS: TokenEntry[] = [
  { name: '--wzl-focus-ring', type: 'color', group: 'focus', value: '#5841b8' },
  { name: '--gap', type: 'string', group: 'gap', value: 'auto', overridden: true },
];

function renderPanel(wrap: (node: ReactNode) => ReactNode, props: Partial<TokenPanelProps> = {}) {
  const onChange = vi.fn();
  renderWithIcons(<>{wrap(<TokenPanel tokens={TOKENS} onChange={onChange} {...props} />)}</>);
  return onChange;
}

const ring = () => within(screen.getByRole('group', { name: '--wzl-focus-ring' }));

/** An edit to a value's text, its swatch, and a Reset. */
function tryEverything() {
  fireEvent.change(ring().getByRole('textbox'), { target: { value: 'red' } });
  fireEvent.change(ring().getByLabelText('--wzl-focus-ring color'), { target: { value: '#000000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reset --gap' }));
}

describe('TokenPanel held', () => {
  it('unheld, every edit reaches onChange', () => {
    const onChange = renderPanel((n) => n);
    tryEverything();
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('disabled with no reason refuses every edit, its fields natively disabled', () => {
    const onChange = renderPanel((n) => n, { disabled: true });
    tryEverything();
    expect(onChange).not.toHaveBeenCalled();
    expect(ring().getByRole('textbox')).toBeDisabled();
    expect(ring().getByLabelText('--wzl-focus-ring color')).toBeDisabled();
  });

  it('disabled for a reason refuses every edit and keeps its fields reachable, saying why', () => {
    const onChange = renderPanel((n) => n, { disabled: true, disabledReason: 'Theme is locked' });
    tryEverything();
    expect(onChange).not.toHaveBeenCalled();
    const swatch = ring().getByLabelText('--wzl-focus-ring color');
    expect(swatch).not.toBeDisabled();
    expect(swatch).toHaveAccessibleDescription('Theme is locked');
    expect(ring().getByRole('textbox')).toHaveAccessibleDescription('Theme is locked');
  });

  it('read-only refuses every edit, and sections still fold', () => {
    const onChange = renderPanel((n) => <ReadOnly reason="Built in">{n}</ReadOnly>);
    tryEverything();
    expect(onChange).not.toHaveBeenCalled();
    expect(ring().getByRole('textbox')).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Color' }));
    expect(screen.queryByRole('group', { name: '--wzl-focus-ring' })).toBeNull();
  });

  it('nested scopes: the nearest reason wins, and disabled={false} adds nothing', () => {
    const onChange = renderPanel((n) => <Disabled reason="Locked"><Disabled reason="Busy">{n}</Disabled></Disabled>, { disabled: false });
    tryEverything();
    expect(onChange).not.toHaveBeenCalled();
    expect(ring().getByLabelText('--wzl-focus-ring color')).toHaveAccessibleDescription('Busy');
  });
});
