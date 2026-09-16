import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ThemeDefinition } from '@weasel-js/theme';
import { derive } from '@weasel-js/theme/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LayerId } from './theme/model';
import { lookupOf } from './theme/fixtures';
import { TokenLayer } from './TokenLayer';

/** One pin, so it draws as a lone color row rather than joining a swatch family. */
const tiny: ThemeDefinition = {
  name: 'tiny',
  extends: 'weasel',
  pins: { 'brand-ink': { value: '#123456', type: 'color' } },
};
const lookup = lookupOf(tiny);

function renderLayer(layer: LayerId, def: ThemeDefinition = tiny, highlight: readonly string[] = []) {
  const onChange = vi.fn();
  render(
    <TokenLayer
      layer={layer}
      draft={def}
      result={derive(def, { mode: 'dark' }, lookup)}
      highlight={highlight}
      onChange={onChange}
    />,
  );
  return onChange;
}

const nextDef = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![0] as ThemeDefinition;

describe('<TokenLayer>', () => {
  afterEach(cleanup);

  it('pins a token to what is typed into its field', () => {
    const onChange = renderLayer('pins');
    fireEvent.change(screen.getByRole('textbox', { name: 'brand-ink value' }), { target: { value: '#abcdef' } });
    expect(nextDef(onChange).pins?.['brand-ink']).toEqual({ value: '#abcdef', type: 'color' });
  });

  it('drops the pin when a row is reset', () => {
    const onChange = renderLayer('pins');
    fireEvent.click(screen.getByRole('button', { name: 'Reset brand-ink' }));
    expect(nextDef(onChange).pins?.['brand-ink']).toBeUndefined();
  });

  it('keeps a pinned alpha when the value beneath it is edited', () => {
    const def = { ...tiny, pins: { line: { value: '{fg}', type: 'color', alpha: 0.1 } } } as ThemeDefinition;
    const onChange = renderLayer('pins', def);
    fireEvent.change(screen.getByRole('textbox', { name: 'line value' }), { target: { value: '{fg-muted}' } });
    expect(nextDef(onChange).pins?.line).toEqual({ value: '{fg-muted}', type: 'color', alpha: 0.1 });
  });

  it('writes a font stack back as a list, not as the text of one', () => {
    const def = { ...tiny, pins: { 'font-ui': { value: ['Oswald', 'system-ui'], type: 'fontFamily' } } } as ThemeDefinition;
    const onChange = renderLayer('pins', def);
    const field = screen.getByRole('textbox', { name: 'font-ui value' });
    expect(field).toHaveValue('Oswald, system-ui');
    fireEvent.change(field, { target: { value: "Inter, 'Helvetica Neue', sans-serif" } });
    expect(nextDef(onChange).pins?.['font-ui']).toEqual({
      value: ['Inter', 'Helvetica Neue', 'sans-serif'],
      type: 'fontFamily',
    });
  });

  it('writes an easing back as its four numbers', () => {
    const def = { ...tiny, pins: { ease: { value: [0.33, 1, 0.68, 1], type: 'cubicBezier' } } } as ThemeDefinition;
    const onChange = renderLayer('pins', def);
    const field = screen.getByRole('textbox', { name: 'ease value' });
    expect(field).toHaveValue('cubic-bezier(0.33, 1, 0.68, 1)');
    fireEvent.change(field, { target: { value: 'cubic-bezier(0.1, 0.2, 0.3, 0.4)' } });
    expect(nextDef(onChange).pins?.ease).toEqual({ value: [0.1, 0.2, 0.3, 0.4], type: 'cubicBezier' });
  });

  it('edits a seed in place of a pin', () => {
    const def = { ...tiny, seeds: { brand: '#0b6e8a' } } as ThemeDefinition;
    const onChange = renderLayer('seeds', def);
    fireEvent.change(screen.getByRole('textbox', { name: 'seeds.brand value' }), { target: { value: '#112233' } });
    expect(nextDef(onChange).seeds).toEqual({ brand: '#112233' });
    expect(nextDef(onChange).pins?.['seeds.brand']).toBeUndefined();
  });

  it('writes a numeric seed back as a number, not a string', () => {
    const def = { ...tiny, seeds: { unit: 4 } } as ThemeDefinition;
    const onChange = renderLayer('seeds', def);
    fireEvent.change(screen.getByRole('textbox', { name: 'seeds.unit value' }), { target: { value: '8' } });
    fireEvent.blur(screen.getByRole('textbox', { name: 'seeds.unit value' }));
    expect(nextDef(onChange).seeds).toEqual({ unit: 8 });
  });

  // jsdom defines no scrollIntoView at all — which is why the component calls it
  // optionally — so this installs one rather than spying on a missing function.
  it('scrolls the token click-to-inspect landed on into view', () => {
    const scrollIntoView = vi.fn();
    const proto = Element.prototype as unknown as { scrollIntoView?: () => void };
    const had = proto.scrollIntoView;
    proto.scrollIntoView = scrollIntoView;
    try {
      renderLayer('pins', tiny, ['brand-ink']);
      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      proto.scrollIntoView = had;
    }
  });

  it('says so when a layer holds nothing', () => {
    renderLayer('seeds', tiny);
    expect(screen.getByText(/no seeds/i)).toBeInTheDocument();
  });
});
