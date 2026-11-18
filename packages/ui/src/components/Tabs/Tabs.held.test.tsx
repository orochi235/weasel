import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Tabs, TabList, Tab, TabPanel } from './Tabs';

afterEach(cleanup);

function Sample({ first = false, onSelectionChange }: { first?: boolean; onSelectionChange?: (k: unknown) => void }) {
  return (
    <Tabs {...(onSelectionChange ? { onSelectionChange } : {})}>
      <TabList aria-label="Sections">
        {first && <Tab id="z" disabled disabledReason="Nothing here yet">Z</Tab>}
        <Tab id="a">A</Tab>
        <Tab id="b" disabled disabledReason="Add a layer first">B</Tab>
        <Tab id="c">C</Tab>
      </TabList>
      {first && <TabPanel id="z">panel-z</TabPanel>}
      <TabPanel id="a">panel-a</TabPanel>
      <TabPanel id="b">panel-b</TabPanel>
      <TabPanel id="c">panel-c</TabPanel>
    </Tabs>
  );
}

const tab = (name: string) => screen.getByRole('tab', { name });
const arrow = (from: HTMLElement, key = 'ArrowRight') => {
  act(() => { fireEvent.keyDown(from, { key }); });
  act(() => { fireEvent.keyUp(from, { key }); });
};

describe('a disabled Tab', () => {
  it('takes the arrow keys, reads as disabled and says why, and keeps the chosen tab', () => {
    const onSelectionChange = vi.fn();
    render(<Sample onSelectionChange={onSelectionChange} />);
    onSelectionChange.mockClear();
    act(() => tab('A').focus());
    arrow(tab('A'));
    expect(document.activeElement).toBe(tab('B'));
    expect(tab('B')).toHaveAttribute('aria-disabled', 'true');
    expect(tab('B')).toHaveAttribute('aria-description', 'Add a layer first');
    expect(screen.getByRole('tooltip').textContent).toContain('Add a layer first');
    expect(screen.getByText('panel-a')).toBeTruthy();
    expect(screen.queryByText('panel-b')).toBeNull();
    expect(onSelectionChange).not.toHaveBeenCalled();
    arrow(tab('B'));
    expect(document.activeElement).toBe(tab('C'));
    expect(screen.getByText('panel-c')).toBeTruthy();
  });

  it('is not chosen by a click', () => {
    render(<Sample />);
    fireEvent.click(tab('B'));
    expect(screen.getByText('panel-a')).toBeTruthy();
  });

  it('is passed over when the set opens, for the first tab that can be chosen', () => {
    render(<Sample first />);
    expect(screen.getByText('panel-a')).toBeTruthy();
    expect(screen.queryByText('panel-z')).toBeNull();
  });
});
