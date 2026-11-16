import { describe, expect, it, vi } from 'vitest';
import { pref, type PrefGroup } from '@weasel-js/prefs';
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
});
