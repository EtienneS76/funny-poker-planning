import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval(
  'remove inactive refinement rooms',
  { minutes: 1 },
  internal.refinement.mutations.cleanupInactiveRooms,
  {},
)

export default crons