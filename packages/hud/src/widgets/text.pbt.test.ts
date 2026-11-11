/**
 * Stateful property test of a HUD text widget, which refills one draw command in place: through any sequence of text
 * and bounds changes and draws under other themes and default fonts, what it draws is what a widget made fresh in
 * the same state draws, and its deps move exactly when a setter runs.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { draftText, runs, tally } from '../pbt.fixture';
import { createLabel } from './label';
import { createText } from './text';

const RUNS = 200;
const THEMES = [resolveTheme(weaselTheme, { mode: 'dark' }), resolveTheme(weaselTheme, { mode: 'light' })];
const FONTS = ['A', 'B'];

type Cmd =
  | { t: 'text'; s: string }
  | { t: 'bounds'; x: number; y: number }
  | { t: 'draw'; theme: number; font: number };

const cmd: fc.Arbitrary<Cmd> = fc.oneof(
  fc.record({ t: fc.constant('text' as const), s: fc.oneof(draftText, fc.constantFrom('', 'same')) }),
  fc.record({ t: fc.constant('bounds' as const), x: fc.integer({ min: -100, max: 500 }), y: fc.integer({ min: -100, max: 500 }) }),
  { arbitrary: fc.record({ t: fc.constant('draw' as const), theme: fc.nat({ max: 1 }), font: fc.nat({ max: 1 }) }), weight: 2 },
);

describe('createText', () => {
  it('draws what a fresh widget in the same state draws, whatever it drew before', () => {
    const seen = tally();
    const spec = fc.record({
      label: fc.boolean(), color: fc.option(fc.constantFrom('#ff0000', '#00ff00'), { nil: undefined }),
      family: fc.option(fc.constant('F'), { nil: undefined }), fontSize: fc.integer({ min: 6, max: 40 }),
    });
    fc.assert(fc.property(spec, fc.array(cmd, { maxLength: 30 }), (s, cmds) => {
      const make = (text: string, x: number, y: number) => (s.label
        ? createLabel({ id: 't', x, y, text, fontSize: s.fontSize, color: s.color })
        : createText({ id: 't', x, y, text, fontSize: s.fontSize, color: s.color, fontFamily: s.family }));
      let text = 'start', x = 0, y = 0;
      const w = make(text, x, y);
      for (const c of cmds) {
        const deps = w.deps!({} as never);
        if (c.t === 'text') { w.setText(c.s); text = c.s; }
        else if (c.t === 'bounds') { w.setBounds({ x: c.x, y: c.y, w: 0, h: s.fontSize }); x = c.x; y = c.y; }
        else {
          const ctx = { dims: { width: 400, height: 300 }, defaultFont: FONTS[c.font]!, color: () => '#000', tokens: THEMES[c.theme]! };
          expect(w.draw(ctx)).toEqual(make(text, x, y).draw(ctx));
          seen.hit('drawn');
        }
        expect(w.deps!({} as never) !== deps).toBe(c.t !== 'draw');
      }
    }), runs(RUNS));
    seen.atLeast('drawn', 200);
  });
});
