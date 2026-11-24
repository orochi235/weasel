import { execFile } from 'node:child_process';
import type { ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { type Git, runGit } from '../history.ts';
import { type ForgeIssue, ISSUE_LIMIT, ISSUES_PATH, type IssueRepo, type IssuesAnswer, issueLabel } from './answer.ts';

/** What one `gh` run came to: its stdout, no `gh` on the PATH, or a failure with its exit code and what it said. */
export type GhResult = { stdout: string } | { missing: true } | { failed: string; code: number | null };

/** Runs `gh` in `cwd` under the machine's own login. */
export type Gh = (args: readonly string[], cwd: string) => Promise<GhResult>;

export const runGh: Gh = (args, cwd) =>
  new Promise((done) => {
    execFile(
      'gh',
      [...args],
      { cwd, maxBuffer: 16 << 20, env: { ...process.env, GH_PROMPT_DISABLED: '1' } },
      (error, stdout, stderr) => {
        if (!error) return done({ stdout });
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return done({ missing: true });
        done({ failed: stderr.trim() || error.message, code: typeof error.code === 'number' ? error.code : null });
      },
    );
  });

/** A GitHub repository as `gh -R` names it and as its page is found. */
export interface RemoteRepo extends IssueRepo {
  /** What `gh -R` takes: `owner/name` on github.com, `host/owner/name` on an Enterprise host. */
  ghRepo: string;
}

const SCP = /^(?:[^@\s/]+@)?([\w.-]+):(?!\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;
const URL_FORM = /^(?:ssh|git|https?):\/\/(?:[^@/\s]+@)?([\w.-]+)(?::\d+)?\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

/**
 * The repository a remote URL names, in either the `git@host:owner/name.git` or the URL form. A host under
 * `github.com` or named for it, such as an SSH alias `work.github.com` or `github.com-work`, is taken as github.com.
 */
export function repoOf(remote: string): RemoteRepo | null {
  const match = SCP.exec(remote.trim()) ?? URL_FORM.exec(remote.trim());
  if (!match) return null;
  const [, rawHost = '', owner = '', name = ''] = match;
  const host = /^(?:[\w-]+\.)*github\.com(?:[-_][\w-]+)?$/.test(rawHost) ? 'github.com' : rawHost;
  const slug = `${owner}/${name}`;
  return { slug, url: `https://${host}/${slug}`, ghRepo: host === 'github.com' ? slug : `${host}/${slug}` };
}

const attempt = async (run: () => Promise<string>): Promise<string | null> => {
  try {
    return (await run()).trim() || null;
  } catch {
    return null;
  }
};

/** gh's exit code for a command that needs a login it does not have. */
const GH_AUTH_EXIT = 4;

interface GhIssue {
  number: number;
  title: string;
  url: string;
  createdAt: string;
}

const isIssue = (value: unknown): value is GhIssue => {
  if (typeof value !== 'object' || value === null) return false;
  const { number, title, url, createdAt } = value as Record<string, unknown>;
  return typeof number === 'number' && typeof title === 'string' && typeof url === 'string' && typeof createdAt === 'string';
};

const isIssueList = (value: unknown): value is GhIssue[] => Array.isArray(value) && value.every(isIssue);

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

/**
 * Answers a GET of `<base>__forge/issues?component=<name>` with an `IssuesAnswer`: the open issues labeled
 * `forge:<name>` in the repository `origin` names, listed by `gh` under the machine's own login, and the branch and
 * commit checked out at `root`.
 */
export function serveIssues(
  server: Pick<ViteDevServer, 'middlewares'>,
  base: string,
  root: () => string,
  { gh = runGh, git = runGit }: { gh?: Gh; git?: Git } = {},
): void {
  const answer = async (component: string): Promise<{ status: number; body: IssuesAnswer }> => {
    const cwd = root();
    const [remote, head, commit] = await Promise.all([
      attempt(() => git(['remote', 'get-url', 'origin'], cwd)),
      attempt(() => git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)),
      attempt(() => git(['rev-parse', 'HEAD'], cwd)),
    ]);
    const found = remote === null ? null : repoOf(remote);
    const context: IssuesAnswer = {
      repo: found && { slug: found.slug, url: found.url },
      branch: head === 'HEAD' ? null : head,
      commit,
    };
    if (!found) return { status: 200, body: { ...context, unavailable: 'This checkout’s origin is not a GitHub repository.' } };
    const fields = 'number,title,url,createdAt';
    const label = issueLabel(component);
    const limit = String(ISSUE_LIMIT + 1);
    const result = await gh(
      ['issue', 'list', '-R', found.ghRepo, '--label', label, '--state', 'open', '--limit', limit, '--json', fields],
      cwd,
    );
    if ('missing' in result) return { status: 200, body: { ...context, unavailable: 'The GitHub CLI (gh) is not installed.' } };
    if ('failed' in result) {
      if (result.code === GH_AUTH_EXIT || /gh auth login/.test(result.failed)) {
        return { status: 200, body: { ...context, unavailable: 'The GitHub CLI (gh) is not logged in. Run gh auth login.' } };
      }
      return { status: 502, body: { ...context, error: result.failed } };
    }
    let listed: unknown;
    try {
      listed = JSON.parse(result.stdout);
    } catch {
      return { status: 502, body: { ...context, error: 'gh answered something that is not JSON' } };
    }
    if (!isIssueList(listed)) return { status: 502, body: { ...context, error: 'gh answered something that is not a list of issues' } };
    const issues = listed
      .slice(0, ISSUE_LIMIT)
      .map(({ number, title, url, createdAt }): ForgeIssue => ({ number, title, url, opened: createdAt }));
    if (listed.length <= ISSUE_LIMIT) return { status: 200, body: { ...context, issues } };
    const more = `${found.url}/issues?q=${encodeURIComponent(`is:issue is:open label:"${label}"`)}`;
    return { status: 200, body: { ...context, issues, more } };
  };

  server.middlewares.use((req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://forge.invalid');
    if (url.pathname !== `${base}${ISSUES_PATH}`) return next();
    if (req.method !== 'GET') return next();
    const component = url.searchParams.get('component')?.trim();
    if (!component) return json(res, 400, { error: 'name a component: ?component=<name>' });
    answer(component).then(({ status, body }) => json(res, status, body), next);
  });
}
