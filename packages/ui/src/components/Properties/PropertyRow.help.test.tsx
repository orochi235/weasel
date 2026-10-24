import { act, fireEvent, render as plain, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { KitSettingsProvider } from '@weasel-js/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertyField } from './PropertyField';
import { PropertyRow } from './PropertyRow';

describe('PropertyRow help with no icon', () => {
  it('draws no ⓘ, keeps the label as the control\'s name, and gives the control the description', () => {
    plain(
      <PropertyRow label="Opacity" description="How see-through the shape is.">
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    expect(screen.queryByText('ⓘ')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Opacity' })).toHaveAccessibleDescription(
      'How see-through the shape is.',
    );
  });

  it('opens the help when the pointer is over the label', () => {
    vi.useFakeTimers();
    try {
      plain(
        <PropertyRow label="Opacity" description="How see-through the shape is.">
          <input type="text" defaultValue="x" />
        </PropertyRow>,
      );
      fireEvent.pointerMove(document.body, { pointerType: 'mouse' });
      const label = screen.getByText('Opacity');
      fireEvent.pointerEnter(label, { pointerType: 'mouse' });
      expect(screen.getByRole('tooltip')).toHaveTextContent('How see-through the shape is.');
      fireEvent.pointerLeave(label, { pointerType: 'mouse' });
      expect(screen.queryByRole('tooltip')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes the help on Escape and leaves the row\'s control focused and its value alone', () => {
    vi.useFakeTimers();
    try {
      const onKeyDown = vi.fn();
      plain(
        <PropertyRow label="Opacity" description="How see-through the shape is.">
          <input type="text" defaultValue="x" onKeyDown={onKeyDown} />
        </PropertyRow>,
      );
      const control = screen.getByRole('textbox', { name: 'Opacity' });
      act(() => control.focus());
      act(() => { vi.advanceTimersByTime(600); });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      fireEvent.keyDown(control, { key: 'Escape' });
      expect(screen.queryByRole('tooltip')).toBeNull();
      expect(onKeyDown).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(control);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets a click on the label reach the row\'s control', () => {
    const onChange = vi.fn();
    plain(
      <PropertyField kind="boolean" label="Visible" value={false} onChange={onChange} description="Show it." />,
    );
    fireEvent.click(screen.getByText('Visible'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

/** Renders with the kit setting that marks a described row with an ⓘ. */
const render = (ui: ReactElement) =>
  plain(ui, {
    wrapper: ({ children }) => <KitSettingsProvider value={{ help: { icon: true } }}>{children}</KitSettingsProvider>,
  });

describe('PropertyRow with the help icon', () => {

  it('renders a help affordance for a non-empty description', () => {
    render(
      <PropertyRow label="Opacity" description="How see-through the shape is.">
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    expect(screen.getByText('ⓘ')).toBeInTheDocument();
  });

  it('ends the help tooltip with what the row reads when auto, and shows it alone with no description', () => {
    const { rerender } = render(
      <PropertyRow label="Opacity" description="How see-through it is." autoValue="0.5">
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => screen.getByText('ⓘ').focus());
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('How see-through it is.auto 0.5');
    expect(tip.lastElementChild).toHaveTextContent(/^auto 0\.5$/);
    rerender(
      <PropertyRow label="Opacity" autoValue="0.5">
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    expect(screen.getByText('ⓘ')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription('auto 0.5');
  });

  it('renders no help affordance for an empty or absent description', () => {
    const { rerender } = render(
      <PropertyRow label="Opacity" description="">
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    expect(screen.queryByRole('button', { name: 'About Opacity' })).toBeNull();
    rerender(
      <PropertyRow label="Opacity">
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    expect(screen.queryByRole('button', { name: 'About Opacity' })).toBeNull();
  });

  it('gives the description to the row\'s control, and takes the ⓘ out of the tab order', () => {
    render(
      <PropertyRow label="Opacity" description="How see-through the shape is.">
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    const control = screen.getByRole('textbox', { name: 'Opacity' });
    expect(control).toHaveAccessibleDescription('How see-through the shape is.');
    expect(screen.queryByRole('button', { name: 'About Opacity' })).toBeNull();
    const help = screen.getByText('ⓘ');
    expect(help).not.toHaveAttribute('tabindex', '0');
    expect(help.tagName).toBe('SPAN');
    expect(help).toHaveAttribute('aria-hidden', 'true');
  });

  it('describes only the first control of a row that holds several', () => {
    render(
      <PropertyRow group label="Ends" description="Where it starts and stops.">
        <input type="text" aria-label="From" defaultValue="0" />
        <input type="text" aria-label="To" defaultValue="1" />
      </PropertyRow>,
    );
    expect(screen.getByRole('textbox', { name: 'From' })).toHaveAccessibleDescription('Where it starts and stops.');
    expect(screen.getByRole('textbox', { name: 'To' })).not.toHaveAttribute('aria-describedby');
  });

  it('gives the ⓘ no tab stop in a row with no control either: hovering it is the way to its help', () => {
    render(
      <PropertyRow label="Opacity" description="How see-through the shape is.">
        <span>0.5</span>
      </PropertyRow>,
    );
    expect(screen.queryByRole('button', { name: 'About Opacity' })).toBeNull();
    expect(screen.getByText('ⓘ')).not.toHaveAttribute('tabindex', '0');
  });

  it('opens the help the moment the pointer is over the ⓘ', () => {
    vi.useFakeTimers();
    try {
      render(
        <PropertyRow label="Opacity" description="How see-through the shape is.">
          <input type="text" defaultValue="x" />
        </PropertyRow>,
      );
      // React Aria only counts a hover once the pointer has moved.
      fireEvent.pointerMove(document.body, { pointerType: 'mouse' });
      const cue = screen.getByText('ⓘ');
      fireEvent.pointerEnter(cue, { pointerType: 'mouse' });
      fireEvent.mouseEnter(cue);
      expect(screen.getByRole('tooltip')).toHaveTextContent('How see-through the shape is.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps focus where it is when the ⓘ is pressed', () => {
    render(
      <PropertyRow label="Opacity" description="How see-through the shape is.">
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    // The browser moves focus on mousedown unless the press is canceled, which is what there is to see here.
    expect(fireEvent.mouseDown(screen.getByText('ⓘ'))).toBe(false);
  });

  it('opens the tooltip once focus has rested on the row\'s control, and closes it when focus leaves the row', () => {
    vi.useFakeTimers();
    try {
      render(
        <>
          <PropertyRow label="Opacity" description="How see-through the shape is.">
            <input type="text" defaultValue="x" />
          </PropertyRow>
          <button type="button">Elsewhere</button>
        </>,
      );
      act(() => screen.getByRole('textbox', { name: 'Opacity' }).focus());
      expect(screen.queryByRole('tooltip')).toBeNull();
      act(() => { vi.advanceTimersByTime(600); });
      expect(screen.getByRole('tooltip')).toHaveTextContent('How see-through the shape is.');
      act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus());
      expect(screen.queryByRole('tooltip')).toBeNull();
      // A press in the row brought this focus, so it opens nothing.
      fireEvent.pointerDown(screen.getByRole('textbox', { name: 'Opacity' }));
      act(() => screen.getByRole('textbox', { name: 'Opacity' }).focus());
      act(() => { vi.advanceTimersByTime(600); });
      expect(screen.queryByRole('tooltip')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not actuate the row control when the help affordance is clicked', () => {
    const onChange = vi.fn();
    render(
      <PropertyField kind="boolean" label="Visible" value={false} onChange={onChange} description="Show it." />,
    );
    fireEvent.click(screen.getByText('ⓘ'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});
