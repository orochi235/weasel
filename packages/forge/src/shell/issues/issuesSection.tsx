import { type LabContribution, useLabContext } from '@weasel-js/labkit';
import { useMemo } from 'react';
import { indexEntries } from '../../story/indexPages';
import type { IndexEntry } from '../../story/types';
import { IssuesPanel } from './IssuesPanel';
import { TrackedIssues } from './TrackedIssues';

/** The panel for the lab's focused trial, naming the component its story, or its index page, renders. */
function FocusedIssues({ index, base }: { index: readonly IndexEntry[]; base: string | undefined }) {
  const { focusedTrialId, trials } = useLabContext();
  const pages = useMemo(() => indexEntries(index), [index]);
  const record = trials.find((trial) => trial.id === focusedTrialId);
  const id = record?.instrumentName;
  const entry = id === undefined ? undefined : (index.find((e) => e.id === id) ?? pages.find((e) => e.id === id));
  if (!entry) return null;
  const component = entry.componentName ?? entry.title.split('/').at(-1) ?? entry.title;
  return (
    <section className="fg-issues-focus" aria-label="Issues">
      <p className="fg-issues__component">{component}</p>
      {base === undefined ? (
        <IssuesPanel key={entry.id} component={component} storyId={entry.id} />
      ) : (
        <TrackedIssues key={entry.id} base={base} storyId={entry.id} component={component} />
      )}
    </section>
  );
}

/**
 * The lab aside section listing and reporting issues against the focused trial's component, through the dev server
 * at `base`. `index` is the story list; a trial showing a component's index page lists that component's issues. With no `base`, as in a built workshop, it says it is not connected.
 */
export function issuesSection(index: readonly IndexEntry[], base?: string): LabContribution {
  return { id: 'fg-issues', region: 'aside', item: { title: 'Issues', body: <FocusedIssues index={index} base={base} /> } };
}
