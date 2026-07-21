# Add Project Scope to Collection Sources

Added `projectScope` field to `collect_sources` table to distinguish work vs personal projects, enabling filtered weekly report views for leadership vs personal audiences. Filter at database query level for efficiency; manual events bypass filter.

**Status**: accepted

**Considered Options**:
- Field location: `collectSources` (chosen) vs `rawEvents` vs tag system
- Field name: `projectScope` (chosen) vs `visibility` vs `reportType`
- Required/optional: required with `personal` default (chosen) vs optional
- Filter location: database query (chosen) vs template render vs ViewConfig extension
- Manual events: always show in both views (chosen) vs classify vs per-template config
- Editable: yes with historical reclassification (chosen) vs immutable

**Consequences**:
- Migration needed to set `projectScope` on existing sources (default: `personal`)
- Bulk update feature should be added to manage project scope efficiently
- Historical events reclassify when source's `projectScope` changes
- Leadership reports show only work projects; personal reports show all
- Manual events (no `sourceId`) always visible in both views