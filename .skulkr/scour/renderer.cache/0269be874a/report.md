# renderer.cache: saturation

Repeated blind reviews of the area `renderer.cache` (11 files, 1383 lines) at the frozen commit
`0269be874a`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: the next defect would cost about $1.76, over the limit of $1.49 (3× the $0.50 going rate). The next defect should cost about $1.76. `skulkr scour report renderer.cache` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.18 |    $0.06 |     0.2 |
|   2 | claude |        0 |   0 |        3 |   3 |   0 |        4.5 |    1.5 |   100.0% | $1.13 |    $0.44 |     2.6 |
|   3 | claude |        1 |   1 |        4 |   4 |   0 |        8.0 |    4.0 |   100.0% | $1.92 |    $0.81 |     3.7 |
|   4 | claude |        2 |   1 |        5 |   4 |   1 |       11.0 |    6.0 |    57.1% | $1.52 |    $0.95 |     4.1 |
|   5 | claude |        1 |   0 |        5 |   4 |   0 |        9.8 |    4.8 |    57.1% | $1.83 |    $1.32 |     4.5 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        3 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |        2 |        2.0 |    0.0 |    25.0% |       – |
| all sources    | Chao2     |         5 |        5 |        9.8 |    4.8 |    57.1% |       – |
| codex × claude | Chapman   |         – |        5 |       11.0 |    6.0 |        – |       0 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                    | where                                                                               | first | codex | claude | severity |
|-----|-----------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Failed page allocation leaves a phantom page claim in `pages`, so later uploads collide and texture(id) has nothing to bind                               | packages/renderer/src/cache/GLTextureCache.ts:146                                   |     1 |     1 |      0 | low      |
| D2  | Image cache reused after disposal is never re-added to `live`, so releaseImageSource and the latest-frame query miss its new texture                      | packages/renderer/src/cache/GLImageCache.ts:156                                     |     1 |     1 |      0 | low      |
| D3  | Failed attribute replacement leaves the old mesh entry cached, whose resources were already queued for transient cleanup and get deleted by freeTransient | packages/renderer/src/cache/GLMeshCache.ts:77                                       |     1 |     1 |      0 | low      |
| D4  | subImageR8/subImageRGBA skip the kind check uploadR8/uploadRGBA enforce, so glyph bytes get written into a texture that belongs to an image               | packages/renderer/src/cache/GLTextureCache.ts:167 (subImageR8), :184 (subImageRGBA) |     3 |     0 |      3 | low      |
| D5  | A font-atlas upload under an id already registered drops that id from the sweep, so its texture outlives the registry entry                               | packages/renderer/src/cache/GLTextureCache.ts:68 (upload)                           |     4 |     0 |      1 | low      |
