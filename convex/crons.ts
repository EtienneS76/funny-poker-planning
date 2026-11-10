import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval(
  'remove inactive refinement rooms',
  { minutes: 1 },
  internal.refinement.mutations.cleanupInactiveRooms,
  {},
)

crons.interval(
  'remove stale among us positions',
  { minutes: 1 },
  internal.amongUs.mutations.cleanupStale,
  {},
)

crons.interval(
  'remove old archery arrows',
  { minutes: 5 },
  internal.archery.mutations.cleanup,
  {},
)

export default crons