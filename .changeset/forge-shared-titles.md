---
"@weasel-js/forge": patch
---

Several story files can share one title. The file named for the title's last segment (`Bar.stories.tsx` for `ui/Bar`) speaks for the component: its stories list first in the tree, the Components list and the index page, and its meta's description is the component's. Each file's own meta still applies to its own stories.
