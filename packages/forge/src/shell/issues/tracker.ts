import type { ConfigSchema } from '@weasel-js/labkit/config';
import type { Globals } from '../../protocol/messages';
import { formatRoute, knobsToParams, pinParams } from '../../route/url';
import { ISSUES_PATH, type IssueRepo, type IssuesAnswer, issueLabel } from '../../vite/issues/answer';

/** What the Report form hands its host. */
export interface IssueReport {
  /** The component the report is about, as the panel names it. */
  component: string;
  /** The story the report was made from. */
  storyId: string;
  title: string;
  body: string;
}

/** Asks the dev server at `base` for `component`'s open issues and the checkout they are filed from. */
export async function fetchIssues(base: string, component: string, signal?: AbortSignal): Promise<IssuesAnswer> {
  const res = await fetch(`${base}${ISSUES_PATH}?${new URLSearchParams({ component })}`, signal ? { signal } : {});
  const type = res.headers.get('Content-Type') ?? '';
  if (!type.includes('application/json')) throw new Error(`The dev server answered ${res.status} with no issues.`);
  return (await res.json()) as IssuesAnswer;
}

/** A workshop URL reopening `story` at `config`'s knobs, with every global in `globals` pinned on its trial. */
export function reopenLink(
  page: string,
  story: string,
  schema: Pick<ConfigSchema<unknown>, 'nodes'>,
  config: unknown,
  globals: Globals,
): string {
  return `${page}${formatRoute({ story, params: { ...knobsToParams(schema, config), ...pinParams(globals) } })}`;
}

/** Where the report was made from: the link back to it, and the checkout. */
export interface ReportContext {
  link: string;
  branch: string | null;
  commit: string | null;
}

/** An issue body: what the reporter wrote, then the story, the link back to it and the checkout. */
export function reportBody(report: IssueReport, context: ReportContext): string {
  const code = (text: string) => `\`${text}\``;
  const checkout = [
    context.branch === null ? null : `**Branch:** ${code(context.branch)}`,
    context.commit === null ? null : `**Commit:** ${context.commit}`,
  ].filter((line) => line !== null);
  return [
    report.body.trim(),
    '---',
    [`**Story:** ${code(report.storyId)}`, `**Reopen:** ${context.link}`, ...checkout].join('\n'),
    '<!-- Paste a screenshot here. -->',
  ]
    .filter((part) => part !== '')
    .join('\n\n');
}

/** GitHub's new-issue page for `repo`, with the report's title, body and component label filled in. */
export function newIssueUrl(repo: IssueRepo, report: IssueReport, context: ReportContext): string {
  const params = new URLSearchParams({
    title: report.title,
    body: reportBody(report, context),
    labels: issueLabel(report.component),
  });
  return `${repo.url}/issues/new?${params}`;
}
