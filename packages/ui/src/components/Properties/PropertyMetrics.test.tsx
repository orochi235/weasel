import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Subpanel } from './EffectCard';
import s from './Properties.module.css';
import { PropertyGroup } from './PropertyGroup';
import {
  CheckboxRow,
  ColorRow,
  PropertyList,
  type PropertyMetricProps,
  PropertyPanel,
  PropertyRow,
} from './PropertyPanel';

// The CSS-module proxy answers to any key, so `s.densityTight` resolves whether
// or not a rule defines it — a class assertion alone proves only that the
// component asked for the key. Read from disk instead, so the other tests here
// stand on a rule that exists. `?raw` does not get past the proxy; vitest runs
// from the repo root, so the path is relative to it.
const sheet = readFileSync(
  resolve(process.cwd(), 'packages/ui/src/components/Properties/Properties.module.css'),
  'utf8',
);

describe('density and align classes', () => {
  it('defines a rule for every class the components ask for', () => {
    for (const name of [
      'densityTight',
      'densityNormal',
      'densityRoomy',
      'alignStart',
      'alignCenter',
      'alignEnd',
      'alignBaseline',
      'rowBlock',
      'listOneUp',
      'groupOneUp',
    ]) {
      expect(sheet, `.${name} has no rule`).toMatch(new RegExp(`\\.${name}[\\s.,{]`));
    }
  });

  it('reads every container metric from a custom property', () => {
    // The gap this closes: a consumer moving spacing from outside the module.
    // A literal here is a metric that can only be reached by selector surgery.
    for (const token of [
      '--wzl-prop-panel-pad',
      '--wzl-prop-panel-title-gap',
      '--wzl-prop-row-gap',
      '--wzl-prop-column-gap',
      '--wzl-prop-group-pad',
      '--wzl-prop-group-title-gap',
      '--wzl-prop-subpanel-row-gap',
      '--wzl-prop-field-h',
      '--wzl-prop-field-pad-x',
      '--wzl-prop-row-align',
      '--wzl-prop-row-align-content',
    ]) {
      expect(sheet, `${token} is never read`).toContain(`var(${token},`);
    }
  });
});

describe('container metric props', () => {
  const containers: ReadonlyArray<
    readonly [string, (m: PropertyMetricProps & { className?: string }) => ReactNode, string]
  > = [
    ['PropertyPanel', (m) => <PropertyPanel {...m}>child</PropertyPanel>, s.panel],
    ['PropertyList', (m) => <PropertyList {...m}>child</PropertyList>, s.list],
    ['Subpanel', (m) => <Subpanel {...m} title="T">child</Subpanel>, s.subpanel],
    ['PropertyGroup', (m) => <PropertyGroup {...m} title="T">child</PropertyGroup>, s.group],
  ];

  for (const [name, renderContainer, baseClass] of containers) {
    it(`${name} takes density and align`, () => {
      const { container } = render(renderContainer({ density: 'tight', align: 'start' }));
      const el = container.querySelector(`.${baseClass}`);
      expect(el).not.toBeNull();
      expect(el?.className).toContain(s.densityTight);
      expect(el?.className).toContain(s.alignStart);
    });

    it(`${name} keeps a consumer className alongside them`, () => {
      const { container } = render(renderContainer({ density: 'roomy', className: 'mine' }));
      const el = container.querySelector(`.${baseClass}`);
      expect(el?.className).toContain('mine');
      expect(el?.className).toContain(s.densityRoomy);
    });

    it(`${name} carries neither class when neither prop is passed`, () => {
      const { container } = render(renderContainer({}));
      const el = container.querySelector(`.${baseClass}`);
      expect(el?.className).not.toContain(s.densityNormal);
      expect(el?.className).not.toContain(s.alignCenter);
    });
  }
});

describe('one-up packing', () => {
  it('gives a color row the full width, which the other packings do not', () => {
    const swatch = <ColorRow label="Fill" value="#ffffff" onChange={() => {}} />;
    const { container: oneUp } = render(<PropertyList pack="one-up">{swatch}</PropertyList>);
    const { container: autoColor } = render(<PropertyList>{swatch}</PropertyList>);

    expect(oneUp.querySelector(`.${s.list}`)?.className).toContain(s.listOneUp);
    expect(autoColor.querySelector(`.${s.list}`)?.className).not.toContain(s.listOneUp);
    // jsdom resolves no grid, so the rule itself is checked in the stylesheet.
    expect(sheet).toMatch(/\.listOneUp > \* \{\s*grid-column: 1 \/ -1;/);
  });

  it('does the same inside a group', () => {
    const { container } = render(
      <PropertyGroup title="T" pack="one-up">
        <ColorRow label="Fill" value="#ffffff" onChange={() => {}} />
      </PropertyGroup>,
    );
    expect(container.querySelector(`.${s.group}`)?.className).toContain(s.groupOneUp);
    expect(sheet).toMatch(/\.groupOneUp \.groupBody > \* \{\s*grid-column: 1 \/ -1;/);
  });
});

describe('layout across row variants', () => {
  it('stacks the default variant and leaves the color and checkbox rows inline', () => {
    const { container } = render(
      <>
        <PropertyRow label="A">
          <input type="text" readOnly value="" />
        </PropertyRow>
        <ColorRow label="B" value="#ffffff" onChange={() => {}} />
        <CheckboxRow label="C" value={false} onChange={() => {}} />
      </>,
    );
    for (const row of container.querySelectorAll(`.${s.row}`)) {
      expect(row.className).not.toContain(s.rowInline);
      expect(row.className).not.toContain(s.rowBlock);
    }
  });

  it('gives the default variant an inline class and the other two a block one', () => {
    const { container } = render(
      <>
        <PropertyRow label="A" layout="inline">
          <input type="text" readOnly value="" />
        </PropertyRow>
        <PropertyRow label="A2" layout="block">
          <input type="text" readOnly value="" />
        </PropertyRow>
        <ColorRow label="B" value="#ffffff" onChange={() => {}} layout="block" />
        <ColorRow label="B2" value="#ffffff" onChange={() => {}} layout="inline" />
        <CheckboxRow label="C" value={false} onChange={() => {}} layout="block" />
        <CheckboxRow label="C2" value={false} onChange={() => {}} layout="inline" />
      </>,
    );
    const cls = (label: string) =>
      [...container.querySelectorAll(`.${s.row}`)].find((r) => r.textContent === label)?.className;

    expect(cls('A')).toContain(s.rowInline);
    expect(cls('A2')).not.toContain(s.rowBlock);
    expect(cls('B')).toContain(s.rowBlock);
    expect(cls('B2')).not.toContain(s.rowInline);
    expect(cls('C')).toContain(s.rowBlock);
    expect(cls('C2')).not.toContain(s.rowInline);
  });

  it('lets a single color row align itself without a container', () => {
    const { container } = render(
      <ColorRow label="B" value="#ffffff" onChange={() => {}} align="start" />,
    );
    expect(container.querySelector(`.${s.rowColor}`)?.className).toContain(s.alignStart);
  });
});
