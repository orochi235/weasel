import { useLabContext } from '@weasel-js/labkit';
import type { ConfigSchema } from '@weasel-js/labkit/config';
import { useContext, useEffect, useState } from 'react';
import type { ForgeIssue, IssuesAnswer } from '../../vite/issues/answer';
import { effectiveGlobals, GLOBALS_KEY } from '../globals';
import { StoryGlobalsContext } from '../StoryGlobalsContext';
import { IssuesPanel } from './IssuesPanel';
import { fetchIssues, type IssueReport, newIssueUrl, reopenLink } from './tracker';

/** What the panel shows of the dev server's answer: the issues, or a note in their place. */
type Listing = { issues: readonly ForgeIssue[] } | { note: string };

const couldNot = (reason: string): Listing => ({ note: `Could not list issues: ${reason}` });

const listingOf = (answer: IssuesAnswer): Listing =>
  answer.issues ? { issues: answer.issues } : answer.unavailable ? { note: answer.unavailable } : couldNot(answer.error ?? 'no reason given');

const NO_KNOBS: Pick<ConfigSchema<unknown>, 'nodes'> = { nodes: {} };

/**
 * The Issues panel for one story, connected to the dev server at `base`: it lists the component's issues through
 * the server, and Report opens GitHub's new-issue page for the checkout's repository with a link reopening the
 * focused trial as it stands.
 */
export function TrackedIssues({ base, storyId, component }: { base: string; storyId: string; component: string }) {
  const lab = useLabContext();
  const labGlobals = useContext(StoryGlobalsContext);
  const [answer, setAnswer] = useState<IssuesAnswer | null>(null);
  const [listing, setListing] = useState<Listing>({ note: 'Listing issues…' });
  useEffect(() => {
    const abort = new AbortController();
    fetchIssues(base, component, abort.signal).then(
      (next) => {
        setAnswer(next);
        setListing(listingOf(next));
      },
      (err: unknown) => {
        if (!abort.signal.aborted) setListing(couldNot(err instanceof Error ? err.message : String(err)));
      },
    );
    return () => abort.abort();
  }, [base, component]);

  const report = (made: IssueReport) => {
    if (!answer?.repo) return;
    const trial = lab.trials.find((t) => t.id === lab.focusedTrialId);
    const config = (trial?.config ?? null) as Record<string, unknown> | null;
    const schema = lab.instruments.find((instrument) => instrument.name === storyId)?.config as
      | ConfigSchema<unknown>
      | undefined;
    const globals = effectiveGlobals(labGlobals, config?.[GLOBALS_KEY]);
    const page = `${location.origin}${location.pathname}${location.search}`;
    const link = reopenLink(page, storyId, schema ?? NO_KNOBS, config, globals);
    window.open(newIssueUrl(answer.repo, made, { link, branch: answer.branch, commit: answer.commit }), '_blank', 'noopener');
  };

  return (
    <IssuesPanel
      component={component}
      storyId={storyId}
      {...('issues' in listing ? { issues: listing.issues } : { listNote: listing.note })}
      {...(answer?.repo ? { onReport: report } : {})}
    />
  );
}
