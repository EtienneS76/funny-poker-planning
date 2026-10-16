import Account from '../features/auth/Account'
import type { AccountState } from '../features/auth/useAccount'
import { UserRoundPlus } from 'lucide-react'
import { Link } from 'react-router'

type Props = {
  account: AccountState
  onInvitePlayers?: () => void
}

export default function Topbar({ account, onInvitePlayers }: Props) {
  return (
    <header className='pp-topbar'>
      <Link className='pp-brand' to='/'>
        Multivers Poker Planning
      </Link>
      <div className='pp-topbar-actions'>
        {onInvitePlayers && (
          <button
            className='pp-button pp-button--invite'
            type='button'
            onClick={onInvitePlayers}
          >
            <UserRoundPlus size={17} aria-hidden='true' />
            Inviter des participants
          </button>
        )}
        <Account account={account} />
      </div>
      {(account.error || account.configured === false) && (
        <p
          className='pp-auth-feedback'
          role={account.error ? 'alert' : 'status'}
        >
          {account.error ?? 'Connexion GitHub non configurée.'}
        </p>
      )}
    </header>
  )
}
