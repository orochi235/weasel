/** Where the issues endpoint answers, under the dev server's base. */
export const ISSUES_PATH = '__forge/issues';

/** The label a component's issues carry. */
export const issueLabel = (component: string): string => `forge:${component}`;

/** An open issue filed against a component. */
export interface ForgeIssue {
  number: number;
  title: string;
  url: string;
  /** When it was opened, as an ISO date. */
  opened: string;
}

/** The GitHub repository the dev server's checkout pushes to. */
export interface IssueRepo {
  /** `owner/name`. */
  slug: string;
  /** Its page, such as `https://github.com/owner/name`. */
  url: string;
}

/**
 * What a GET of the endpoint answers. `repo`, `branch` and `commit` describe the checkout whether or not `gh` can
 * list anything; exactly one of `issues`, `unavailable` and `error` is set.
 */
export interface IssuesAnswer {
  /** Null when `origin` names no GitHub repository. */
  repo: IssueRepo | null;
  /** Null on a detached head. */
  branch: string | null;
  commit: string | null;
  issues?: ForgeIssue[];
  /** Why nothing can be listed, when that is the machine's setup rather than a fault: no `gh`, no login, no repo. */
  unavailable?: string;
  /** What went wrong when `gh` was there and failed. */
  error?: string;
}
