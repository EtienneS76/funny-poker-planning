import { useAccount } from '../auth/useAccount'

export function RefinementRoom() {
  const connectedUser = useAccount().user
  return (
    <p>
      Refinement Room{' '}
      {connectedUser
        ? `- Connected as ${connectedUser.username}`
        : '- Not connected'}
    </p>
  )
}
