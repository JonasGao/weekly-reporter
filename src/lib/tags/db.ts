import { and, asc, count, eq, inArray } from 'drizzle-orm'
import { eventTags, rawEvents } from '@/lib/db/schema'
import { removeTagFromContent, renameTagInContent } from './parse'

type DrizzleDb = ReturnType<typeof import('@/lib/db').getDb>

// The tx inside db.transaction() shares the query-builder interface of db but
// is a distinct type (SQLiteTransaction). Use a structural type so callers can
// pass either db or tx.
type QueryRunner = Pick<DrizzleDb, 'select' | 'insert' | 'update' | 'delete'>

export function syncEventTags(
  tx: QueryRunner,
  eventId: number,
  tagNames: string[],
): void {
  tx.delete(eventTags).where(eq(eventTags.eventId, eventId)).run()
  if (tagNames.length === 0) return
  const now = new Date()
  tx.insert(eventTags)
    .values(tagNames.map((tagName) => ({ eventId, tagName, createdAt: now })))
    .run()
}

export function removeTagGlobally(db: DrizzleDb, tagName: string): number {
  return db.transaction((tx) => {
    const affected = tx
      .select({ eventId: eventTags.eventId })
      .from(eventTags)
      .where(eq(eventTags.tagName, tagName))
      .all()

    if (affected.length === 0) return 0

    const eventIds = affected.map((r) => r.eventId)
    const events = tx
      .select({ id: rawEvents.id, content: rawEvents.content })
      .from(rawEvents)
      .where(inArray(rawEvents.id, eventIds))
      .all()

    for (const event of events) {
      const updated = removeTagFromContent(event.content, tagName)
      if (updated !== event.content) {
        tx.update(rawEvents).set({ content: updated }).where(eq(rawEvents.id, event.id)).run()
      }
    }

    tx.delete(eventTags).where(eq(eventTags.tagName, tagName)).run()

    return events.length
  })
}

export function renameTagGlobally(
  db: DrizzleDb,
  oldName: string,
  newName: string,
): { eventsUpdated: number; merged: boolean } {
  return db.transaction((tx) => {
    // Events already tagged with newName — the "merge set".
    const mergeRows = tx
      .select({ eventId: eventTags.eventId })
      .from(eventTags)
      .where(eq(eventTags.tagName, newName))
      .all()
    const mergeSet = new Set(mergeRows.map((r) => r.eventId))

    // All events currently tagged with oldName.
    const oldRows = tx
      .select({ eventId: eventTags.eventId })
      .from(eventTags)
      .where(eq(eventTags.tagName, oldName))
      .all()
    const oldIds = oldRows.map((r) => r.eventId)

    if (oldIds.length === 0) {
      return { eventsUpdated: 0, merged: false }
    }

    // For events in the merge set, drop the old-name row (the new-name row already exists).
    const overlapIds = oldIds.filter((id) => mergeSet.has(id))
    if (overlapIds.length > 0) {
      tx.delete(eventTags)
        .where(and(inArray(eventTags.eventId, overlapIds), eq(eventTags.tagName, oldName)))
        .run()
    }

    // Rename remaining old-name rows.
    const renameIds = oldIds.filter((id) => !mergeSet.has(id))
    if (renameIds.length > 0) {
      tx.update(eventTags)
        .set({ tagName: newName })
        .where(and(inArray(eventTags.eventId, renameIds), eq(eventTags.tagName, oldName)))
        .run()
    }

    // Rewrite content for every event that had the old tag.
    const events = tx
      .select({ id: rawEvents.id, content: rawEvents.content })
      .from(rawEvents)
      .where(inArray(rawEvents.id, oldIds))
      .all()

    for (const event of events) {
      const updated = renameTagInContent(event.content, oldName, newName)
      if (updated !== event.content) {
        tx.update(rawEvents).set({ content: updated }).where(eq(rawEvents.id, event.id)).run()
      }
    }

    return { eventsUpdated: events.length, merged: overlapIds.length > 0 }
  })
}

export function listTagsWithCounts(db: DrizzleDb): { name: string; count: number }[] {
  return db
    .select({ name: eventTags.tagName, count: count() })
    .from(eventTags)
    .groupBy(eventTags.tagName)
    .orderBy(asc(eventTags.tagName))
    .all()
}
