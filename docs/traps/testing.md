# Testing traps

Things in jsdom, vitest and perf harnesses that pass every test and are still wrong.

**jsdom cannot catch a layout collapse.** Arc 3 of the labkit pass wrapped the workspace in a
row whose `flex: 1` resolved to nothing inside a block container, so the lab rendered as an empty
page — with all 7903 tests green. Screenshot anything that changes a container's box.

**A jsdom API that exists but has no consequence produces a test that cannot fail.**
`setPointerCapture` is a real function there: it records the call and does nothing else, so
`pointerup` is never retargeted and the element the browser would synthesize `click` on does not
change. `FloatingPanel` captured on pointerdown — which in a browser kills the click on every
non-native child — and the obvious test, that the child's `onClick` fired, passed before the fix
and after it. This is what makes watch-it-fail the load-bearing half of TDD rather than a step of
write-it-first: when a test written to fail doesn't, you are asserting the emulation. Assert a
proxy on this side of the boundary instead — here, that nothing called `setPointerCapture` — and
say in the test that it is a proxy. A stand-in that drops *cost* rather than behavior does the
same to an efficiency claim: a fake client makes "refetches only when its inputs changed" green
against a hook that refetches unconditionally.

**The CSS-module proxy in the `weasel-ui` vitest project answers to any key.** `s.thisNeverExisted`
comes back as `_thisNeverExisted_<filehash>`, so asserting a class proves only that the component
asked for that key — never that a rule defines it, and a class whose rule was deleted still reads
as present. The hash is per stylesheet, so an assertion can still tell *which* module a class came
from; to know a rule survives, read the stylesheet or check it in a browser.

**`fsModuleCache` keys a module by its own content alone.** A transform whose output depends on
another file goes stale when only that file changes, on every fleet node, whose cache persists. CSS
is covered: `scripts/vitest-css-cache-key.ts` adds the sheets a CSS file reaches by `@import` and
`composes … from` to its key, and every project that sets its own `plugins` has to list it. A new
transform that reads another real file needs the same, through `configureVitest`'s
`defineCacheKeyGenerator`. A virtual module is keyed by what its `load` returns, so it is safe.

**Every jsdom test file runs in its own realm (`pool: 'vmThreads'`).** Its `Object`,
`Set`, `RegExp` and `Uint8Array` are not Node's, and `structuredClone` hands back Node's,
so an `instanceof` or `=== Object.prototype` check fails on a clone and `toEqual(new
Set(…))` reports two identical values as different. Use `isPlainObject` from core, or
check the tag with `Object.prototype.toString`. Node globals no longer leak in either — a
browser API jsdom lacks goes in `vitest.setup.ts`. A test that starts a real vite server
belongs in `forge-node`, on the threads pool: rolldown's native binding rejects a foreign
`RegExp`.

**A test file that passes alone and fails in a full run is measuring load, not your
change.** Bisecting with the file in isolation at one end and the whole suite at the
other produced a clean, entirely false "both parents green, merge red" — the two ends
were different experiments. Use one probe across the whole range.

**A browser test file that loads no tests, beside `weasel-request … net::ERR_NETWORK_CHANGED`
lines, lost its imports to the node's network and not to the change under test.** Chromium on
macOS drops every request in flight when the network changes, those to vite on localhost included.
`docs/TODO.md` ("fail to load when the node's network changes") has the evidence.

**Run vitest with `--reporter=default` to see a passing test's console output.** The
reporter vitest picks on its own when an agent runs it drops stderr from passing tests, so
React's "not wrapped in act(...)" warnings looked like they only happened in CI. They
reproduce locally once the reporter prints them.

**A windease store notifies its subscribers on a microtask, so a sync `act` ends before
they re-render.** That covers every lab: `Workspace` and `Split` register nodes while they
mount, and every `addTrial`, `rerender` or mark added does the same. Mount through
`renderSettled` (`@weasel-js/react/testing/renderSettled`), and make a store-changing
`act` async, so the notify lands inside it.

**`renderHook` under an arrow-function `StrictMode` wrapper runs each effect once.** `wrapper: ({ children }) =>
<StrictMode>{children}</StrictMode>` mounts the hook with no double effect, so a test written to catch a missing
cleanup passes either way; `wrapper: StrictMode` or the `reactStrictMode: true` option runs it twice (measured
2026-11-12, React 19.2).

**An async `act` never returns while a tree re-renders every frame faster than it can render.**
React's async `act` keeps flushing until a turn of the event loop finds no update queued; a playing
clock's transport queues one per frame, and on a loaded node, where a render outlasts a frame, there
is one every turn. labkit's lab tests stalled for their whole 20 s timeout this way on the fleet and
passed in milliseconds alone (2026-10-29). `actSettled` (`@weasel-js/react/testing/renderSettled`),
which `renderSettled` uses, holds animation frames until it returns; use it for an async `act` that
starts or runs during playback.

**A canvas learns that its host resized from a `ResizeObserver`, so a fixed wait can press against the old
fit.** The observer reports only at the next frame's rendering step, after that frame's `requestAnimationFrame`
callbacks, and a long first frame holds it back past any timeout. In WeaselChart the host shrinks when the
toolbar's palette fills in, about 170 ms into a mount on a loaded node; `labelDrag.browser.test.tsx` pressed 18 px
off its label until 2026-10-31. Wait for the canvas's box to match its host's (chart's `canvasSettled`), then for
two frames.

**`useScene` builds its scene once into a ref and never rebuilds it.** Editing a demo's
`initial` nodes and saving leaves the previous scene live under HMR, so the canvas paints
the old data with no error and no warning. A hard reload is the only way to trust a
before/after taken in the browser.

**A perf loop driven by hover events measures vsync.** A hover that changes no state does
not dirty the surface, so the loop reports zero uploads as though the caches had absorbed
the work, and a cache that does nothing scores the same as one that works. Count draw
calls alongside whatever else the loop counts.

**A timed-out test keeps running, and its retry gets its aborted `signal`.** vitest 5.0.2 moves on at
the timeout without stopping the test body, so whatever it still posts reaches the next test's
mounts: in `Lab.messages.test.tsx` that read as a play rate of 0 and one state report too many
(2026-10-27). The retry is handed the attempt's already-aborted `context.signal`, so guarding on it
fails every retry at once; guard on a per-test fixture that ends with the attempt instead: labkit's
`live` (`packages/labkit/src/testing/liveTest.ts`), which also logs the stack of each step a failed
test was still waiting on.

**Headless Chromium runs with the GPU off unless launched with `--enable-gpu`, and a WebGPU canvas
there takes every tab down.** Playwright's `chromium` is the headless shell. On a fleet Mac it draws
WebGL on SwiftShader (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device …))`) and hands WebGPU a
`google/swiftshader` adapter, so a pixel read measures SwiftShader's rasterizer, which snaps vertices
to 1/16 px and clips geometry to the viewport for real. Its software compositing also cannot present a
WebGPU canvas, in the document or not, in any format: every frame logs `CopyTextureForBrowser` into
`[Invalid Texture]`, and closing the context fails `kDissociateMailboxForPresent` on stderr. After that
the page has no GPU: `requestAdapter()` and `getContext('webgl2')` return null, and an attached canvas
dies on its first frame with "A valid external Instance reference no longer exists". Every tab shares
one Chromium, so the files running beside it fail too (teitou, 2026-11-06).

`--enable-gpu` puts both APIs on the node: WebGL on `ANGLE Metal Renderer: Apple M5 Max`, WebGPU on
`apple/metal-3`, one rasterizer for both. An attached canvas then presents 60 frames clean, opaque or
premultiplied, rgba8unorm or bgra8unorm, configured once or every frame. `--use-angle=metal` and full
Chromium's headless (`channel: 'chromium'`) do the same, and `--use-webgpu-adapter=swiftshader` beside
`--enable-gpu` presents clean too: the fault is the compositing, not the adapter (teitou, 2026-11-06).
So the whole browser project launches with `--enable-gpu`, as the visual suite does, both taking their
flags from `scripts/chromium-gpu-args.ts` (2026-11-07); `rasterizer.browser.test.ts` fails a launch that
fell back to SwiftShader on a Mac. Every WebGPU browser file runs in the `browser (webgpu)` instance, a
Chromium of its own, so a device lost there takes no other file's tabs; a new one goes in `WEBGPU_TESTS`
in `vitest.config.ts`. On GitHub's GPU-less ubuntu-22.04 runner
neither `--enable-gpu` alone nor `channel: 'chromium'` keeps the device: of ten launches probed, only
`--enable-gpu --use-angle=swiftshader --enable-unsafe-swiftshader --use-vulkan=swiftshader
--use-webgpu-adapter=swiftshader` (beside `--enable-unsafe-webgpu --enable-features=Vulkan`) presented 40
frames with the device alive, and it is what the visual suite's WebGPU job launches (2026-11-07). There a 2D
`drawImage` of a WebGPU canvas already shown comes out transparent, while `toDataURL` holds the shown frame
and a `drawImage` in the task that drew it holds that frame; the visual specs read through `toDataURL`. Print
`WEBGL_debug_renderer_info`'s `UNMASKED_RENDERER_WEBGL` and `adapter.info` before trusting a claim
about what a GPU does.

**A vm worker that lives a whole run can segfault V8.** On teitou, fleet runs died from a worker SIGSEGV (a jump
to address 0 under `PromiseConstructor` during another worker's full GC) until `vmMemoryLimit: '1gb'` made vitest
replace each vm worker about once a run (2026-10-22); vitest's default limit never recycles one, since it reads
`heapUsed` without a GC. Nothing leaks (a worker over 319 files held a flat ~200 MB), and the cause was not hunted
(ruled 2026-11-07), so raising or removing the limit brings the crash back.

**jsdom keeps every Document a `DOMParser` makes, though not a tree taken out of it.** A deep run of svg's
exporter properties died on teitou at the 4 GB heap limit ("ineffective mark-compacts", 2026-11-10). Measured
there with a forced GC: 6,000 parses of those documents held 740 MB more than before, about 120 KB each, and the
same parses each followed by `doc.documentElement.remove()` held 30 MB. `parseSvg` removes its tree when it is
done for this reason; a test parsing thousands of documents itself does the same. The cause inside jsdom was not
hunted.
