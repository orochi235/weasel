import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import type { CSSProperties, ReactNode } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { InlineRange } from './InlineRange';
import { OptionsBar } from './OptionsBar/OptionsBar';
import { Tab, TabList, TabPanel, Tabs } from './Tabs';
import { ToolButton } from './ToolButton';
import bar from './Bar/Bar.module.css';
import slider from './Slider/Slider.module.css';
import options from './ToolOptionsBar/ToolOptionsBar.module.css';
import palette from './ToolPalette/ToolPalette.module.css';

// The marks, fields, buttons, and overlays are pinned in bevel.browser.test.tsx. These are the
// controls whose shadow differs by variant, and the tab, whose bevel is open along one edge.

afterEach(cleanup);

const HOOKS = {
  '--wzl-bevel-sunken': 'inset 1px 1px 0 rgb(255, 0, 0)',
  '--wzl-bevel-raised': 'inset 2px 2px 0 rgb(0, 0, 255)',
  '--wzl-bevel-pressed': 'inset 3px 3px 0 rgb(0, 128, 0)',
};
/** How Chromium serializes the three above. */
const SUNKEN = 'rgb(255, 0, 0) 1px 1px 0px 0px inset';
const RAISED = 'rgb(0, 0, 255) 2px 2px 0px 0px inset';
const PRESSED = 'rgb(0, 128, 0) 3px 3px 0px 0px inset';

function Scope({ hooks, children }: { hooks?: boolean; children: ReactNode }) {
  return <div style={hooks ? (HOOKS as CSSProperties) : undefined}>{children}</div>;
}

const shadow = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo).boxShadow;
const parts = (value: string) => value.split('rgb').length - 1;

type Variant = 'default' | 'minimal' | 'flat';
const Segments = ({ variant }: { variant: Variant }) => (
  <OptionsBar
    ariaLabel={variant}
    variant={variant}
    items={['On', 'Off'].map((label, i) => ({ value: label, label, selected: i === 0, onChange: () => {} }))}
  />
);
const track = (variant: Variant) => screen.getByRole('group', { name: variant });
const segment = (variant: Variant, name: string) => [...track(variant).querySelectorAll('button')].find((el) => el.textContent === name)!;

describe('a segmented control', () => {
  test('with no hook set keeps its well and its glass, and a flat cell no shadow', () => {
    render(<Scope><Segments variant="default" /><Segments variant="flat" /></Scope>);
    expect(parts(shadow(track('default')))).toBe(2);
    expect(parts(shadow(segment('default', 'On')))).toBe(5);
    expect(shadow(segment('flat', 'On'))).toBe('none');
    expect(shadow(segment('flat', 'Off'))).toBe('none');
  });

  test('takes --wzl-bevel-sunken on its track and --wzl-bevel-raised on the chosen segment', () => {
    render(<Scope hooks><Segments variant="default" /></Scope>);
    expect(shadow(track('default'))).toBe(SUNKEN);
    expect(shadow(segment('default', 'On'))).toBe(RAISED);
    expect(shadow(segment('default', 'Off'))).toBe('none');
  });

  test('sinks each flat cell and raises the chosen one, with no track under them', () => {
    render(<Scope hooks><Segments variant="flat" /></Scope>);
    expect(shadow(track('flat'))).toBe('none');
    expect(shadow(segment('flat', 'Off'))).toBe(SUNKEN);
    expect(shadow(segment('flat', 'On'))).toBe(RAISED);
  });

  test('draws no bevel as bare words', () => {
    render(<Scope hooks><Segments variant="minimal" /></Scope>);
    expect(shadow(track('minimal'))).toBe('none');
    expect(shadow(segment('minimal', 'On'))).toBe('none');
    expect(shadow(segment('minimal', 'Off'))).toBe('none');
  });
});

describe('a slider', () => {
  const sliders = (
    <>
      <div className={slider.root}><div className={slider.track} data-testid="track"><div className={slider.thumb} data-testid="thumb" /></div></div>
      <div className={slider.root}><div className={slider.track}><div className={`${slider.thumb} ${slider.dot}`} data-testid="dot" /></div></div>
      <InlineRange aria-label="Native" value={5} onChange={() => {}} />
    </>
  );

  test('with no hook set has a flat track, and a thumb of either shape casts a shadow', () => {
    render(<Scope>{sliders}</Scope>);
    expect(shadow(screen.getByTestId('track'))).toBe('none');
    expect(shadow(screen.getByTestId('thumb'))).toBe('rgba(0, 0, 0, 0.2) 0px 1px 2px 0px');
    expect(shadow(screen.getByTestId('dot'))).toBe('rgba(0, 0, 0, 0.2) 0px 1px 2px 0px');
  });

  test('takes --wzl-bevel-sunken on its track and --wzl-bevel-raised on a thumb of either shape', () => {
    render(<Scope hooks>{sliders}</Scope>);
    expect(shadow(screen.getByTestId('track'))).toBe(SUNKEN);
    expect(shadow(screen.getByTestId('thumb'))).toBe(RAISED);
    expect(shadow(screen.getByTestId('dot'))).toBe(RAISED);
  });

  // A proxy: `getComputedStyle` answers for a native range's track and thumb with the input's own
  // style, so this reads the rules Chromium parsed for them and not what either is drawn with.
  test('and declares the same two for the track and thumb of a native range', () => {
    render(<Scope hooks>{sliders}</Scope>);
    const range = screen.getByRole('slider', { name: 'Native' });
    const declared = (pseudo: string): string[] =>
      [...document.styleSheets]
        .flatMap((sheet) => [...sheet.cssRules])
        .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && rule.selectorText.endsWith(pseudo))
        .filter((rule) => range.matches(rule.selectorText.slice(0, -pseudo.length)))
        .map((rule) => rule.style.boxShadow)
        .filter((value) => value !== '');
    expect(declared('::-webkit-slider-runnable-track')).toEqual(['var(--wzl-bevel-sunken, none)']);
    expect(declared('::-webkit-slider-thumb')).toEqual(['var(--wzl-bevel-raised, none)']);
  });
});

describe('a tab', () => {
  const tabs = (orientation: 'horizontal' | 'vertical') => (
    <Tabs orientation={orientation} defaultSelectedKey="a">
      <TabList aria-label="Pages">
        <Tab id="a">First</Tab>
        <Tab id="b">Second</Tab>
      </TabList>
      <TabPanel id="a">one</TabPanel>
      <TabPanel id="b">two</TabPanel>
    </Tabs>
  );
  const edge = (name: string) => getComputedStyle(screen.getByRole('tab', { name }), '::before');

  test('with no hook set draws no edge', () => {
    render(<Scope>{tabs('horizontal')}</Scope>);
    expect(edge('First').boxShadow).toBe('none');
    expect(shadow(screen.getByRole('tab', { name: 'First' }))).toBe('none');
  });

  test('takes --wzl-bevel-raised on three edges, open along the bottom of a row of tabs', () => {
    render(<Scope hooks>{tabs('horizontal')}</Scope>);
    for (const name of ['First', 'Second']) {
      const tab = screen.getByRole('tab', { name });
      expect(edge(name).boxShadow).toBe(RAISED);
      expect(edge(name).clipPath).toBe('inset(0px 0px 8px)');
      expect(Number.parseFloat(edge(name).height)).toBeCloseTo(tab.getBoundingClientRect().height + 8, 2);
      expect(Number.parseFloat(edge(name).width)).toBeCloseTo(tab.getBoundingClientRect().width, 2);
    }
  });

  test('and open along the side its panel is on in a column of them', () => {
    render(<Scope hooks>{tabs('vertical')}</Scope>);
    const tab = screen.getByRole('tab', { name: 'First' });
    expect(edge('First').boxShadow).toBe(RAISED);
    expect(edge('First').clipPath).toBe('inset(0px 8px 0px 0px)');
    expect(Number.parseFloat(edge('First').width)).toBeCloseTo(tab.getBoundingClientRect().width + 8, 2);
    expect(Number.parseFloat(edge('First').height)).toBeCloseTo(tab.getBoundingClientRect().height, 2);
  });
});

describe('a toolbar', () => {
  const strips = (
    <>
      <div className={palette.palette} data-testid="palette" />
      <div className={bar.segmented} data-testid="actions" />
      <div className={`${bar.bar} ${bar.framed}`} data-testid="framed" />
      <div className={bar.bar} data-testid="bare" />
      <div className={options.root} data-testid="options" />
      <ToolButton icon={null} label="Held" active onClick={() => {}} />
      <ToolButton icon={null} label="Up" onClick={() => {}} />
      <button type="button" className={bar.action} aria-pressed="true">Down</button>
      <button type="button" className={bar.action}>Rest</button>
    </>
  );
  const STRIPS = ['palette', 'actions', 'framed', 'options'];

  test('with no hook set draws no shadow', () => {
    render(<Scope>{strips}</Scope>);
    for (const id of [...STRIPS, 'bare']) expect(shadow(screen.getByTestId(id))).toBe('none');
    for (const name of ['Held', 'Up', 'Down', 'Rest']) expect(shadow(screen.getByRole('button', { name }))).toBe('none');
  });

  test('takes --wzl-bevel-raised on the strip it draws, and none where the host draws the strip', () => {
    render(<Scope hooks>{strips}</Scope>);
    for (const id of STRIPS) expect(shadow(screen.getByTestId(id))).toBe(RAISED);
    expect(shadow(screen.getByTestId('bare'))).toBe('none');
  });

  test('takes --wzl-bevel-pressed on a button that stays down, and none on one at rest', () => {
    render(<Scope hooks>{strips}</Scope>);
    expect(shadow(screen.getByRole('button', { name: 'Held' }))).toBe(PRESSED);
    expect(shadow(screen.getByRole('button', { name: 'Down' }))).toBe(PRESSED);
    expect(shadow(screen.getByRole('button', { name: 'Up' }))).toBe('none');
    expect(shadow(screen.getByRole('button', { name: 'Rest' }))).toBe('none');
  });
});
