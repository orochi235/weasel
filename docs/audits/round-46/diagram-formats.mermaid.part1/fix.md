Block group with a `block-N` id written anonymous, so links and styles naming it were lost (A+B): fixed 56dfcfc635

gitGraph `mainBranchName` refused on read (A): fixed 4d9bb1987c. The reader now takes the name from front matter or a directive. The writer now writes a main branch not named `main` as that setting. Before, it renamed the branch to `main` with a warning, and threw when the graph also had another branch called `main`.

Front matter `config:` dropped with no warning (A): fixed d5203d23f6

Empty front matter `---\n---` not skipped by the readers (A+B): fixed 0277980d77

Flowchart ignored `accTitle` and dropped `accTitle`/`accDescr` as unknown statements (A+B): fixed fdcdb58be8. It now uses the shared `readPageName`.

Architecture writer turned a non-compass port into R/L with no warning (A): fixed 211a76944f. The block, class, ER and C4 writers also dropped ports with no warning; the same commit fixes those (sweep), through one `dropPorts` helper that the flowchart now uses too.

Class `note` text read from `lines` only, so text held in `rows` was written empty (A): fixed 7c5792ea26

Gantt wrote `after <id>` for an id it had just dropped (A): fixed c9935a789b. Ids are dropped first, repeating until none is left to drop, using plot's public `setGanttTaskId`. A task that started after a dropped id now follows the task before it; one that ended at a dropped id lasts a day. Both come with a warning.

`metaEnd` read an apostrophe inside a plain metadata value as an opening quote (A): fixed 1ee24ac51d

C4 `<<person_db>>`/`<<person_queue>>` written as a macro the reader refuses (A): fixed 6d61324787. The writer now writes such an element as a plain person, with a warning. `kindOfStereotype` now goes through `kindOfMacro`, so the two cannot disagree about which kinds exist.

C4 front matter title replaced by a `title` statement with no warning (B): fixed c476e475c4. It also warns when an `accTitle` is replaced the same way (sweep).

No extra defects outside the findings above. No `docs/unruled.md` entries were needed.

Checks:
- Each touched test file, one at a time with `--maxWorkers=1`: block.test.ts pass (17), c4.test.ts pass (16), class.test.ts pass (16), common/lines.test.ts pass (4), flowchart/lex.test.ts pass (11), flowchart/read.test.ts pass (15), gantt.test.ts pass (10), gitgraph.test.ts pass (11), mermaid/ports.test.ts pass (7). The whole `src/mermaid` directory also passed (411 tests, run before the last few fixes).
- `npm run checks:gate`: pass, "checks:gate: all 32 passed". The first run failed on 3 checks (changeset titles over 140 characters, and a prototype-key lint error in gitgraph/read.ts). I fixed both and folded the fixes into their commits.
- `npm run lint -w @weasel-js/diagram-formats`: not run, because the package has no `lint` script ("Missing script"). The root `npm run lint` passed inside the gate.
- Tree clean; no `.skulk/` changes committed.