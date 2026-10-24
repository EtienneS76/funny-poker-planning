/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth_auth from "../auth/auth.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as refinement_mutations from "../refinement/mutations.js";
import type * as refinement_queries from "../refinement/queries.js";
import type * as refinement_reactionSchema from "../refinement/reactionSchema.js";
import type * as refinement_roundSchema from "../refinement/roundSchema.js";
import type * as refinement_slug from "../refinement/slug.js";
import type * as refinement_voteSchema from "../refinement/voteSchema.js";
import type * as user_avatarFrames from "../user/avatarFrames.js";
import type * as user_consumables from "../user/consumables.js";
import type * as user_mutations from "../user/mutations.js";
import type * as user_pokemonDraw from "../user/pokemonDraw.js";
import type * as user_profile from "../user/profile.js";
import type * as user_queries from "../user/queries.js";
import type * as user_starWarsCharacterIds from "../user/starWarsCharacterIds.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "auth/auth": typeof auth_auth;
  crons: typeof crons;
  http: typeof http;
  "refinement/mutations": typeof refinement_mutations;
  "refinement/queries": typeof refinement_queries;
  "refinement/reactionSchema": typeof refinement_reactionSchema;
  "refinement/roundSchema": typeof refinement_roundSchema;
  "refinement/slug": typeof refinement_slug;
  "refinement/voteSchema": typeof refinement_voteSchema;
  "user/avatarFrames": typeof user_avatarFrames;
  "user/consumables": typeof user_consumables;
  "user/mutations": typeof user_mutations;
  "user/pokemonDraw": typeof user_pokemonDraw;
  "user/profile": typeof user_profile;
  "user/queries": typeof user_queries;
  "user/starWarsCharacterIds": typeof user_starWarsCharacterIds;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
