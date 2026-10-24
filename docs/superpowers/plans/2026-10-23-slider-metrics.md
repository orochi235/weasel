# Slider Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: written 2026-10-23, not built.** The last unbuilt piece of the appearance-axes work; the rest
merged 2026-10-24 and is described in `docs/conventions.md` ("Appearance props"). Delete this plan
when it merges.

**Goal:** Replace Slider's `density` presets (`'default' | 'slim'`) with numeric params, decided
2026-10-23: `density` there meant track thickness and thumb shape, not room.

Work in a worktree of its own, commit by path, run one test file at a time, and run
`npm run test:fleet` on the branch before merging.

---

### Task: Slider's `density` becomes numeric params

**❓ Decide before starting:** `slim` changes more than sizes. It also turns the thumb from a tab
spanning the track into a round dot centered on it, and drops its border and blur
(`Slider.module.css:102–115`). Numbers cover size and radius, not the face. The proposal below
covers the face with a radius (a round dot is a radius of half its size) and a border width of 0.
Confirm with Mike before building it.

**Files:** `packages/ui/src/components/Slider/{types.ts,SliderBody.tsx,Slider.module.css,Slider.density.test.tsx,Slider.stories.tsx}`, and the callers: `Jog.tsx:132`, `TokenPanel/Scale.tsx:163`, `Timeline/Transport.tsx:142`, forge `TransportBar.tsx:17`, labkit `LensZoom.tsx:54`, labkit `ZoomControl.tsx:50`, `apps/theme-editor/src/ThemePreview.tsx:47`, and `sliderSlop.browser.test.tsx:30`.

- [ ] **Step 1: Failing test** (rewrite `Slider.density.test.tsx`, renamed `Slider.metrics.test.tsx`):

```tsx
  it('writes each metric it is given, a number as px and a string as-is', () => {
    const { container } = render(
      <Slider {...base} trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)" thumbRadius="50%" thumbBorder={0} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--rp-track-height')).toBe('var(--wzl-slider-track-h)');
    expect(root.style.getPropertyValue('--rp-thumb-size')).toBe('var(--wzl-slider-thumb-size)');
    expect(root.style.getPropertyValue('--rp-thumb-radius')).toBe('50%');
    expect(root.style.getPropertyValue('--rp-thumb-border')).toBe('0px');
  });

  it('writes nothing it is not given', () => {
    const root = render(<Slider {...base} />).container.firstElementChild as HTMLElement;
    for (const name of ['--rp-track-height', '--rp-thumb-size', '--rp-thumb-radius', '--rp-thumb-border']) {
      expect(root.style.getPropertyValue(name)).toBe('');
    }
  });
```

- [ ] **Step 2: Implement.** In `types.ts`, `density` is deleted, `trackHeight` widens to
`number | string`, and `thumbSize`, `thumbRadius`, and `thumbBorder` (`number | string`) arrive.
`SliderBody.tsx` writes each as its `--rp-*` property, a number as `${n}px`. `Slider.module.css`:
the thumb reads `--rp-thumb-radius` and `--rp-thumb-border`. A thumb given a `--rp-thumb-size` is
centered and square at that size, replacing the `.slim .thumb` rules, which are deleted along with
the `.slim` class.

- [ ] **Step 3: Callers.** Each `density="slim"` becomes
`trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)" thumbRadius="50%" thumbBorder={0}`.
The callers repeating that set should share one constant, exported from Slider as `ROW_SLIDER_METRICS`
and spread as `{...ROW_SLIDER_METRICS}`.

- [ ] **Step 4: Tests and browser.** Run the metrics test and
`npx vitest run --project=browser packages/ui/src/components/sliderSlop.browser.test.tsx`. Then
screenshot the Jog and Transport stories in headless Chrome, before and after, and post both with
`transom post`. They must match.

- [ ] **Step 5: Commit**

```bash
git commit -m "replace Slider's density presets with numeric track and thumb params" -- <every path touched>
```

