import './issues.css';
import { useHoldMarks } from '@weasel-js/labkit';
import num from '@weasel-js/theme/numeric.module.css';
import { Button } from '@weasel-js/ui/components/Button';
import { Input } from '@weasel-js/ui/components/Input';
import { TextArea } from '@weasel-js/ui/components/TextArea';
import { type FormEvent, useState } from 'react';
import type { ForgeIssue } from '../../vite/issues/answer';
import type { IssueReport } from './tracker';

export type { ForgeIssue } from '../../vite/issues/answer';
export type { IssueReport } from './tracker';

export interface IssuesPanelProps {
  component: string;
  storyId: string;
  /** The component's open issues. Absent, the panel is not connected to a tracker and says so. */
  issues?: readonly ForgeIssue[];
  /** Shown in place of the list when `issues` is absent: why the tracker lists nothing, or that it is still asking. */
  listNote?: string;
  /** Absent, the Report button stays disabled. */
  onReport?: (report: IssueReport) => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

function IssueList({ component, issues, note }: { component: string; issues?: readonly ForgeIssue[]; note?: string }) {
  if (!issues) return <p className="fg-issues__note">{note ?? 'Not connected to an issue tracker.'}</p>;
  if (issues.length === 0) return <p className="fg-issues__note">No open issues for {component}.</p>;
  return (
    <ul className="fg-issues__list">
      {issues.map((issue) => (
        <li key={issue.number} className="fg-issues__item">
          <a href={issue.url} target="_blank" rel="noreferrer" className="fg-issues__link">
            <span className={`fg-issues__number ${num.numeric}`}>#{issue.number}</span>
            <span className="fg-issues__title">{issue.title}</span>
          </a>
          <time className={`fg-issues__opened ${num.numeric}`} dateTime={issue.opened}>
            {dateFormat.format(new Date(issue.opened))}
          </time>
        </li>
      ))}
    </ul>
  );
}

interface ReportFormProps extends Pick<IssuesPanelProps, 'component' | 'storyId' | 'onReport'> {
  onClose: () => void;
}

/** The open report. The lab shows its marks while it is open, so the trial can be marked up for the screenshot. */
function ReportForm({ component, storyId, onReport, onClose }: ReportFormProps) {
  useHoldMarks(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const canReport = onReport !== undefined && title.trim() !== '';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canReport) return;
    onReport({ component, storyId, title: title.trim(), body });
    onClose();
  };
  return (
    <form className="fg-issues__group" aria-label="Report an issue" onSubmit={submit}>
      <h3 className="fg-issues__heading">Report</h3>
      <p className="fg-issues__note">Draw on the trial with the rail’s mark tools, then take the screenshot to paste.</p>
      <Input label="Title" value={title} onChange={setTitle} />
      <TextArea label="Description" value={body} onChange={setBody} placeholder="What did you expect, and what happened?" />
      <div className="fg-issues__actions">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" type="submit" disabled={!canReport}>
          Report
        </Button>
      </div>
      {onReport ? null : <p className="fg-issues__note">Reporting is not connected yet.</p>}
    </form>
  );
}

/** A component's open issues, and a report to open against it. */
export function IssuesPanel({ component, storyId, issues, listNote, onReport }: IssuesPanelProps) {
  const [reporting, setReporting] = useState(false);
  return (
    <div className="fg-issues">
      <section className="fg-issues__group" aria-label="Open issues">
        <h3 className="fg-issues__heading">Open</h3>
        <IssueList component={component} {...(issues ? { issues } : {})} {...(listNote ? { note: listNote } : {})} />
      </section>
      {reporting ? (
        <ReportForm
          component={component}
          storyId={storyId}
          {...(onReport ? { onReport } : {})}
          onClose={() => setReporting(false)}
        />
      ) : (
        <div className="fg-issues__actions">
          <Button size="sm" onClick={() => setReporting(true)}>
            Report an issue…
          </Button>
        </div>
      )}
    </div>
  );
}
