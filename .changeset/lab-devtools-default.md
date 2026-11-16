---
'@weasel-js/labkit': minor
---

Every canvas in a `<Lab>` registers with the devtools hook in a development build, and `devtools={false}` turns that off.

`devtools={true}` keeps it in a production build too. Left out, a `devtools` entry provided above the lab decides, so `devtoolsOff` from `@weasel-js/devtools/mount` turns it off for every lab under it. A production bundle never loads the hook unless asked.

<!-- entry: rank=8 new api behavior -->
