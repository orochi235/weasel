---
'@weasel-js/forge': patch
---

A CSF arg whose argType names the `color` control now gets a color picker, as one whose name matches `controls.matchers.color` already did.
A conditional control's `if: { eq }` and `if: { neq }` now compare an array or object arg by value, as Storybook does, rather than never matching.
The story index reads a story's `name` or `storyName` written as a template literal or a top-level const, so the sidebar shows the name the story renders with.
The sidebar no longer says "No story" for a routed story that the package filter only hides.
A workshop trial's state is seeded from the story's config without the `$globals` pins, as the story's own trial seeds it.
forge's vite plugin waits for a write to settle before reporting it off macOS, so a second quick save on Linux is no longer served as the first.
