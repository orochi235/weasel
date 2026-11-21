import { describe, expect, it, vi } from 'vitest';
import { pref, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { PrefsForm } from './PrefsForm';
import { renderWithIcons } from '../../testing/withIcons';

const schema: PrefGroup = pref.group('', {
  appearance: pref.group('Appearance', { theme: pref.string('Theme', 'light') }),
  size: pref.number('Size', 1),
});
const draw = () => <span>drawn</span>;

describe('PrefsForm renderers', () => {
  it('warns once of a key that is neither a leaf path nor a leaf kind in the schema', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderers = { 'apperance.theme': draw, number: draw, 'appearance.theme': draw, colr: draw };
    const { rerender } = renderWithIcons(<PrefsForm schema={schema} values={{}} onChange={() => {}} renderers={renderers} />);
    rerender(<PrefsForm schema={schema} values={{}} onChange={() => {}} renderers={{ ...renderers }} />);
    expect(warn.mock.calls.map(([m]) => m as string)).toEqual([
      expect.stringContaining('key "apperance.theme"'),
      expect.stringContaining('key "colr"'),
    ]);
    warn.mockRestore();
  });

  it('draws a leaf by the renderer named for its path, in a row, an object field, and a bar cell', () => {
    const named = pref.group('', {
      size: pref.number('Size', 1),
      box: {
        kind: 'object', name: 'Box', description: '', default: { w: 2 },
        children: { w: { kind: 'number', name: 'W', description: '', default: 2 } },
      } as PrefLeaf,
      bar: pref.group('Bar', { gap: pref.number('Gap', 3) }, { as: 'bar' }),
    });
    const at = (path: string) => () => <span>{`drawn ${path}`}</span>;
    const { getByText } = renderWithIcons(
      <PrefsForm schema={named} values={{}} onChange={() => {}}
        renderers={{ size: at('size'), 'box.w': at('box.w'), 'bar.gap': at('bar.gap') }} />,
    );
    for (const path of ['size', 'box.w', 'bar.gap']) expect(getByText(`drawn ${path}`)).toBeTruthy();
  });
});
