// @vitest-environment node
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Git } from '../history';
import type { IssuesAnswer } from './answer';
import { type Gh, type GhResult, repoOf, serveIssues } from './endpoint';

type Handler = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void;

const GIT: Record<string, string> = {
  'remote get-url origin': 'git@github.com:acme/widgets.git\n',
  'rev-parse --abbrev-ref HEAD': 'slider-fix\n',
  'rev-parse HEAD': 'abc1234def\n',
};
const git: Git = async (args) => {
  const out = GIT[args.join(' ')];
  if (out === undefined) throw new Error(`unexpected git ${args.join(' ')}`);
  return out;
};

let server: Server | null = null;

afterEach(() => {
  server?.close();
  server = null;
});

/** Serves the endpoint at `/` with `gh` answering `result`, and answers the status and body of a GET of `path`. */
async function get(path: string, gh: Gh): Promise<{ status: number; body: IssuesAnswer }> {
  let handler: Handler | null = null;
  serveIssues({ middlewares: { use: (fn: Handler) => (handler = fn) } } as never, '/', () => '/repo', { gh, git });
  server = createServer((req, res) => handler!(req, res, () => ((res.statusCode = 404), res.end())));
  await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  return { status: res.status, body: (await res.json()) as IssuesAnswer };
}

const answering = (result: GhResult) => vi.fn<Gh>(async () => result);

describe('repoOf', () => {
  it('reads owner and name from the scp form, a URL, and an SSH alias under github.com', () => {
    expect(repoOf('git@github.com:acme/widgets.git')).toEqual({
      slug: 'acme/widgets',
      url: 'https://github.com/acme/widgets',
      ghRepo: 'acme/widgets',
    });
    expect(repoOf('https://github.com/acme/widgets')?.slug).toBe('acme/widgets');
    expect(repoOf('ssh://git@github.com:22/acme/widgets.git')?.slug).toBe('acme/widgets');
    expect(repoOf('git@work.github.com:acme/widgets.git')?.url).toBe('https://github.com/acme/widgets');
  });

  it('names an Enterprise host to gh, and nothing for a path that is not a repository', () => {
    expect(repoOf('git@ghe.acme.test:team/widgets.git')).toEqual({
      slug: 'team/widgets',
      url: 'https://ghe.acme.test/team/widgets',
      ghRepo: 'ghe.acme.test/team/widgets',
    });
    expect(repoOf('/srv/git/widgets.git')).toBeNull();
  });
});

describe('serveIssues', () => {
  it('lists the component’s open issues through gh, with the checkout’s repo, branch and commit', async () => {
    const gh = answering({
      stdout: JSON.stringify([{ number: 12, title: 'Thumb drifts', url: 'https://github.com/acme/widgets/issues/12', createdAt: '2026-10-20T12:00:00Z' }]),
    });
    const { status, body } = await get('/__forge/issues?component=Slider', gh);
    expect(status).toBe(200);
    expect(body).toEqual({
      repo: { slug: 'acme/widgets', url: 'https://github.com/acme/widgets' },
      branch: 'slider-fix',
      commit: 'abc1234def',
      issues: [{ number: 12, title: 'Thumb drifts', url: 'https://github.com/acme/widgets/issues/12', opened: '2026-10-20T12:00:00Z' }],
    });
    const [args, cwd] = gh.mock.calls[0]!;
    expect(cwd).toBe('/repo');
    expect(args).toEqual(expect.arrayContaining(['issue', 'list', '-R', 'acme/widgets', '--label', 'forge:Slider', '--json']));
  });

  it('says gh is missing rather than failing, and still names the checkout', async () => {
    const { status, body } = await get('/__forge/issues?component=Slider', answering({ missing: true }));
    expect(status).toBe(200);
    expect(body.issues).toBeUndefined();
    expect(body.unavailable).toMatch(/not installed/);
    expect(body.repo?.slug).toBe('acme/widgets');
    expect(body.commit).toBe('abc1234def');
  });

  it('says gh is not logged in when it exits asking for a login', async () => {
    const gh = answering({ failed: 'To get started with GitHub CLI, please run:  gh auth login', code: 4 });
    const { status, body } = await get('/__forge/issues?component=Slider', gh);
    expect(status).toBe(200);
    expect(body.unavailable).toMatch(/not logged in/);
  });

  it('passes on any other gh failure as an error', async () => {
    const { status, body } = await get('/__forge/issues?component=Slider', answering({ failed: 'HTTP 502', code: 1 }));
    expect(status).toBe(502);
    expect(body.error).toBe('HTTP 502');
  });

  it('refuses a request that names no component, without running gh', async () => {
    const gh = answering({ stdout: '[]' });
    const { status } = await get('/__forge/issues', gh);
    expect(status).toBe(400);
    expect(gh).not.toHaveBeenCalled();
  });
});
