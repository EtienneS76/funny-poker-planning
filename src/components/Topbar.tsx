import { useState } from 'react'
import { useQuery } from 'convex/react'
import Account from '../features/auth/Account'
import type { AccountState } from '../features/auth/useAccount'
import { Bug, Store, UserRoundPlus } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '../../convex/_generated/api'
import ModalShop from './ModalShop'

type Props = {
  account: AccountState
  onInvitePlayers?: () => void
}

export default function Topbar({ account, onInvitePlayers }: Props) {
  const [shopOpen, setShopOpen] = useState(false)
  const shopData = useQuery(api.user.queries.shopData, {})

  return (
    <header className='pp-topbar'>
      <Link className='pp-brand' to='/'>
        Funny Poker Planning
      </Link>
      {onInvitePlayers && (
        <button
          className='pp-button pp-button--invite pp-topbar-invite'
          type='button'
          onClick={onInvitePlayers}
        >
          <UserRoundPlus size={17} aria-hidden='true' /> Inviter à participer
        </button>
      )}
      <div className='pp-topbar-actions'>
        <button
          className='pp-button pp-button--secondary pp-button--shop-nav'
          type='button'
          onClick={() => setShopOpen(true)}
        >
          <Store size={17} aria-hidden='true' /> Boutique
        </button>
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
      {shopOpen && (
        <ModalShop
          balance={shopData?.balance ?? 0}
          catalog={shopData?.catalog ?? []}
          ownedIds={shopData?.ownedIds ?? []}
          isAuthenticated={account.isAuthenticated}
          canSignIn={
            account.configured === true && !account.loading && !account.pending
          }
          onSignIn={() => void account.signIn()}
          onClose={() => setShopOpen(false)}
        />
      )}
      <a
        className='pp-report-bug'
        href='https://github.com/EtienneS76/funny-poker-planning/issues/new'
        target='_blank'
        rel='noopener noreferrer'
      >
        <Bug size={17} aria-hidden='true' /> Signaler un bug
      </a>
    </header>
  )
}
