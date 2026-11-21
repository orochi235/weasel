import { expect, it } from 'vitest';
import { measureContextIn } from './measureContext';

it('keeps one measuring canvas per document, made in that document', () => {
  const frame = document.body.appendChild(document.createElement('iframe'));
  const other = frame.contentDocument!;
  const made: Document[] = [];
  for (const doc of [document, other]) {
    const real = doc.createElement.bind(doc);
    doc.createElement = ((tag: string) => {
      const el = real(tag);
      if (tag === 'canvas') {
        made.push(doc);
        (el as HTMLCanvasElement).getContext = (() => ({ doc })) as unknown as HTMLCanvasElement['getContext'];
      }
      return el;
    }) as typeof doc.createElement;
  }
  const here = measureContextIn(document) as unknown as { doc: Document } | null;
  const there = measureContextIn(other) as unknown as { doc: Document } | null;
  expect(here?.doc).toBe(document);
  expect(there?.doc).toBe(other);
  expect(measureContextIn(other)).toBe(there);
  expect(made).toEqual([document, other]);
  frame.remove();
});
