import { render } from '@testing-library/react';
import { resolveTheme } from '@weasel-js/theme';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import { interstellarTheme } from '../theme/interstellar';
import { Lab } from './Lab';

const bare: Instrument = {
  name: 'Bare',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
};

const backdrop = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[style]')]
    .map((el) => el.style.getPropertyValue('--wzl-backdrop'))
    .find(Boolean) ?? '';

describe('<Lab nebula>', () => {
  it('draws one blob per literal color', () => {
    const { container } = render(
      <Lab
        instruments={[bare]}
        defaultInstrument="Bare"
        mode="dark"
        nebula={['#ff0000', '#00ff00']}
      />,
    );
    expect(backdrop(container).match(/radial-gradient/g)).toHaveLength(3);
  });

  it('resolves a theme ramp against the lab’s theme', () => {
    const { container } = render(
      <Lab instruments={[bare]} defaultInstrument="Bare" mode="dark" nebula={{ ramp: 'swatch' }} />,
    );
    const sky = resolveTheme(interstellarTheme, { mode: 'dark' })['--wzl-swatch-sky'];
    expect(backdrop(container)).toContain(sky);
  });
});
