---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`: changing a pref's kind no longer carries an attribute across when the new kind's attribute of the same name does not offer its value. A number drawn as a `slider` became a boolean still holding `control: 'slider'`, exported that way, and the notice did not list it. It is now dropped and named in the notice.
