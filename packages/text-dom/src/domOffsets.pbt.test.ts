/**
 * Character offsets over any DOM the overlay can come to hold — run spans, a browser's `<b>`, `<br>`, `<div>` and
 * `<p>` blocks, break stand-ins, empty text nodes — against the text `domToRuns` reads from the same tree: every
 * offset reaches a position that reads back as itself, and every boundary point reads in document order.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runsToPlainText } from '@weasel-js/text';
import { charOffsetToDomPosition, domPositionToCharOffset } from './domOffsets';
import { domToRuns } from './domRuns';
import { runs, tally, textOf, timeoutFor } from './pbt.fixture';

const RUNS = 300;

type Shape =
  | { text: string }
  | { br: true }
  | { stand: string }
  | { el: 'span' | 'b' | 'i' | 'div' | 'p'; kids: Shape[] };

const shape: fc.Arbitrary<Shape> = fc.letrec<{ node: Shape }>((tie) => ({
  node: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    { weight: 4, arbitrary: textOf(['a', 'b', ' ', '😀', 'é'], 3).map((text) => ({ text })) },
    { weight: 1, arbitrary: fc.constant({ br: true as const }) },
    { weight: 1, arbitrary: textOf(['x'], 2).map((rest) => ({ stand: rest })) },
    {
      weight: 3,
      arbitrary: fc.record({
        el: fc.constantFrom('span' as const, 'b' as const, 'i' as const, 'div' as const, 'p' as const),
        kids: fc.array(tie('node'), { maxLength: 3 }),
      }),
    },
  ),
})).node;

function build(parent: Node, s: Shape): void {
  if ('text' in s) { parent.appendChild(document.createTextNode(s.text)); return; }
  if ('br' in s) { parent.appendChild(document.createElement('br')); return; }
  if ('stand' in s) {
    // A break stand-in as `appendOverlayText` writes one, with whatever was typed into it after.
    const span = document.createElement('span');
    span.setAttribute('data-break', '2028');
    span.textContent = `\n${s.stand}`;
    parent.appendChild(span);
    return;
  }
  const el = document.createElement(s.el);
  for (const k of s.kids) build(el, k);
  parent.appendChild(el);
}

/** Every boundary point inside `root`, in document order. */
function boundaryPoints(root: Node): Array<{ node: Node; offset: number }> {
  const out: Array<{ node: Node; offset: number }> = [];
  const visit = (n: Node): void => {
    const len = n.nodeType === Node.TEXT_NODE ? (n as Text).data.length : n.childNodes.length;
    for (let i = 0; i <= len; i++) {
      out.push({ node: n, offset: i });
      if (n.nodeType !== Node.TEXT_NODE && i < len) visit(n.childNodes[i]!);
    }
  };
  visit(root);
  return out;
}

let parent: HTMLDivElement;
beforeEach(() => {
  document.body.innerHTML = '';
  parent = document.createElement('div');
  document.body.appendChild(parent);
});

const forest = fc.array(shape, { maxLength: 4 });

describe('overlay offsets (property)', () => {
  it('sends every offset to a position that reads back as it, clamping past the end', () => {
    const t = tally();
    fc.assert(fc.property(forest, fc.nat(4), (shapes, past) => {
      parent.replaceChildren();
      for (const s of shapes) build(parent, s);
      const text = runsToPlainText(domToRuns(parent));
      if (parent.querySelector('div, p')) t.count('block');
      if (parent.querySelector('br')) t.count('br');
      if (text.length > 3) t.count('long');
      for (let k = 0; k <= text.length + past; k++) {
        const pos = charOffsetToDomPosition(parent, k)!;
        expect(parent.contains(pos.node)).toBe(true);
        expect(domPositionToCharOffset(parent, pos.node, pos.offset)).toBe(Math.min(k, text.length));
        // A position in a text node sits before the character it names.
        if (pos.node.nodeType === Node.TEXT_NODE && pos.offset < (pos.node as Text).data.length && !(pos.node.parentElement?.hasAttribute('data-break'))) {
          expect((pos.node as Text).data[pos.offset]).toBe(text[k]);
        }
      }
    }), runs(RUNS));
    t.atLeast('block', 50);
    t.atLeast('br', 50);
    t.atLeast('long', 50);
  }, timeoutFor(RUNS, 20));

  it('reads every boundary point in document order, inside the text', () => {
    const t = tally();
    fc.assert(fc.property(forest, (shapes) => {
      parent.replaceChildren();
      for (const s of shapes) build(parent, s);
      const length = runsToPlainText(domToRuns(parent)).length;
      let last = 0;
      const seen = new Set<number>();
      for (const p of boundaryPoints(parent)) {
        const at = domPositionToCharOffset(parent, p.node, p.offset);
        expect(at).toBeGreaterThanOrEqual(last);
        expect(at).toBeLessThanOrEqual(length);
        seen.add(at);
        last = at;
      }
      // Every offset is some boundary point's.
      expect(seen.size).toBe(length + 1);
      if (length > 3) t.count('long');
    }), runs(RUNS));
    t.atLeast('long', 50);
  }, timeoutFor(RUNS, 20));
});
