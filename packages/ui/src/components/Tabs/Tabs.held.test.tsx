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

  it('opens on the first tab that can be chosen without calling onSelectionChange', () => {
    const onSelectionChange = vi.fn();
    render(<Sample first onSelectionChange={onSelectionChange} />);
    expect(screen.getByText('panel-a')).toBeTruthy();
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('falls back to the first tab that can be chosen when the chosen tab is removed', () => {
    const onSelectionChange = vi.fn();
    const set = (withC: boolean) => (
      <Tabs onSelectionChange={onSelectionChange}>
        <TabList aria-label="Sections">
          <Tab id="z" disabled>Z</Tab>
          <Tab id="a">A</Tab>
          {withC && <Tab id="c">C</Tab>}
        </TabList>
        <TabPanel id="z">panel-z</TabPanel>
        <TabPanel id="a">panel-a</TabPanel>
        {withC && <TabPanel id="c">panel-c</TabPanel>}
      </Tabs>
    );
    const { rerender } = render(set(true));
    fireEvent.click(tab('C'));
    expect(screen.getByText('panel-c')).toBeTruthy();
    rerender(set(false));
    expect(screen.getByText('panel-a')).toBeTruthy();
    expect(onSelectionChange).toHaveBeenLastCalledWith('a');
  });

  it('chooses nothing, quietly, when every tab is disabled', () => {
    const onSelectionChange = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(
      <Tabs onSelectionChange={onSelectionChange}>
        <TabList aria-label="Sections">
          <Tab id="a" disabled>A</Tab>
          <Tab id="b" disabled>B</Tab>
        </TabList>
        <TabPanel id="a">panel-a</TabPanel>
        <TabPanel id="b">panel-b</TabPanel>
      </Tabs>,
    );
    rerender(
      <Tabs onSelectionChange={onSelectionChange}>
        <TabList aria-label="Sections">
          <Tab id="a" disabled>A</Tab>
          <Tab id="b" disabled>B</Tab>
        </TabList>
        <TabPanel id="a">panel-a</TabPanel>
        <TabPanel id="b">panel-b</TabPanel>
      </Tabs>,
    );
    expect(screen.queryByText('panel-a')).toBeNull();
    expect(screen.queryByText('panel-b')).toBeNull();
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(tab('A')).not.toHaveAttribute('aria-selected', 'true');
    warn.mockRestore();
  });

  it('opens on the first tab that can be chosen when defaultSelectedKey names a disabled one', () => {
    const onSelectionChange = vi.fn();
    render(
      <Tabs defaultSelectedKey="b" onSelectionChange={onSelectionChange}>
        <TabList aria-label="Sections">
          <Tab id="a">A</Tab>
          <Tab id="b" disabled>B</Tab>
        </TabList>
        <TabPanel id="a">panel-a</TabPanel>
        <TabPanel id="b">panel-b</TabPanel>
      </Tabs>,
    );
    expect(screen.getByText('panel-a')).toBeTruthy();
    expect(screen.queryByText('panel-b')).toBeNull();
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('shows a disabled tab a controlled selectedKey names', () => {
    render(
      <Tabs selectedKey="b">
        <TabList aria-label="Sections">
          <Tab id="a">A</Tab>
          <Tab id="b" disabled>B</Tab>
        </TabList>
        <TabPanel id="a">panel-a</TabPanel>
        <TabPanel id="b">panel-b</TabPanel>
      </Tabs>,
    );
    expect(screen.getByText('panel-b')).toBeTruthy();
  });
});
