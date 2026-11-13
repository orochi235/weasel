// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { API_EXPORT } from '../story/api';
import type { ReadApi } from './apiTable';
import { storyExports } from './propControls';
import type { PropReader } from './propTypes';
import type { TypedocDocs } from './typedoc';

const API: ReadApi = {
  props: [{ name: 'label', type: 'string', required: true }],
  inherited: [],
  ref: null,
  sources: ['/repo/Chip.ts'],
};

const readerOf = (over: Partial<PropReader> = {}): PropReader => ({
  read: () => ({ argTypes: { label: { control: { type: 'text' } } }, sources: ['/repo/ChipProps.ts'] }),
  api: () => API,
  ...over,
});

/** The value of `export const <name> = …;` in `code`; undefined when it has no such export. */
const exported = (code: string, name: string): unknown => {
  const line = code.split('\n').find((l) => l.startsWith(`export const ${name} = `));
  return line === undefined ? undefined : JSON.parse(line.slice(`export const ${name} = `.length, -1));
};

describe('storyExports', () => {
  it("appends the component's API to a story module, without its source paths", () => {
    const out = storyExports(readerOf(), '/repo/chip.stories.ts', 'Chip', { controls: true, api: true }, vi.fn());
    expect(exported(out.code, API_EXPORT)).toEqual({ props: API.props, inherited: [], ref: null });
    expect(out.sources).toEqual(['/repo/ChipProps.ts', '/repo/Chip.ts']);
  });

  it("enriches the API from TypeDoc's output, which an edit to must reach the story too", () => {
    const read: ReadApi = { ...API, component: { name: 'Chip', file: '/repo/Chip.ts' } };
    const docs: TypedocDocs = {
      mtime: Number.MAX_SAFE_INTEGER,
      component: () => ({ href: 'https://example.com/#Chip', props: new Map([['label', { description: 'The text.' }]]), members: new Map() }),
    };
    const typedoc = { file: '/repo/dist/typedoc.json', docs: () => docs };
    const out = storyExports(readerOf({ api: () => read }), '/repo/chip.stories.ts', 'Chip', { controls: false, api: true }, vi.fn(), typedoc);
    expect(exported(out.code, API_EXPORT)).toEqual({
      props: [{ name: 'label', type: 'string', required: true, description: 'The text.' }],
      inherited: [],
      ref: null,
      href: 'https://example.com/#Chip',
    });
    expect(out.sources).toEqual(['/repo/Chip.ts', '/repo/dist/typedoc.json']);
  });

  it('leaves a TypeDoc JSON that is not there out of what the story watches', () => {
    const read: ReadApi = { ...API, component: { name: 'Chip', file: '/repo/Chip.ts' } };
    const typedoc = { file: '/repo/dist/typedoc.json', docs: () => null };
    const out = storyExports(readerOf({ api: () => read }), '/repo/chip.stories.ts', 'Chip', { controls: false, api: true }, vi.fn(), typedoc);
    expect(out.sources).toEqual(['/repo/Chip.ts']);
  });

  it('passes the fallback name to the reader', () => {
    const api = vi.fn(() => API);
    storyExports(readerOf({ api }), '/repo/chip.stories.ts', 'Chip', { controls: true, api: true }, vi.fn());
    expect(api).toHaveBeenCalledWith('/repo/chip.stories.ts', 'Chip');
  });

  it('exports null when no component is named, so the page can say so', () => {
    const out = storyExports(readerOf({ api: () => null }), '/repo/x.stories.ts', undefined, { controls: true, api: true }, vi.fn());
    expect(exported(out.code, API_EXPORT)).toBeNull();
  });

  it('appends no API when the option is off', () => {
    const out = storyExports(readerOf(), '/repo/chip.stories.ts', 'Chip', { controls: true, api: false }, vi.fn());
    expect(out.code).not.toContain(API_EXPORT);
    expect(out.code).toContain('__forgeArgTypes');
  });

  it('serves a story whose API cannot be read', () => {
    const warn = vi.fn();
    const api = () => {
      throw new Error('boom');
    };
    const out = storyExports(readerOf({ api }), '/repo/chip.stories.ts', 'Chip', { controls: true, api: true }, warn);
    expect(out.code).toContain('__forgeArgTypes');
    expect(out.code).not.toContain(API_EXPORT);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('/repo/chip.stories.ts');
  });
});
