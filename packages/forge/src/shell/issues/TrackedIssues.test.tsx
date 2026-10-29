import { LabContext, type LabContextValue } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IssuesAnswer } from '../../vite/issues/answer';
import { StoryGlobalsContext } from '../StoryGlobalsContext';
import { TrackedIssues } from './TrackedIssues';

const CHECKOUT = {
  repo: { slug: 'acme/widgets', url: 'https://github.com/acme/widgets' },
  branch: 'main',
  commit: 'abc1234',
} satisfies IssuesAnswer;

const lab = {
  instruments: [{ name: 'slider--basic', config: f.schema({ max: f.number(100) }) }],
  trials: [{ id: 't1', instrumentName: 'slider--basic', config: { max: 10, $globals: { mode: 'lab' } } }],
  focusedTrialId: 't1',
} as unknown as LabContextValue;

function serve(answer: IssuesAnswer, status = 200) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(answer), { status, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function mount() {
  return renderWithIcons(
    <LabContext.Provider value={lab}>
      <StoryGlobalsContext.Provider value={{ mode: 'dark' }}>
        <TrackedIssues base="/" storyId="slider--basic" component="Slider" />
      </StoryGlobalsContext.Provider>
    </LabContext.Provider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TrackedIssues', () => {
  it('lists what the dev server answers for the component', async () => {
    const fetch = serve({ ...CHECKOUT, issues: [{ number: 3, title: 'Thumb drifts', url: 'https://x.test/3', opened: '2026-10-20T00:00:00Z' }] });
    mount();
    expect(await screen.findByRole('link', { name: /Thumb drifts/ })).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('/__forge/issues?component=Slider', expect.anything());
  });

  it('shows why gh cannot list issues in place of the list, and still takes reports', async () => {
    serve({ ...CHECKOUT, unavailable: 'The GitHub CLI (gh) is not installed.' });
    mount();
    expect(await screen.findByText('The GitHub CLI (gh) is not installed.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Thumb drifts' } });
    expect(screen.getByRole('button', { name: 'Report' }).hasAttribute('disabled')).toBe(false);
  });

  it('says a gh failure could not list issues', async () => {
    serve({ ...CHECKOUT, error: 'HTTP 502' }, 502);
    mount();
    expect(await screen.findByText('Could not list issues: HTTP 502')).toBeTruthy();
  });

  it('opens GitHub’s new-issue page for a report, linking back to the trial with its knobs and globals', async () => {
    serve({ ...CHECKOUT, issues: [] });
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    mount();
    await screen.findByText('No open issues for Slider.');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Thumb drifts' } });
    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    expect(open).toHaveBeenCalledTimes(1);
    const url = new URL(open.mock.calls[0]![0] as string);
    expect(`${url.origin}${url.pathname}`).toBe('https://github.com/acme/widgets/issues/new');
    expect(url.searchParams.get('labels')).toBe('forge:Slider');
    const body = url.searchParams.get('body')!;
    expect(body).toContain('#/slider--basic?max=10&%24globals.mode=dark');
    expect(body).toContain('**Commit:** abc1234');
  });

  it('keeps Report disabled when the checkout names no GitHub repository', async () => {
    serve({ repo: null, branch: 'main', commit: 'abc1234', unavailable: 'This checkout’s origin is not a GitHub repository.' });
    mount();
    await screen.findByText('This checkout’s origin is not a GitHub repository.');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Thumb drifts' } });
    expect(screen.getByRole('button', { name: 'Report' }).hasAttribute('disabled')).toBe(true);
  });
});
