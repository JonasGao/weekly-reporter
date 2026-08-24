# Separate Manual Fetch from Source Sync

Manual Fetch for local Git sources runs `git fetch origin` to refresh remote refs only. It does not collect events, update sync cursors or sync status, and remains separate from the existing source sync flow (which continues to perform its current pull behavior) so repository maintenance cannot be mistaken for event collection.

## Consequences

- Fetch is available without author email configuration and does not change source availability.
- Fetch and sync operations for one source are serialized in the application process; a busy source returns a conflict response.
- Remote selection and pruning are intentionally out of scope; `origin` and its default refspec are used.
