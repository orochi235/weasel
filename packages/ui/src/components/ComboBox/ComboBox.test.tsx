import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComboBox, ComboBoxItem } from './ComboBox';

const OPTIONS = [
  { value: 'r' as const, label: 'Red' },
  { value: 'g' as const, label: 'Green' },
  { value: 'b' as const, label: 'Blue' },
];

describe('ComboBox', () => {
  it('renders a combobox-role input', () => {
    render(<ComboBox label="Color" options={OPTIONS} placeholder="Pick" />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input.placeholder).toBe('Pick');
  });

  it('renders the open button', () => {
    render(<ComboBox label="Color" options={OPTIONS} />);
    expect(screen.getByRole('button', { name: /Show options/ })).toBeTruthy();
  });

  it('shows the current selection as the input value', () => {
    render(<ComboBox label="Color" options={OPTIONS} defaultSelectedKey="g" />);
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Green');
  });

  it('clears the input when a controlled selectedKey goes null', () => {
    const { rerender } = render(
      <ComboBox label="Color" options={OPTIONS} selectedKey="g" onSelectionChange={() => {}} />,
    );
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Green');
    rerender(<ComboBox label="Color" options={OPTIONS} selectedKey={null} onSelectionChange={() => {}} />);
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('');
  });

  // Only that the sizer is there and carries every label: the CSS that turns
  // it into a width is not something jsdom resolves, and the module proxy
  // answers to any class name. The story is where the width is checked.
  it('measures itself against every option under width="fit"', () => {
    const { container } = render(
      <ComboBox label="Color" options={OPTIONS} placeholder="Pick" width="fit" />,
    );
    const sizer = container.querySelector('[aria-hidden="true"]:not(svg)');
    expect(sizer?.textContent).toBe('PickRedGreenBlue');
  });

  it('renders no sizer under the default width', () => {
    const { container } = render(<ComboBox label="Color" options={OPTIONS} placeholder="Pick" />);
    expect(container.querySelector('[aria-hidden="true"]:not(svg)')).toBeNull();
  });

  it('supports the children form with explicit items', () => {
    render(
      <ComboBox label="Color">
        <ComboBoxItem id="r">Red</ComboBoxItem>
        <ComboBoxItem id="g">Green</ComboBoxItem>
      </ComboBox>,
    );
    expect(screen.getByRole('combobox')).toBeTruthy();
  });
});

describe('ComboBox keyboard navigation', () => {
  // ComboBox leans on React Aria for every key. These assert the wiring, not
  // React Aria: each one fails if the listbox, the filter or the commit
  // channel is hooked up wrong.
  it('opens on ArrowDown and moves the active option with the arrows', async () => {
    const user = userEvent.setup();
    render(<ComboBox label="Color" options={OPTIONS} />);
    const input = screen.getByRole('combobox');

    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(await screen.findByRole('listbox')).toBeTruthy();

    const active = () => input.getAttribute('aria-activedescendant');
    const first = active();
    expect(first).toBeTruthy();
    await user.keyboard('{ArrowDown}');
    expect(active()).not.toBe(first);
    await user.keyboard('{ArrowUp}');
    expect(active()).toBe(first);
  });

  it('commits the active option on Enter', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<ComboBox label="Color" options={OPTIONS} onCommit={onCommit} />);

    await user.tab();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onCommit).toHaveBeenCalledWith({ source: 'option', key: 'g' });
  });

  it('commits a picked option on click', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<ComboBox label="Color" options={OPTIONS} onCommit={onCommit} />);

    await user.click(screen.getByRole('button', { name: /Show options/ }));
    await user.click(await screen.findByRole('option', { name: 'Blue' }));
    expect(onCommit).toHaveBeenCalledWith({ source: 'option', key: 'b' });
  });

  it('commits unmatched text on Enter when custom values are allowed', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<ComboBox label="Part" options={OPTIONS} allowsCustomValue onCommit={onCommit} />);

    await user.tab();
    await user.keyboard('3001{Enter}');
    expect(onCommit).toHaveBeenCalledWith({ source: 'text', text: '3001' });
  });

  it('does not commit text as an option when one is highlighted', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<ComboBox label="Color" options={OPTIONS} allowsCustomValue onCommit={onCommit} />);

    await user.tab();
    await user.keyboard('Re{ArrowDown}{Enter}');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ source: 'option', key: 'r' });
  });
});

describe('ComboBox async surface', () => {
  it('filters with a locale substring match by default', async () => {
    const user = userEvent.setup();
    render(<ComboBox label="Color" options={OPTIONS} />);

    await user.tab();
    await user.keyboard('re');
    await screen.findByRole('listbox');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Red', 'Green']);
  });

  it('shows every option under filter="none", whatever is typed', async () => {
    // The point of the mode: a server already ranked these, and a second
    // client-side pass would drop rows that do not contain the query.
    const user = userEvent.setup();
    render(<ComboBox label="Color" options={OPTIONS} filter="none" />);

    await user.tab();
    await user.keyboard('zzz');
    await screen.findByRole('listbox');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Red',
      'Green',
      'Blue',
    ]);
  });

  it('accepts a predicate as the filter', async () => {
    const user = userEvent.setup();
    render(
      <ComboBox
        label="Color"
        options={OPTIONS}
        filter={(textValue) => textValue.startsWith('B')}
      />,
    );

    await user.tab();
    await user.keyboard('e');
    await screen.findByRole('listbox');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Blue']);
  });

  it('keeps the popover open on an empty collection under filter="none"', async () => {
    // Without allowsEmptyCollection React Aria closes instead, so emptyLabel
    // can never be seen on a query whose results have not arrived.
    const user = userEvent.setup();
    render(<ComboBox label="Part" options={[]} filter="none" emptyLabel="No parts" />);

    await user.tab();
    await user.keyboard('300');
    expect(await screen.findByText('No parts')).toBeTruthy();
  });

  it('marks the field pending while isLoading', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ComboBox label="Part" options={OPTIONS} filter="none" isLoading />);
    await user.tab();
    await user.keyboard('3');
    expect(screen.getByRole('combobox').getAttribute('aria-busy')).toBe('true');

    rerender(<ComboBox label="Part" options={OPTIONS} filter="none" />);
    expect(screen.getByRole('combobox').getAttribute('aria-busy')).toBeNull();
  });

  it('keeps stale options arrowable while loading', async () => {
    const user = userEvent.setup();
    render(<ComboBox label="Part" options={OPTIONS} filter="none" isLoading />);

    await user.tab();
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('listbox');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('combobox').getAttribute('aria-activedescendant')).toBeTruthy();
  });

  it('shows the error row instead of the empty state when a load fails', async () => {
    const user = userEvent.setup();
    render(
      <ComboBox
        label="Part"
        options={[]}
        filter="none"
        emptyLabel="No parts"
        loadError={new Error('offline')}
        errorLabel="Couldn't load parts"
      />,
    );

    await user.tab();
    await user.keyboard('300');
    expect(await screen.findByText("Couldn't load parts")).toBeTruthy();
    expect(screen.queryByText('No parts')).toBeNull();
  });
});
