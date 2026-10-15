import Account from '../features/auth/Account'
import type { AccountState } from '../features/auth/useAccount'
import { Link } from 'react-router'

export default function Topbar({ account }: { account: AccountState }) {
  return (
    <header className='pp-topbar'>
      <Link className='pp-brand' to='/'>
        Multivers Poker Planning
      </Link>
      <Account account={account} />
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
