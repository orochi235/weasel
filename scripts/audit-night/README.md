# audit-night

Runs blind-pair audit rounds over weasel every night: two reviewers read the same area without seeing each
other's work, a matcher pairs their findings, Chapman's estimate says what the area still holds, and a fixer
fixes what they found. The method, and what is kept and compared, is `docs/hardening.md`, "Blind pairs". This
is for whoever runs the service or reads what a night left.

Everything is plain Node. The model calls are `claude -p` jobs on fleet nodes, under the personal account
(`CLAUDE_CONFIG_DIR=~/.claude-msb`).

## A night

`node scripts/audit-night/night.mjs` runs one night from the main checkout. Each step prints one line as it
completes (`review 3/16 …`).

| Step | What happens |
|---|---|
| plan | Areas come from the partition (below). The round number is one past the highest used by a `docs/audits/round-<N>/` directory, `docs/hardening.md`, or a branch named `audit<N>-…`. |
| freeze | A detached worktree at `main`'s tip, `.worktrees/audit<N>-frozen-night`. That sha is the round's commit. |
| review | Per area, two reviewer jobs, each `onto do` from the frozen tree with the brief in `briefs/reviewer.md` and the area's file list. Reviewers may read, search, and run `git log/show/diff/blame`, and write only `.audit-night/out/`. Each lists the files it read. |
| match | One haiku job per area pairs the two lists (`briefs/matcher.md`); the script keeps only one-to-one pairs and computes the estimate. |
| fix | Per area with findings, one fixer job (`briefs/fixer.md`), permissions bypassed, in the node's own synced tree. It first commits the synced tree and checks it hashes to the frozen commit's tree, installs if the lockfile changed, then hands back its commits as an mbox. |
| patch | Each mbox is applied with `git am` onto `audit<N>-<area>` at the frozen commit. One that does not apply is reported and left out. |
| batch | Every branch merges into `batch/<date>-audit<N>` (a worktree); a conflicting one is left out and reported. The round's record is committed there. Then `npm run test:fleet` and `npm run test:fleet:postbuild` run on its tip, as `CLAUDE.md` "Worktrees and the fleet" says. |
| merge | Green: local `main` fast-forwards to the batch (never pushed), and the branches are deleted. Red: the batch worktree and its branches stay, and the report names them. |

The record, in `docs/audits/round-<N>/`: per area `files.txt`, `A.md`, `B.md`, `match.json`, `fix.md` and
`area.json` (counts, estimate, the previous pass's estimate this one tests, findings in files changed since,
fix commits, tokens and cost); `usage.jsonl`, one record per job; and `README.md`, the round's table. The round
also gets a row in `docs/hardening.md`'s Record and a regenerated `docs/audits/partition.json`.

Flags:

| Flag | Default | Does |
|---|---|---|
| `--areas K` | 8 | areas tonight |
| `--only a,b` | | these areas, ignoring the pick order |
| `--nodes a,b` | | only these nodes (onto's own quiet hours still apply) |
| `--dry` | | print the plan (round, nodes, areas and their files, jobs) and stop |
| `--no-merge` | | leave `main` alone even when the batch is green; the batch and branches are kept |
| `--cap-usd N` | 80 | list-price dollars the night may spend, summed from each job's cost |
| `--budget-review USD`, `--budget-match USD`, `--budget-fix USD` | 8, 1, 15 | each job's `--max-budget-usd` |

## Which areas, and when

`partition.mjs` splits `packages/*/src` and `apps/*` into areas of at most 50 non-test source files by
directory: a directory that fits is one area; a larger one gives each subdirectory of 10 files or more its own
area, reads the rest with its own files, and splits those into even `.part<k>` chunks past 50. An id is its
directory's path (`core.canvas`, `apps.draw.src.dev`), so it stays put while that directory keeps its shape.
`node scripts/audit-night/partition.mjs` rewrites `docs/audits/partition.json`.

Nothing else holds state: what is due comes from the `area.json` files of earlier rounds. Never-audited areas
go first, in partition order, then the longest since their last pass. An area is *settled*, and skipped, after
two consecutive passes that each found at most one distinct defect, on the same file list, with nothing but
those passes' own fixes changing its files since; any other change to its files makes it due again.

## Limits

All are named constants in `config.mjs`.

- **Nodes.** studio, teitou and msb-uai always; orochi (this Mac) too, but only from 00:00 to 09:00, since by
  day it is the machine being worked on. Fixers never run on orochi. A node onto reports as quiet or
  unavailable is skipped; a dispatch a node refuses moves to another node and keeps that one out for 30
  minutes. Each node runs up to 3 reviewer or matcher jobs and 1 fixer at once, each in its own tree
  (`weasel-audit-r<k>`, `weasel-audit-f<k>`).
- **Time.** Each job is stopped at 45 minutes, early enough that what it wrote still comes home. A night
  starts no new area after 07:00.
- **Money.** Each job runs with `--max-budget-usd` (list price), and one that hits it is recorded as such,
  not retried. A night starts no new area when the areas running plus one more, each expected to cost the
  mean of tonight's finished areas ($10 before any has finished), would pass the night's dollar cap. Tokens
  are still recorded per job and per area, but the cap is in dollars: most of an area's tokens are cache
  reads, which cost a tenth of input, so a token count says little about spend. An area
  whose reviewers ran always gets its matcher and fixer.

## The service

`service.mjs` is an onto service on this Mac: it runs the nights from the main checkout, so it needs the
branches and worktrees there. Once, sync the tree it runs in, then bring it up:

    onto sync --in weasel-audit-service orochi
    onto service up audit-night --in weasel-audit-service --here --prefer orochi \
      --env WEASEL_ROOT=/Users/mike/src/weasel \
      --about "Runs the nightly blind-pair audit of weasel." -- bash -lc 'exec node scripts/audit-night/service.mjs'

After changing `service.mjs`, sync the tree again; onto restarts the service. A night always runs the main
checkout's `night.mjs`.

It starts a night by itself at 23:00 if none started today and none is running. Requests, one JSON object a
line, each echoing its `id`:

| Request | Reply |
|---|---|
| `{"ping":true}` | `pong` and the main checkout's commit |
| `{"status":true}` | whether a night runs, its round, step, areas, and tokens and list-price dollars used against the dollar cap; the last night's summary |
| `{"plan":true}` | what a night started now would pick |
| `{"start":true}` | starts a night now; takes `areas`, `only`, `nodes`, `capUsd`, `budget` (`{review, match, fix}`) and `merge: false`, as the flags above |
| `{"stop":true}` | no new jobs start; running ones finish, then the night patches, batches and records what completed |

    onto call audit-night '{"id":1,"status":true}'

## Where things go

| What | Where | Bound |
|---|---|---|
| A night's log, job outputs and onto logs | `~/.local/state/weasel-audit-night/nights/<start>-round<N>/` (`AUDIT_NIGHT_STATE` moves the root) | the newest 30 nights; older ones are deleted when a night starts |
| Status of the running night, summary of the last | `current.json`, `last.json` beside `nights/` | one file each, overwritten |
| The service's own log | onto's log for the service (`onto logs <job>`) | onto's |
| Worktrees | `.worktrees/audit<N>-frozen-night`, `audit-night-am-<area>`, `batch-<date>-audit<N>` | removed when the night ends, except a red batch's, which the report names |
| Node trees | `weasel-audit-r<k>`, `weasel-audit-f<k>` on each node | a fixed set; each job clears its own output |
