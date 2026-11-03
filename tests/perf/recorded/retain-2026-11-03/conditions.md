Runs on teitou (Apple M5 Max, ANGLE Metal, headless Chromium), 2026-11-03, through `onto do --solo --gui`
(the smoke run without `--solo`), tree at 6b88d4c61 plus this branch's uncommitted files. Every run's
load and GPU utilization before and after is in `teitou/conditions.txt`; the GPU read 35–52% busy around
the solo runs, from something outside onto.

| Label | What | Script |
|---|---|---|
| `smoke` | `retain-redraw`, one context, tiles `none,1024`, before the cull fix | `run.sh` |
| `cull-{before,after}-{1,2}` | `retain-redraw`, 6 contexts, ABBA: `draw/retained.ts` as at 6b88d4c61 against culling every depth per tile | `ab.sh` |
| `redraw-tiles` | `retain-redraw`, 4 contexts, tiles `none,512,1024,2048`, after the fix | `fx.sh` |
| `dispatch-plain`, `dispatch-blur8` | `layer-dispatch`, layers 1,4 x commands 1,10,30,100,300, without and with each layer's commands under a blur of radius 8 | `fx.sh` |

The `smoke` and `cull-*` runs began each GPU timer query before the idle task ahead of the frame, so their
`gpu` column counts that idle time; the later runs time the frame's own commands, and still read more than
the frame's wall time on tiled frames.

Read from them: before the fix a tiled redraw spent its extra time staging glyphs (`placeGlyph`,
`pushGlyph`) in every tile, because each layer is one group spanning every tile and culling looked at the
top level only. In every context of every run since, tile 1024 is within 1 ms of untiled. With the blur,
retaining wins from 10 commands at both layer counts; without it, between 100 and 300 at one layer and
between 30 and 100 at four.
