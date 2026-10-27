import { defineSchema } from 'convex/server'
import { refinementTable } from './refinement/schema'
import { participantTable } from './participant/schema'
import {
  pokisouWalletTable,
  userAvatarFramesTable,
  userCardDesignsTable,
  userPokemonsTable,
  userStarWarsCharactersTable,
  starterPokemonOpeningTable,
  pokemonEncounterTable,
  consumableCatalogTable,
  userConsumablesTable,
  userTable,
} from './user/schema'
import {
  statisticsTable,
  userRoundParticipationTable,
  skirmishProgressTable,
} from './statistics/schema'
import { presenceTable } from './presence/schema'
import { voteTable } from './refinement/voteSchema'
import { refinementRoundTable } from './refinement/roundSchema'
import { reactionTable } from './refinement/reactionSchema'
import { amongUsPlayerTable } from './amongUs/schema'

export default defineSchema({
  refinements: refinementTable,
  participants: participantTable,
  users: userTable,
  pokisouWallets: pokisouWalletTable,
  userAvatarFrames: userAvatarFramesTable,
  userCardDesigns: userCardDesignsTable,
  userPokemons: userPokemonsTable,
  userStarWarsCharacters: userStarWarsCharactersTable,
  starterPokemonOpenings: starterPokemonOpeningTable,
  pokemonEncounters: pokemonEncounterTable,
  consumableCatalog: consumableCatalogTable,
  userConsumables: userConsumablesTable,
  statistics: statisticsTable,
  userRoundParticipations: userRoundParticipationTable,
  skirmishProgress: skirmishProgressTable,
  presences: presenceTable,
  votes: voteTable,
  refinementRounds: refinementRoundTable,
  roomReactions: reactionTable,
  amongUsPlayers: amongUsPlayerTable,
})
