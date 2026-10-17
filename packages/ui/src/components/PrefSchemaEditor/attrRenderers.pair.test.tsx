import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import type { PrefPair } from '@weasel-js/prefs';
import { ATTR_RENDERERS } from './attrRenderers';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

function Pair({ seen }: { seen: { pair?: PrefPair } }) {
  const [value, setValue] = useState<PrefPair | undefined>({ with: 'pose.y' });
  seen.pair = value;
  return <>{ATTR_RENDERERS.pair({
    path: 'pair', pref: { kind: 'pair', name: 'Pair', description: '', default: undefined }, value,
    setValue: (v) => setValue(v as PrefPair | undefined), auto: false, setAuto: () => {},
  })}</>;
}

describe('the pair attribute', () => {
  it('takes a row label with a space in it, and trims it once the field is left', () => {
    const seen: { pair?: PrefPair } = {};
    renderWithIcons(<Pair seen={seen} />);
    const box = screen.getByRole('textbox', { name: 'Row label' });
    // One change per keystroke, as typing sends them.
    for (const text of ['Line', 'Line ', 'Line s']) {
      fireEvent.change(box, { target: { value: text } });
      expect(box).toHaveValue(text);
    }
    fireEvent.change(box, { target: { value: 'Line s ' } });
    fireEvent.blur(box);
    expect(seen.pair).toEqual({ with: 'pose.y', label: 'Line s' });
  });
});
