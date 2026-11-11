---
"@weasel-js/plot": patch
---

A gantt edit on a task whose id another task holds too keeps the dependencies on that id, as the schedule reads them: on the first task holding it. Taking out either task, or clearing its id, dropped every `after` and `until` naming the id though a task still held it, and renaming the second one moved them onto it from the first.
