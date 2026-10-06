import { createClient, type GenericCtx } from '@convex-dev/better-auth'
import { convex, crossDomain } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth/minimal'
import { v } from 'convex/values'
import { components } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import { query } from './_generated/server'
import authConfig from './auth.config'

export const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = process.env.SITE_URL ?? 'http://127.0.0.1:5173'

  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    account: { encryptOAuthTokens: true },
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID ?? '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
        overrideUserInfoOnSignIn: true,
        mapProfileToUser: (profile) => ({
          name: profile.login,
          image: profile.avatar_url,
        }),
      },
    },
    plugins: [crossDomain({ siteUrl }), convex({ authConfig })],
  })
}

export const isConfigured = query({
  args: {},
  returns: v.boolean(),
  handler: () =>
    Boolean(
      process.env.SITE_URL &&
      process.env.BETTER_AUTH_SECRET &&
      process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET,
    ),
})

export const currentUser = query({
  args: {},
  returns: v.object({
    username: v.string(),
    avatarUrl: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx)
    return {
      username: user.name,
      avatarUrl: user.image ?? null,
    }
  },
})
