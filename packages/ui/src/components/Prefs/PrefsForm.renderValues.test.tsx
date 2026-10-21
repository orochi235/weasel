import { describe, expect, it } from 'vitest';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { PrefsForm, type PrefRenderContext } from './PrefsForm';
import { renderWithIcons } from '../../testing/withIcons';

describe('PrefsForm renderer context', () => {
  it("carries the form's whole values, so a row can read another setting", () => {
    const schema: PrefGroup = {
      name: '',
      children: { unit: pref.string('Unit', 'px'), size: { ...pref.number('Size', 1), kind: 'sized' } },
    };
    const seen: PrefRenderContext[] = [];
    const values = { unit: 'em', size: 3 };
    renderWithIcons(
      <PrefsForm
        schema={schema}
        values={values}
        onChange={() => {}}
        renderers={{ sized: (ctx) => (seen.push(ctx), <span>sized</span>) }}
      />,
    );
    expect(seen.at(-1)?.values).toBe(values);
  });
});
