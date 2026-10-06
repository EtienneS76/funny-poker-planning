import Account from '../features/auth/Account'
import type { AccountState } from '../features/auth/useAccount'

export default function Topbar({ account }: { account: AccountState }) {
  return (
    <header className='pp-topbar'>
      <a className='pp-brand' href='/'>Poker Multivers</a>
      <Account account={account} />
      {(account.error || account.configured === false) && (
        <p className='pp-auth-feedback' role={account.error ? 'alert' : 'status'}>
          {account.error ?? 'Connexion GitHub non configurée.'}
        </p>
      )}
    </header>
  )
}