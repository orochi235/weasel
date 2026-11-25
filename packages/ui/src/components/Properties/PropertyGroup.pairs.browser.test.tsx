import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, test } from 'vitest';
import { PropertyField, PropertyGroup, PropertyNote } from '@weasel-js/ui/components/Properties';

// A paired group's rows pack as a paired list's do; how wide each one lands is a layout question.

afterEach(cleanup);

const rowOf = (label: string) => screen.getByText(label).closest('[class*="rowLabel"]')!.parentElement!;

function group(children: ReactNode) {
  render(
    <div style={{ width: 320 }}>
      <PropertyGroup title="Shape" pack="pairs">{children}</PropertyGroup>
    </div>,
  );
}

/** That `el` runs from the leading edge of the W row to the trailing edge of the H row beside it. */
function spansPair(el: Element) {
  const [w, h, box] = [rowOf('W'), rowOf('H'), el].map((e) => e.getBoundingClientRect());
  expect(w.top).toBe(h.top);
  expect(box.left).toBe(w.left);
  expect(box.right).toBe(h.right);
}

test('a note in a paired group spans both columns', () => {
  group(
    <>
      <PropertyNote>About these</PropertyNote>
      <PropertyField kind="number" label="W" value={1} onChange={() => {}} />
      <PropertyField kind="number" label="H" value={1} onChange={() => {}} />
    </>,
  );
  spansPair(screen.getByText('About these'));
});

test('a nested group in a paired group spans both columns', () => {
  group(
    <>
      <PropertyGroup title="Inner" className="inner">
        <PropertyField kind="number" label="X" value={1} onChange={() => {}} />
      </PropertyGroup>
      <PropertyField kind="number" label="W" value={1} onChange={() => {}} />
      <PropertyField kind="number" label="H" value={1} onChange={() => {}} />
    </>,
  );
  spansPair(document.querySelector('.inner')!);
});
