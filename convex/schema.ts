import { defineSchema } from 'convex/server'
import { refinementTable } from './refinement/schema'
import { participantTable } from './participant/schema'
import {
  pokisouWalletTable,
  userAvatarFramesTable,
  userTable,
} from './user/schema'
import {
  statisticsTable,
  userRoundParticipationTable,
} from './statistics/schema'
import { presenceTable } from './presence/schema'
import { voteTable } from './refinement/voteSchema'
import { refinementRoundTable } from './refinement/roundSchema'
import { reactionTable } from './refinement/reactionSchema'

export default defineSchema({
  refinements: refinementTable,
  participants: participantTable,
  users: userTable,
  pokisouWallets: pokisouWalletTable,
  userAvatarFrames: userAvatarFramesTable,
  statistics: statisticsTable,
  userRoundParticipations: userRoundParticipationTable,
  presences: presenceTable,
  votes: voteTable,
  refinementRounds: refinementRoundTable,
  roomReactions: reactionTable,
})
