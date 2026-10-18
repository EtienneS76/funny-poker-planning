import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const presenceTable = defineTable({
  participantId: v.id('participants'),
  lastSeenAt: v.number(),
  guestName: v.optional(v.string()),
})
  .index('by_participant', ['participantId'])
  .index('by_last_seen', ['lastSeenAt'])