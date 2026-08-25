# Preserve Branch Cursors When Editing Collection Sources

When a collection source's branch configuration is edited, preserve each existing branch's sync cursor only when its exact name remains in the configuration. Removing a branch or renaming it creates a new branch configuration with no cursor; an empty configuration means the repository default branch. This prevents an unrelated form edit from triggering a full rescan while avoiding reuse of a cursor for a different branch.
