---
'@weasel-js/forge': patch
---

`runAxe` and the workshop's Accessibility panel: an audit started while another was still running failed with "axe could not run: Axe is already running", which happened whenever the focus moved to a second story, or a story reloaded, before the first audit finished. Audits in one document now run one after another, and Re-check stays disabled until every audit the panel started has answered.
