import { createAuthClient } from 'better-auth/react'
import {
  convexClient,
  crossDomainClient,
} from '@convex-dev/better-auth/client/plugins'

function getAuthFlowEndpoint(url: string | URL) {
  const path = new URL(String(url), window.location.origin).pathname

  if (path.endsWith('/cross-domain/one-time-token/verify')) return 'callback verification'
  if (path.endsWith('/get-session')) return 'session lookup'
  if (path.endsWith('/convex/token')) return 'Convex token'
  return null
}

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
  fetchOptions: {
    onSuccess({ request, response, data }) {
      if (!import.meta.env.DEV) return
      const endpoint = getAuthFlowEndpoint(request.url)
      if (!endpoint) return

      const result = { status: response.status }
      if (endpoint === 'callback verification' || endpoint === 'session lookup') {
        Object.assign(result, { sessionReturned: Boolean(data?.session) })
      }
      if (endpoint === 'Convex token') {
        Object.assign(result, { tokenReturned: Boolean(data?.token) })
      }

      console.info(`[auth] ${endpoint} succeeded`, result)
    },
    onError({ request, error }) {
      if (!import.meta.env.DEV) return
      const endpoint = getAuthFlowEndpoint(request.url)
      if (!endpoint) return

      console.error(`[auth] ${endpoint} failed`, {
        status: error.status,
        message: error.message,
      })
    },
  },
  plugins: [convexClient(), crossDomainClient()],
})
