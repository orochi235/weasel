import { fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { IssuesPanel } from './IssuesPanel';

const ISSUES = [
  { number: 12, title: 'Thumb drifts off the track', url: 'https://example.test/12', opened: '2026-10-20T12:00:00Z' },
  { number: 7, title: 'Label clips at 160 px', url: 'https://example.test/7', opened: '2026-10-01T12:00:00Z' },
];

describe('IssuesPanel', () => {
  it('lists each open issue as a link to it', () => {
    renderWithIcons(<IssuesPanel component="Slider" storyId="slider--basic" issues={ISSUES} />);
    const link = screen.getByRole('link', { name: /Thumb drifts off the track/ });
    expect(link.getAttribute('href')).toBe('https://example.test/12');
    expect(link.textContent).toContain('#12');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('says when the component has no open issues, when there is no tracker, and what its host says instead', () => {
    const { rerender } = renderWithIcons(<IssuesPanel component="Slider" storyId="slider--basic" issues={[]} />);
    expect(screen.getByText('No open issues for Slider.')).toBeTruthy();
    rerender(<IssuesPanel component="Slider" storyId="slider--basic" />);
    expect(screen.getByText('Not connected to an issue tracker.')).toBeTruthy();
    rerender(<IssuesPanel component="Slider" storyId="slider--basic" listNote="The GitHub CLI (gh) is not logged in." />);
    expect(screen.getByText('The GitHub CLI (gh) is not logged in.')).toBeTruthy();
  });

  it('hands a report to its host and clears the form', () => {
    const onReport = vi.fn();
    renderWithIcons(<IssuesPanel component="Slider" storyId="slider--basic" issues={[]} onReport={onReport} />);
    const report = screen.getByRole('button', { name: 'Report' });
    expect(report.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Thumb drifts  ' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Drag past the end.' } });
    fireEvent.click(report);
    expect(onReport).toHaveBeenCalledWith({
      component: 'Slider',
      storyId: 'slider--basic',
      title: 'Thumb drifts',
      body: 'Drag past the end.',
    });
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('');
  });

  it('keeps Report disabled when nothing takes reports', () => {
    renderWithIcons(<IssuesPanel component="Slider" storyId="slider--basic" issues={[]} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Thumb drifts' } });
    expect(screen.getByRole('button', { name: 'Report' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Reporting is not connected yet.')).toBeTruthy();
  });
});
