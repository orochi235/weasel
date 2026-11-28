# forge.vite.part1: saturation

Repeated blind reviews of the area `forge.vite.part1` (27 files, 3196 lines) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 8.4 known defects per thousand lines, at least 5. The next defect should cost about $1.37. `skulkr scour report forge.vite.part1` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.16 |    $0.08 |     0.1 |
|   2 | claude |        2 |   2 |        4 |   4 |   0 |        7.0 |    3.0 |   100.0% | $1.47 |    $0.41 |     5.1 |
|   3 | claude |        4 |   3 |        7 |   6 |   1 |       19.0 |   12.0 |    64.3% | $2.01 |    $0.52 |     6.0 |
|   4 | claude |        3 |   2 |        9 |   7 |   2 |       18.2 |    9.2 |    53.5% | $0.79 |    $0.49 |     4.0 |
|   5 | claude |        3 |   2 |       11 |   8 |   3 |       19.5 |    8.5 |    48.1% | $0.69 |    $0.47 |     3.3 |
|   6 | claude |        3 |   2 |       13 |  10 |   2 |       33.8 |   20.8 |    54.5% | $0.90 |    $0.46 |     4.7 |
|   7 | claude |        1 |   0 |       13 |  10 |   1 |       55.9 |   42.9 |    53.8% | $0.81 |    $0.53 |     3.9 |
|   8 | claude |        2 |   2 |       15 |  12 |   1 |       78.0 |   63.0 |    58.6% | $0.97 |    $0.52 |     5.1 |
|   9 | claude |        3 |   1 |       16 |  12 |   2 |       48.0 |   32.0 |    50.1% | $1.25 |    $0.57 |     6.8 |
|  10 | claude |        2 |   1 |       17 |  13 |   2 |       55.0 |   38.0 |    50.3% | $1.44 |    $0.62 |     5.6 |
|  11 | claude |        2 |   1 |       18 |  13 |   3 |       43.6 |   25.6 |    46.0% | $1.39 |    $0.66 |     7.2 |
|  12 | claude |        3 |   1 |       19 |  13 |   4 |       38.4 |   19.4 |    41.0% | $0.84 |    $0.67 |     4.1 |
|  13 | claude |        2 |   1 |       20 |  14 |   4 |       42.6 |   22.6 |    41.8% | $1.00 |    $0.69 |     5.1 |
|  14 | claude |        2 |   1 |       21 |  15 |   4 |       47.1 |   26.1 |    42.4% | $0.83 |    $0.69 |     4.2 |
|  15 | claude |        4 |   2 |       23 |  15 |   6 |       40.5 |   17.5 |    37.3% | $0.84 |    $0.67 |     3.9 |
|  16 | claude |        4 |   2 |       25 |  17 |   5 |       52.1 |   27.1 |    38.9% | $1.00 |    $0.66 |     4.4 |
|  17 | claude |        1 |   0 |       25 |  17 |   5 |       52.2 |   27.2 |    38.1% | $0.84 |    $0.69 |     4.4 |
|  18 | claude |        3 |   1 |       26 |  17 |   6 |       48.7 |   22.7 |    35.5% | $1.18 |    $0.71 |     3.7 |
|  19 | claude |        3 |   1 |       27 |  17 |   7 |       46.6 |   19.6 |    33.2% | $1.62 |    $0.74 |     6.0 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |        18 |       25 |       40.2 |   15.2 |    30.3% |       – |
| all sources    | Chao2     |        19 |       27 |       46.6 |   19.6 |    33.2% |       – |
| codex × claude | Chapman   |         – |       27 |       77.0 |   50.0 |        – |       0 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                                            | where                                                                                                                   | first | codex | claude | severity |
|-----|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Capture cache key canonicalizes key order but the renderer uses original order, so differently ordered payloads share a cache entry and get the wrong layout                                      | packages/forge/src/vite/capture/endpoint.ts:28                                                                          |     1 |     1 |      0 | medium   |
| D2  | History cache key omits tag ref names, so a renamed lightweight release tag on the same commit leaves stale component version labels                                                              | packages/forge/src/vite/history.ts:158                                                                                  |     1 |     1 |      0 | low      |
| D3  | An edit that lands while deps.js is being served, after a graph has already gone out, can leave the page and depsSent holding the pre-edit graph                                                  | packages/forge/src/vite/depsFeed.ts:96 (createDepsFeed → module / redeps)                                               |     2 |     0 |      9 | medium   |
| D4  | When an allowlisted response carries several Set-Cookie headers, passThrough forwards only the last one to the capture page                                                                       | packages/forge/src/vite/capture/browser.ts:97 (passThrough)                                                             |     2 |     0 |      6 | low      |
| D5  | componentOf's meta reader stops at an identifier argument, so the API table names a different component than the graph                                                                            | packages/forge/src/vite/componentOf.ts:79 (objectOf)                                                                    |     3 |     0 |      2 | medium   |
| D6  | componentOf reads `component` through a spread of an imported object, but the indexer treats that spread as setting nothing                                                                       | packages/forge/src/vite/componentOf.ts:150 (componentIn)                                                                |     3 |     0 |      2 | low      |
| D7  | A component whose props are a union lists only the props shared by every member                                                                                                                   | packages/forge/src/vite/apiTable.ts:42 (apiTable)                                                                       |     3 |     0 |      2 | medium   |
| D8  | A capture's cache key leaves out the origins it was allowed to load, so captures that allow different origins share one cache entry                                                               | packages/forge/src/vite/capture/endpoint.ts:203 (serveCapture capture)                                                  |     4 |     0 |      1 | low      |
| D9  | An unscoped package's release tag pattern also matches a scoped package's tags with the same base name                                                                                            | packages/forge/src/vite/history.ts:136 (createHistoryReader load)                                                       |     4 |     0 |      1 | low      |
| D10 | ownHost refuses hosts that vite's own host check accepts, such as server.origin and hmr.host                                                                                                      | packages/forge/src/vite/capture/endpoint.ts:118 (ownHost)                                                               |     5 |     0 |      2 | low      |
| D11 | The issues endpoint parses req.url with new URL(req.url, base), so a request path starting with //host/ is read as a host and the path match goes wrong                                           | packages/forge/src/vite/issues/endpoint.ts:150 (serveIssues middleware)                                                 |     5 |     0 |      1 | low      |
| D12 | componentOf's forge-wrapper check rejects a meta the story indexer accepts, such as a namespace import of a re-exporting module or an `export *` from forge, so the two disagree on the component | packages/forge/src/vite/componentOf.ts:107 (isForgeWrapper)                                                             |     6 |     0 |      3 | medium   |
| D13 | componentOf does not see through a TypeScript cast: an identifier inside a cast in objectOf, or a cast or call inside a spread in componentIn, is not followed where the babel indexer follows it | packages/forge/src/vite/componentOf.ts:72 (objectOf), packages/forge/src/vite/componentOf.ts:137 (componentIn)          |     6 |     0 |      2 | low      |
| D14 | A rebuild queued before reset() runs against the new root and marks the graph as sent though no page requested it                                                                                 | packages/forge/src/vite/depsFeed.ts:73 (createDepsFeed → rebuild / reset)                                               |     8 |     0 |      1 | low      |
| D15 | The name-rev --refs pattern lets a package's version be read from another package's tag whose name has a path segment starting with a digit or v+digit                                            | packages/forge/src/vite/history.ts:139 (createHistoryReader → load, name-rev --refs)                                    |     8 |     0 |      1 | low      |
| D16 | A redirected allowlisted request is fulfilled at its original URL, so relative references in the body resolve against the pre-redirect location                                                   | packages/forge/src/vite/capture/browser.ts:78 (passThrough)                                                             |     9 |     0 |      1 | medium   |
| D17 | repoOf treats an SSH host alias such as `github-work` as a GitHub Enterprise host instead of github.com                                                                                           | packages/forge/src/vite/issues/endpoint.ts:62 (repoOf)                                                                  |    10 |     0 |      1 | low      |
| D18 | assignedNames misses an assignment whose target is a TS cast or non-null assertion, so a reassigned top-level let is read as its initializer                                                      | packages/forge/src/vite/ast.ts:120 (assignedNames), packages/forge/src/vite/ast.ts:131 (patternNames)                   |    11 |     0 |      2 | low      |
| D19 | Capture browser contexts are cached and reused across stories, keeping each story's storage, so a capture's output depends on the captures that ran before it                                     | packages/forge/src/vite/capture/browser.ts:150 (contextCache / contextFor)                                              |    12 |     0 |      2 | medium   |
| D20 | A story with `isolate: undefined` makes isolateOf throw, which drops the whole file from the index                                                                                                | packages/forge/src/vite/indexFile.ts:197 (isolateOf)                                                                    |    13 |     0 |      1 | low      |
| D21 | The auto-title port drops an Index/INDEX file name from the title where Storybook keeps it                                                                                                        | packages/forge/src/vite/autoTitle.ts:25 (titleParts)                                                                    |    14 |     0 |      1 | low      |
| D22 | passThrough never consumes or cancels a redirect hop's response body                                                                                                                              | packages/forge/src/vite/capture/browser.ts:80 (passThrough)                                                             |    15 |     0 |      1 | low      |
| D23 | indexProgram drops `__namedExportsOrder` without applying its order to the stories                                                                                                                | packages/forge/src/vite/indexFile.ts:180 (indexProgram)                                                                 |    15 |     0 |      1 | low      |
| D24 | A failed import resolution is cached as null and never retried until the importer itself changes                                                                                                  | packages/forge/src/vite/bindings.ts:46 (createBindings resolveFrom)                                                     |    16 |     0 |      1 | low      |
| D25 | `tags` written with a spread element are silently dropped from the index                                                                                                                          | packages/forge/src/vite/indexFile.ts:221 (tagsOf)                                                                       |    16 |     0 |      1 | low      |
| D26 | A top-level var redeclared with a value inside a block or a for…of/for…in head is not counted as an assignment, so the name is treated as never reassigned                                        | packages/forge/src/vite/ast.ts:119 (assignedNames)                                                                      |    18 |     0 |      1 | low      |
| D27 | A story file with a syntax error fails without naming the file, because indexStoryResolved parses it with foreignCallees before indexFile                                                         | packages/forge/src/vite/indexStory.ts:41 (indexStoryResolved), packages/forge/src/vite/indexFile.ts:57 (foreignCallees) |    19 |     0 |      1 | low      |
