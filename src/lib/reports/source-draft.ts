import type {
  AudienceVariant,
  ProjectScope,
  RawEvent,
  RawEventMetadata,
  ReportEventSnapshot,
} from '@/lib/db/schema'
import { getOriginGroup, ORIGIN_GROUP_RANK, type OriginGroup } from '@/lib/template/origin-group'

const GIT_SOURCES = new Set([
  'git-local',
  'github',
  'gitlab',
  'git-remote-github',
  'git-remote-gitlab',
  'git-remote-gitee',
])

export interface DraftEvent {
  id?: number
  eventTime: Date
  source: string
  content: string
  metadata?: RawEventMetadata
  projectScope?: ProjectScope | null
  leadershipIncluded?: boolean
  personalIncluded?: boolean
}

function isGitEvent(event: DraftEvent): boolean {
  return GIT_SOURCES.has(event.source) || event.source.startsWith('git-')
}

function getSnapshotOriginGroup(event: DraftEvent): OriginGroup {
  if (event.metadata?.sourceId == null) return 'manual'
  if (event.projectScope === 'work') return 'work'
  if (event.projectScope === 'personal') return 'personal'
  return 'other'
}

function toDraftEvents(events: Array<RawEvent | ReportEventSnapshot>, sourceScopes?: ReadonlyMap<number, ProjectScope>): DraftEvent[] {
  return events.map((event) => {
    const raw = event as RawEvent & Partial<ReportEventSnapshot>
    const isSnapshot = 'leadershipIncluded' in raw || 'personalIncluded' in raw
    const scope = isSnapshot
      ? raw.projectScope
      : raw.metadata?.sourceId != null
        ? sourceScopes?.get(raw.metadata.sourceId) ?? null
        : null
    const leadershipIncluded = isSnapshot
      ? raw.leadershipIncluded
      : raw.metadata?.sourceId == null || scope === 'work'
    const personalIncluded = isSnapshot ? raw.personalIncluded : true

    return {
      id: raw.id,
      eventTime: new Date(raw.eventTime),
      source: raw.source,
      content: raw.content,
      metadata: raw.metadata ?? undefined,
      projectScope: scope,
      leadershipIncluded,
      personalIncluded,
    }
  })
}

function isIncluded(event: DraftEvent, variant: AudienceVariant): boolean {
  if (variant === 'personal') return event.personalIncluded !== false
  return event.leadershipIncluded === true
}

/**
 * Build the deterministic source draft. It deliberately contains no template
 * placeholders or semantic sections; those are responsibilities of AI final
 * generation. The format preserves the existing origin/repository/time order.
 */
export function buildSourceDraft(
  events: Array<RawEvent | ReportEventSnapshot>,
  variant: AudienceVariant,
  sourceScopes?: ReadonlyMap<number, ProjectScope>,
): string {
  const draftEvents = toDraftEvents(events, sourceScopes).filter((event) => isIncluded(event, variant))

  if (draftEvents.length === 0) {
    return '- 本周暂无事件'
  }

  const gitEvents = draftEvents.filter((event) => isGitEvent(event) && event.metadata?.repo)
  const nonGitEvents = draftEvents.filter((event) => !isGitEvent(event) || !event.metadata?.repo)
  const repoGroups = new Map<string, DraftEvent[]>()

  for (const event of gitEvents) {
    const repo = event.metadata?.repo as string
    const group = repoGroups.get(repo) ?? []
    group.push(event)
    repoGroups.set(repo, group)
  }

  for (const group of repoGroups.values()) {
    group.sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime())
  }

  type TopLevelItem = {
    rank: number
    time: number
    repo?: string
    events?: DraftEvent[]
    event?: DraftEvent
  }

  const items: TopLevelItem[] = []
  for (const [repo, group] of repoGroups) {
    items.push({
      rank: Math.min(...group.map((event) => ORIGIN_GROUP_RANK[getSnapshotOriginGroup(event)])),
      time: Math.max(...group.map((event) => event.eventTime.getTime())),
      repo,
      events: group,
    })
  }

  for (const event of nonGitEvents) {
    items.push({
      rank: ORIGIN_GROUP_RANK[getSnapshotOriginGroup(event)],
      time: event.eventTime.getTime(),
      event,
    })
  }

  items.sort((a, b) => a.rank - b.rank || b.time - a.time)

  const lines: string[] = []
  for (const item of items) {
    if (item.repo && item.events) {
      lines.push(`- **${item.repo}**`)
      for (const event of item.events) {
        lines.push(`  - ${event.content}`)
      }
    } else if (item.event) {
      lines.push(`- ${item.event.content}`)
    }
  }

  return lines.length > 0 ? lines.join('\n') : '- 本周暂无事件'
}

export function classifyEventForVariants(
  event: RawEvent,
  sourceScopes: ReadonlyMap<number, ProjectScope>,
) {
  const originGroup = getOriginGroup(event, sourceScopes)
  return {
    originGroup,
    projectScope: originGroup === 'work' || originGroup === 'personal' ? originGroup : null,
    leadershipIncluded: originGroup === 'manual' || originGroup === 'work',
    personalIncluded: true,
  }
}
