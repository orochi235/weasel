# forge.vite.part2: saturation

Repeated blind reviews of the area `forge.vite.part2` (26 files, 2516 lines) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 17.1 known defects per thousand lines, at least 5. The next defect should cost about $1.29. `skulkr scour report forge.vite.part2` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.16 |    $0.08 |     0.1 |
|   2 | claude |        4 |   4 |        6 |   6 |   0 |       13.5 |    7.5 |   100.0% | $1.09 |    $0.21 |     2.9 |
|   3 | claude |        5 |   3 |        9 |   7 |   2 |       17.2 |    8.2 |    49.5% | $0.67 |    $0.21 |     3.1 |
|   4 | claude |        5 |   3 |       12 |  10 |   0 |       45.8 |   33.8 |    62.5% | $0.71 |    $0.22 |     3.3 |
|   5 | claude |        7 |   5 |       17 |  15 |   0 |      101.0 |   84.0 |    65.2% | $0.64 |    $0.19 |     2.7 |
|   6 | claude |        6 |   4 |       21 |  18 |   1 |      156.0 |  135.0 |    60.7% | $0.69 |    $0.19 |     3.1 |
|   7 | claude |        6 |   1 |       22 |  16 |   4 |       49.4 |   27.4 |    42.2% | $0.65 |    $0.21 |     2.9 |
|   8 | claude |        1 |   0 |       22 |  16 |   4 |       50.0 |   28.0 |    41.5% | $0.57 |    $0.24 |     2.4 |
|   9 | claude |        6 |   2 |       24 |  17 |   4 |       56.1 |   32.1 |    38.2% | $0.60 |    $0.24 |     2.3 |
|  10 | claude |        5 |   2 |       26 |  17 |   6 |       47.7 |   21.7 |    33.5% | $0.65 |    $0.25 |     3.1 |
|  11 | claude |        5 |   0 |       26 |  15 |   7 |       40.6 |   14.6 |    26.4% | $0.81 |    $0.28 |     3.5 |
|  12 | claude |        2 |   0 |       26 |  15 |   7 |       40.7 |   14.7 |    25.6% | $0.69 |    $0.30 |     3.1 |
|  13 | claude |        5 |   3 |       29 |  18 |   7 |       50.4 |   21.4 |    28.7% | $0.67 |    $0.30 |     3.1 |
|  14 | claude |        3 |   0 |       29 |  17 |   8 |       45.8 |   16.8 |    25.6% | $0.69 |    $0.32 |     3.3 |
|  15 | claude |        6 |   1 |       30 |  16 |   9 |       43.3 |   13.3 |    21.8% | $0.63 |    $0.33 |     2.9 |
|  16 | claude |        3 |   1 |       31 |  17 |   9 |       46.1 |   15.1 |    22.4% | $0.97 |    $0.35 |     4.5 |
|  17 | claude |        6 |   4 |       35 |  20 |  10 |       53.8 |   18.8 |    24.4% | $0.93 |    $0.34 |     4.0 |
|  18 | claude |        5 |   1 |       36 |  21 |   9 |       59.1 |   23.1 |    24.4% | $0.83 |    $0.35 |     3.9 |
|  19 | claude |        6 |   1 |       37 |  22 |   8 |       65.7 |   28.7 |    24.0% | $0.76 |    $0.36 |     3.6 |
|  20 | claude |        5 |   2 |       39 |  24 |   8 |       73.2 |   34.2 |    24.9% | $0.69 |    $0.36 |     3.2 |
|  21 | claude |        4 |   1 |       40 |  23 |  10 |       65.2 |   25.2 |    22.7% | $0.69 |    $0.37 |     3.3 |
|  22 | claude |       10 |   2 |       42 |  24 |   7 |       81.3 |   39.3 |    21.8% | $0.83 |    $0.37 |     4.1 |
|  23 | claude |        5 |   0 |       42 |  22 |   8 |       70.9 |   28.9 |    19.0% | $0.59 |    $0.39 |     2.6 |
|  24 | claude |        4 |   0 |       42 |  22 |   7 |       75.1 |   33.1 |    18.5% | $0.60 |    $0.40 |     2.8 |
|  25 | claude |        2 |   1 |       43 |  23 |   7 |       79.3 |   36.3 |    18.8% | $0.66 |    $0.41 |     2.9 |
|  26 | claude |        4 |   0 |       43 |  22 |   7 |       76.2 |   33.2 |    17.4% | $1.02 |    $0.43 |     4.9 |
|  27 | claude |        5 |   0 |       43 |  21 |   8 |       69.5 |   26.5 |    15.9% | $0.93 |    $0.45 |     4.3 |
|  28 | claude |        3 |   0 |       43 |  19 |  10 |       60.4 |   17.4 |    14.0% | $0.72 |    $0.47 |     3.3 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |        27 |       43 |       64.4 |   21.4 |    15.0% |       – |
| all sources    | Chao2     |        28 |       43 |       60.4 |   17.4 |    14.0% |       – |
| codex × claude | Chapman   |         – |       43 |       43.0 |    0.0 |        – |       2 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                         | where                                                                                                            | first | codex | claude | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Watcher recovery treats a deleted served file (stat returns no mtime) like an untracked file, so the stale module stays in place and the story is never removed                | packages/forge/src/vite/watchRecovery.ts:86 (missed)                                                             |     1 |     1 |      1 | medium   |
| D2  | An in-flight wrapper resolution in settle can restore a story file removed by a concurrent unlink, inserting it back as an empty entry or overwriting a newer wrapper decision | packages/forge/src/vite/storyIndex.ts:105 (settle)                                                               |     1 |     1 |      4 | medium   |
| D3  | A server restart that reuses forge's plugin objects lets the old server's close tear down the new server's capture endpoint                                                    | packages/forge/src/vite/plugin.ts:198 (forge, configureServer / closeServer)                                     |     2 |     0 |      1 | medium   |
| D4  | On a restart that reuses plugin objects, the old server's buildEnd clears the new server's sweep timer                                                                         | packages/forge/src/vite/watchRecovery.ts:172 (watchRecovery, buildEnd) and :150 (configureServer)                |     2 |     0 |      1 | low      |
| D5  | Two separate implementations of the nearest package.json's name lookup disagree on the answer                                                                                  | packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)                                                     |     2 |     0 |     27 | low      |
| D6  | packageNameOf's top bound is checked as a string prefix, so a sibling directory sharing the prefix counts as inside it                                                         | packages/forge/src/vite/packageName.ts:6 (packageNameOf)                                                         |     2 |     0 |     17 | medium   |
| D7  | TypeDoc source paths written with `../` never match, so the component gets no TypeDoc docs                                                                                     | packages/forge/src/vite/typedoc/index.ts:76 (suffixOf)                                                           |     3 |     0 |      2 | low      |
| D8  | A merged interface's definition prints only its first declaration                                                                                                              | packages/forge/src/vite/typeDefs.ts:55 (addTypeDef)                                                              |     3 |     0 |      3 | low      |
| D9  | Workshop pages answer GET only, so HEAD for `/` or `/frame.html` falls through to vite's 404                                                                                   | packages/forge/src/vite/servePages.ts:27 (servePages middleware)                                                 |     3 |     0 |      2 | low      |
| D10 | TypeDoc prop docs keep the first declaration seen, so a prop redeclared after Omit<Base, 'x'> shows Base's comment instead of its own                                          | packages/forge/src/vite/typedoc/index.ts:141 (collect)                                                           |     4 |     0 |      1 | medium   |
| D11 | Story files added outside the vite root are never indexed because only files that already exist are watched                                                                    | packages/forge/src/vite/plugin.ts:73 (watchSources)                                                              |     4 |     0 |      3 | low      |
| D12 | watchRecovery's URL-to-file map is never pruned, so it grows without bound                                                                                                     | packages/forge/src/vite/watchRecovery.ts:165 (transform handler)                                                 |     4 |     0 |      2 | low      |
| D13 | closeServer is not a vite plugin hook, so the capture endpoint and its headless Chromium are never closed                                                                      | packages/forge/src/vite/plugin.ts:201 (forge, plugin object)                                                     |     5 |     0 |      2 | medium   |
| D14 | mayBeStory resolves an identifier inside a function against the file's top-level bindings, ignoring parameters and locals that shadow it                                       | packages/forge/src/vite/nativeExports.ts:118 (mayBeStory, Identifier case)                                       |     5 |     0 |      3 | low      |
| D15 | A numeric key in a namespace destructure is recorded as a number rather than a string import name                                                                              | packages/forge/src/vite/moduleInfo.ts:53 (moduleInfo, declareStatement)                                          |     5 |     0 |      4 | low      |
| D16 | fileEventsArrive leaks the watcher when an injected watch reports synchronously                                                                                                | packages/forge/src/vite/watchProbe.ts:68 (fileEventsArrive)                                                      |     5 |     0 |      6 | low      |
| D17 | Config modules and frame styles are written as platform paths while every other id is posix                                                                                    | packages/forge/src/vite/virtualModules.ts:42 (virtualModules, configModule/frameStyles)                          |     5 |     0 |      1 | low      |
| D18 | addTypeDefs treats every identifier-shaped word in a type's text as a type reference, string literals and property names included                                              | packages/forge/src/vite/typeDefs.ts:39 (addTypeDefs)                                                             |     6 |     0 |      1 | low      |
| D19 | TypeDoc lookup accepts a class component but reads no props from it, so its docs come out empty                                                                                | packages/forge/src/vite/typedoc/index.ts:84 (exportIn) / :118 (propsTypeOf)                                      |     6 |     0 |      5 | low      |
| D20 | watchRecovery's transform takes a pending read that the client load recorded, even when the transform runs in another environment                                              | packages/forge/src/vite/watchRecovery.ts:160 (transform handler)                                                 |     6 |     0 |      3 | low      |
| D21 | A ref handle's accessor members lose their TypeDoc description                                                                                                                 | packages/forge/src/vite/typedoc/index.ts:205 (memberDocs)                                                        |     6 |     0 |      2 | low      |
| D22 | propControls always appends an API export, even when the story has no component                                                                                                | packages/forge/src/vite/propControls.ts:66 (storyExports)                                                        |     7 |     0 |      1 | low      |
| D23 | `export default interface` is read as a value default export                                                                                                                   | packages/forge/src/vite/moduleInfo.ts:96 (moduleInfo, ExportDefaultDeclaration)                                  |     9 |     0 |      3 | low      |
| D24 | A type definition declared `export default interface` prints with a stray `default` keyword                                                                                    | packages/forge/src/vite/typeDefs.ts:71 (addTypeDef)                                                              |     9 |     0 |      7 | low      |
| D25 | A rejected TypeScript reader promise is cached, so one failure disables prop controls and the API panel for the rest of the server's life                                      | packages/forge/src/vite/propControls.ts:107 (propControls transform)                                             |    10 |     0 |      3 | low      |
| D26 | moduleInfo exports `declare`d values, which have no runtime binding                                                                                                            | packages/forge/src/vite/moduleInfo.ts:43 (declareStatement)                                                      |    10 |     0 |      1 | low      |
| D27 | A story served before TypeDoc's JSON exists never picks up its docs once the JSON is written                                                                                   | packages/forge/src/vite/propControls.ts:73 (storyExports)                                                        |    13 |     0 |      1 | low      |
| D28 | Wrapper tracing stops at a local const alias, so a project helper re-exporting forge's meta that way is not recognized                                                         | packages/forge/src/vite/trace.ts:51 (declaring)                                                                  |    13 |     0 |      1 | low      |
| D29 | fileEventsArrive with a NaN waitMs never settles and keeps rewriting its temp file forever                                                                                     | packages/forge/src/vite/watchProbe.ts:83 (fileEventsArrive)                                                      |    13 |     0 |      2 | low      |
| D30 | A bare `return;` makes returnsStory treat a function as one that may return a story                                                                                            | packages/forge/src/vite/nativeExports.ts:68 (returnsStory)                                                       |    15 |     0 |      2 | low      |
| D31 | warnOnce's per-logger set of seen messages has no bound and never forgets, unlike registry's capped createWarnOnce                                                             | packages/forge/src/vite/warnOnce.ts:9 (warnOnce)                                                                 |    16 |     0 |      1 | low      |
| D32 | watchRecovery's quiet sweep replays an edit the watcher is about to report, warning "changed with no file event" and pushing the change twice                                  | packages/forge/src/vite/watchRecovery.ts:105 (sweep / missed)                                                    |    17 |     0 |      2 | low      |
| D33 | A user's own watchRecovery({ quietMs }) placed after forge() is silently inactive                                                                                              | packages/forge/src/vite/plugin.ts:101 (companions)                                                               |    17 |     0 |      1 | low      |
| D34 | A component documented in one package hands its TypeDoc docs to a same-named component in an undocumented package                                                              | packages/forge/src/vite/typedoc/index.ts:81 (exportIn)                                                           |    17 |     0 |      3 | medium   |
| D35 | Plain value exports in a native story file, such as -1, a + b, new Map() or undefined, are indexed as stories                                                                  | packages/forge/src/vite/nativeExports.ts:118 (mayBeStory)                                                        |    17 |     0 |      1 | low      |
| D36 | TypeDoc prop docs are never found for a memo-wrapped component                                                                                                                 | packages/forge/src/vite/typedoc/index.ts:131 (collect)                                                           |    18 |     0 |      1 | low      |
| D37 | A story passed through Object.defineProperty, defineProperties or setPrototypeOf, or a computed Object['freeze'] call, is not recognized as a story                            | packages/forge/src/vite/nativeExports.ts:76 (PASS_THROUGH / objectCallSources), :120 (mayBeStory CallExpression) |    19 |     0 |      1 | medium   |
| D38 | The recovering warning promises a sweep "within seconds", but a quietMs longer than one timer means the sweep never runs                                                       | packages/forge/src/vite/watchProbe.ts:91 (RECOVERING / warnWhenWatchIsSilent)                                    |    20 |     0 |      1 | low      |
| D39 | A name exported by two `export *` modules resolves to the first one, where ES modules treat it as ambiguous and export neither                                                 | packages/forge/src/vite/trace.ts:61 (declaring)                                                                  |    20 |     0 |      1 | low      |
| D40 | typeText prints a template literal type without escaping backticks or `${` in its text parts, so the printed type is malformed                                                 | packages/forge/src/vite/typedoc/print.ts:39 (typeText, case 'templateLiteral')                                   |    21 |     0 |      2 | low      |
| D41 | On Windows packageNameOf never matches a git-derived `top` written with `/` against `dirname` paths written with `\`, so no package is found                                   | packages/forge/src/vite/packageName.ts:6 (packageNameOf)                                                         |    22 |     0 |      1 | low      |
| D42 | A prop declared as a method signature gets no TypeDoc docs because entryDocs reads prop.comment while TypeDoc puts the comment on the signature                                | packages/forge/src/vite/typedoc/index.ts:62 (readTypedoc.component)                                              |    22 |     0 |      1 | low      |
| D43 | When top ends in a path separator, the climb never checks top's own directory, so a package.json at top is never found                                                         | packages/forge/src/vite/packageName.ts:6 (packageNameOf)                                                         |    25 |     0 |      1 | low      |
