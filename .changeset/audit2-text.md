---
"@weasel-js/font": patch
"@weasel-js/text": patch
"@weasel-js/text-dom": patch
"@weasel-js/core": patch
"@weasel-js/renderer": patch
---

Text fixes from an audit:

- An outline face registered again while its first file was still loading no longer builds the DOM face from the old file's bytes.
- Registering a bidi engine or shaper (`registerBidi`, `registerShaper`) after text was first drawn now lays that text out again in its picking silhouette, in `textClusters` and in retained layers; it used to keep the order and widths from before. New `textEngineGeneration()` counts those registrations.
- `runsToMarkdown` writes markers only where a flag changes, so two adjacent italic (or bold) runs no longer come back from `markdownToRuns` as bold (or plain).
- The text edit overlay keeps a run's screen-pixel `fontSize` and `letterSpacing` (`{ px }`): it showed the run at the node's size and dropped the override on commit.
