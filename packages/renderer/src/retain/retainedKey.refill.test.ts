import { describe, expect, it } from 'vitest';
import { mat3 } from '@weasel-js/geom';
import type { DrawCommand, TextDrawCommand } from '../DrawCommand';
import { textCommandFromRuns, textCommandFromRunsInto } from '../textCommand';
import { latestTextRefillIn } from '../textBounds';
import { movesWithView } from './movesWithView';
import { sameKey, type RetainedKey } from './retainedKey';

const style = { fontFamily: 'inter', fontSize: 16 };

describe('a text refilled in place under a retained group', () => {
  it('changes the group\'s key, though its children are the same objects', () => {
    const text = textCommandFromRuns(0, 0, [{ text: 'A' }], style) as TextDrawCommand;
    const children: DrawCommand[] = [{ kind: 'group', children: [text] }];
    const key = (): RetainedKey => ({
      children, textRefill: latestTextRefillIn(children), transform: mat3.identity(), alpha: 1,
      colorMatrix: new Float32Array(20), viewMatrix: undefined, clips: [],
    });
    const before = key();
    expect(sameKey(before, key())).toBe(true);
    textCommandFromRunsInto(text, 0, 0, [{ text: 'B' }], style);
    expect(sameKey(before, key())).toBe(false);
  });

  it('is asked again whether it moves with the view once its paint is refilled', () => {
    const text = textCommandFromRuns(0, 0, [{ text: 'A' }], style) as TextDrawCommand;
    const children: DrawCommand[] = [{ kind: 'text-layer', texts: [text] }];
    expect(movesWithView(children, true)).toBe(true);
    textCommandFromRunsInto(text, 0, 0, [{ text: 'A' }], style, undefined, undefined, undefined, {
      fill: { paint: {
        kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 10, y: 0 },
        stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
      } },
    });
    expect(movesWithView(children, true)).toBe(false);
  });
});
