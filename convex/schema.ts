import { defineSchema } from 'convex/server'
import { refinementTable } from './refinement/schema'
import { participantTable } from './participant/schema'

export default defineSchema({
  refinements: refinementTable,
  participants: participantTable,
})
