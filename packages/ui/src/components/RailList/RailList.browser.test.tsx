import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/faces.css';
import { cleanup, render, screen } from '@testing-library/react';
import { Header } from 'react-aria-components';
import { afterEach, expect, test } from 'vitest';
import { RailItem, RailList, RailListBox, RailName, RailOption, RailSection } from '@weasel-js/ui/components/RailList';

// The accent fill, the bracket and the ellipsis are all stylesheet, which jsdom does not resolve.

afterEach(cleanup);

test('the current entry is filled and the rest are not', () => {
  render(
    <RailList>
      <RailItem current>Canvas</RailItem>
      <RailItem>Export</RailItem>
    </RailList>,
  );
  const fill = (name: string) => getComputedStyle(screen.getByRole('button', { name })).backgroundColor;
  expect(fill('Canvas')).not.toBe('rgba(0, 0, 0, 0)');
  expect(fill('Export')).toBe('rgba(0, 0, 0, 0)');
});

test('a name too long for its rail ends in an ellipsis inside it', () => {
  render(
    <div style={{ width: 80 }}>
      <RailList>
        <RailItem><RailName>A page whose name runs far past the rail</RailName></RailItem>
      </RailList>
    </div>,
  );
  const item = screen.getByRole('button');
  const name = item.firstElementChild as HTMLElement;
  expect(getComputedStyle(name).textOverflow).toBe('ellipsis');
  expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
  expect(item.getBoundingClientRect().right).toBeLessThanOrEqual(80.5);
});

test('an open section draws its bracket from below its heading, and a closed one none', () => {
  render(
    <RailListBox aria-label="Assets" selectionMode="single">
      <RailSection guide aria-label="Open">
        <Header>Dialogs</Header>
        <RailOption id="main" textValue="Main">Main</RailOption>
      </RailSection>
      <RailSection aria-label="Shut">
        <Header>Menus</Header>
      </RailSection>
    </RailListBox>,
  );
  const [open, shut] = screen.getAllByRole('group');
  const bracket = getComputedStyle(open!, '::before');
  expect(bracket.content).toBe('""');
  expect(bracket.borderInlineStartWidth).toBe('1px');
  expect(Number.parseFloat(bracket.top)).toBeGreaterThan(0);
  expect(getComputedStyle(shut!, '::before').content).toBe('none');
});
