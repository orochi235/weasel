---
'@weasel-js/forge': patch
---

`forgeTest` now points vite's dependency scan at the story files, the frame config and forge's own test runtime, as the workshop plugin already did. The imports it appends to each story file are invisible to the scan, so on a cold cache vite discovered `react-dom/client` mid-run, re-optimized and reloaded the test page, and every story in the first file failed with "Invalid hook call".
