import { afterEach, expect, it, vi } from 'vitest';
import { warnUnmatchedRenderers } from './unmatchedRenderers';

afterEach(() => vi.restoreAllMocks());

const num = (name: string) => ({ kind: 'number', name, description: '', default: 0 });
const schema = {
  name: 'Prefs',
  children: {
    stroke: { kind: 'object', name: 'Stroke', description: '', default: {}, children: { look: { name: 'Look', members: { width: num('Width') } } } },
    more: { name: 'More', members: { gap: num('Gap') } },
  },
};

it('takes a renderer keyed by the path of a field in a section, since a section key is no segment of it', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  warnUnmatchedRenderers({ 'stroke.width': 1, gap: 1 }, schema);
  expect(warn).not.toHaveBeenCalled();
});

it('warns of a renderer keyed through a section key, which names no leaf', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  warnUnmatchedRenderers({ 'stroke.look.width': 1, 'more.gap': 1 }, schema);
  expect(warn).toHaveBeenCalledTimes(2);
});
