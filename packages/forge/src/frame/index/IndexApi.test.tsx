import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ApiTable } from '../../story/api';
import { meta, story } from '../../story/define';
import { loadNativeModule } from '../../story/native';
import { runAxe } from '../a11y';
import { type IndexEnv, IndexPage } from './IndexPage';
import { clipped, DEF_LINES } from './TypeText';

const stories = loadNativeModule(
  { default: meta({ title: 'ui/Chart' }), Basic: story({ render: () => <p>chart</p> }) },
  'ui/Chart',
);

const API: ApiTable = {
  props: [
    { name: 'label', type: 'string', required: true, description: 'Shown beside the glyph.' },
    { name: 'size', type: "'sm' | 'md'", required: false, default: "'md'" },
    { name: 'loud', type: 'boolean', required: false, deprecated: 'use tone' },
    { name: 'data', type: 'number[]', required: true },
  ],
  inherited: [{ from: 'DomProps', count: 2 }],
  ref: {
    type: 'ChartHandle',
    members: [
      { name: 'width', kind: 'property', signature: 'number', readonly: true },
      { name: 'toModel', kind: 'method', signature: '(pt: Point) => Point', readonly: false, description: 'Maps a point.' },
    ],
  },
  types: { Point: { text: 'interface Point {\n    x: number;\n}', description: 'A plot point.' } },
};

const envOf = (over: Partial<IndexEnv> = {}): IndexEnv => ({
  title: 'ui/Chart',
  stories,
  descriptions: {},
  globals: {},
  decorators: [],
  open: vi.fn(),
  onError: vi.fn(),
  api: API,
  ...over,
});

const panel = () => screen.getByRole('complementary', { name: 'API' });
/** The `dd` describing the prop or member named `name`. */
const entry = (name: string) => within(panel()).getByText(name, { selector: 'code' }).closest('dt')?.nextElementSibling as HTMLElement;
const hasText = (text: string) => (_: string, el: Element | null) => el?.textContent === text && !el.querySelector('p, li');

describe('IndexApi', () => {
  it('lists each prop with its type, default and description', () => {
    render(<IndexPage env={envOf()} render={null} />);
    expect(entry('label')).toHaveTextContent('string');
    expect(entry('label')).toHaveTextContent('Shown beside the glyph.');
    expect(entry('size')).toHaveTextContent("'sm' | 'md'");
    expect(entry('size')).toHaveTextContent("Default: 'md'");
  });

  it('marks a required prop and a deprecated one', () => {
    render(<IndexPage env={envOf()} render={null} />);
    const label = within(panel()).getByText('label', { selector: 'code' }).closest('dt') as HTMLElement;
    expect(within(label).getByText('required')).toBeTruthy();
    expect(within(entry('loud')).getByText('Deprecated: use tone')).toBeTruthy();
  });

  it('lists required props first, each group by name, and tints the required badge with the secondary accent', () => {
    render(<IndexPage env={envOf()} render={null} />);
    const names = within(panel()).getAllByRole('term').map((dt) => dt.querySelector('code')?.textContent);
    expect(names.slice(0, 4)).toEqual(['data', 'label', 'loud', 'size']);
    const badge = within(panel()).getAllByText('required')[0]!.closest('[data-tint]');
    expect(badge?.getAttribute('data-tint')).toBe('var(--wzl-secondary-fg)');
  });

  it('shows a declared type’s definition on focus of its name, and leaves other names as text', () => {
    render(<IndexPage env={envOf()} render={null} />);
    const [point] = within(entry('toModel')).getAllByRole('img', { name: 'Point' });
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => point!.focus());
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('A plot point.');
    expect(tip.querySelector('pre')?.textContent).toBe('interface Point {\n    x: number;\n}');
    expect(within(entry('label')).queryByRole('img')).toBeNull();
  });

  it('cuts a long definition short and counts what it left out', () => {
    const text = Array.from({ length: DEF_LINES + 3 }, (_, i) => `line ${i}`).join('\n');
    expect(clipped(text).split('\n')).toHaveLength(DEF_LINES + 1);
    expect(clipped(text).endsWith('… 3 more lines')).toBe(true);
    expect(clipped('a\nb')).toBe('a\nb');
  });

  it('collapses inherited props to one line per source', () => {
    render(<IndexPage env={envOf()} render={null} />);
    expect(within(panel()).getByText(hasText('+ 2 from DomProps'))).toBeTruthy();
  });

  it("lists the ref handle's methods before its properties", () => {
    render(<IndexPage env={envOf()} render={null} />);
    const ref = within(panel()).getByRole('heading', { name: 'Ref' });
    expect(ref.nextElementSibling).toHaveTextContent('ChartHandle');
    const names = within(panel()).getAllByRole('term').map((dt) => dt.querySelector('code')?.textContent);
    expect(names.slice(-2)).toEqual(['toModel', 'width']);
    expect(entry('toModel')).toHaveTextContent('(pt: Point) => Point');
    expect(entry('width').previousElementSibling).toHaveTextContent('readonly');
  });

  it("links to the component's API reference page, and shows a member's overloads and where it is inherited from", () => {
    const api: ApiTable = {
      ...API,
      href: 'https://example.com/#pkg/ui/reference/Chart',
      props: [{ name: 'tone', type: 'string', required: false, inheritedFrom: 'Toned' }],
      ref: {
        type: 'ChartHandle',
        members: [
          {
            name: 'toModel',
            kind: 'method',
            signature: '(pt: Point) => Point',
            readonly: false,
            overloads: ['(x: number, y: number) => Point'],
            inheritedFrom: 'Mapper',
          },
        ],
      },
    };
    render(<IndexPage env={envOf({ api })} render={null} />);
    expect(within(panel()).getByRole('link', { name: 'API reference' }).getAttribute('href')).toBe(api.href);
    expect(entry('tone')).toHaveTextContent('Inherited from Toned');
    expect(entry('toModel')).toHaveTextContent('(pt: Point) => Point');
    expect(entry('toModel')).toHaveTextContent('(x: number, y: number) => Point');
    expect(entry('toModel')).toHaveTextContent('Inherited from Mapper');
  });

  it('names a platform ref type with no member list', () => {
    render(<IndexPage env={envOf({ api: { ...API, ref: { type: 'HTMLDivElement', members: [] } } })} render={null} />);
    expect(within(panel()).getByText('HTMLDivElement')).toBeTruthy();
    expect(within(panel()).queryByText('toModel')).toBeNull();
  });

  it('says when a component takes no props', () => {
    render(<IndexPage env={envOf({ api: { props: [], inherited: [], ref: null } })} render={null} />);
    expect(within(panel()).getByText('Takes no props.')).toBeTruthy();
    expect(within(panel()).queryByRole('heading', { name: 'Ref' })).toBeNull();
  });

  it('says when forge found no component', () => {
    render(<IndexPage env={envOf({ api: null })} render={null} />);
    expect(panel()).toHaveTextContent(/forge found no component/);
  });

  it('shows no panel where no API was read, as for a gallery', () => {
    render(<IndexPage env={envOf({ api: undefined })} render={null} />);
    expect(screen.queryByRole('complementary', { name: 'API' })).toBeNull();
  });

  it('is not a tab stop while it holds nothing to scroll', () => {
    render(<IndexPage env={envOf()} render={null} />);
    expect(panel().hasAttribute('tabindex')).toBe(false);
  });

  it('is a part a custom page can place', () => {
    render(<IndexPage env={envOf()} render={({ Api }) => <Api />} />);
    expect(entry('label')).toHaveTextContent('string');
  });

  it('passes axe', async () => {
    const { container } = render(<IndexPage env={envOf()} render={null} />);
    expect((await runAxe(container, { page: false })).violations).toEqual([]);
  });
});
