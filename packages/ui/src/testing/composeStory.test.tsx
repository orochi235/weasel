import { createElement, type ComponentType, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { storiesOf } from './composeStory';

const NATIVE = Symbol.for('weaselforge.native');
type Ctx = Record<string, unknown>;
const names = (mod: Record<string, unknown>) => storiesOf(mod).map(([name]) => name);
const text = (story: ComponentType) => render(createElement(story)).container.textContent;

describe('storiesOf', () => {
  it('takes only story() exports from a native module', () => {
    const mod = {
      default: { [NATIVE]: 'meta' },
      Plain: { [NATIVE]: 'story', render: () => 'plain' },
      sampleRows: (n: number) => Array.from({ length: n }),
      table: { rows: 3 },
    };
    expect(names(mod)).toEqual(['Plain']);
  });

  it('skips what a CSF meta excludes, and keeps only what it includes', () => {
    const component = () => 'tag';
    expect(names({ default: { component, excludeStories: /Data$/ }, Basic: {}, sampleData: {} })).toEqual(['Basic']);
    expect(names({ default: { component, excludeStories: ['helper'] }, Basic: {}, helper: () => 'h' })).toEqual(['Basic']);
    expect(names({ default: { component, includeStories: ['Basic'] }, Basic: {}, Other: {} })).toEqual(['Basic']);
    expect(names({ default: { component }, Basic: {}, __namedExportsOrder: ['Basic'] })).toEqual(['Basic']);
  });

  it("keeps a CSF 2 function story's hoisted args and decorators", () => {
    const Primary = Object.assign((args: Ctx) => `label=${String(args.label)}`, {
      args: { label: 'Go' },
      decorators: [(Story: ComponentType): ReactNode => createElement('b', null, '[', createElement(Story), ']')],
    });
    const [[, story]] = storiesOf({ default: {}, Primary });
    expect(text(story)).toBe('[label=Go]');
  });
});
