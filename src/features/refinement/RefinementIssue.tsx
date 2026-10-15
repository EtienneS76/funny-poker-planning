import { useEffect, useState } from 'react'
import { ArrowUpRight, CircleDot, CircleCheck } from 'lucide-react'
import { parseIssueUrl } from './options'

type IssuePreview = {
  url: string
  title: string | null
  state: 'open' | 'closed' | null
  loading: boolean
}

export function RefinementIssue({ url }: { url: string | null }) {
  const issue = url ? parseIssueUrl(url) : null
  const issueUrl = issue?.url
  const [preview, setPreview] = useState<IssuePreview | null>(null)

  useEffect(() => {
    if (!issueUrl) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    let active = true

    async function loadPreview() {
      try {
        const path = new URL(issueUrl!).pathname
        const response = await fetch(`https://api.github.com/repos${path}`, {
          headers: { Accept: 'application/vnd.github+json' },
          signal: controller.signal,
          credentials: 'omit',
        })
        if (!response.ok) throw new Error('Issue unavailable')
        const data: unknown = await response.json()
        if (
          !data ||
          typeof data !== 'object' ||
          !('title' in data) ||
          typeof data.title !== 'string'
        ) {
          throw new Error('Invalid issue response')
        }
        if (active)
          setPreview({
            url: issueUrl!,
            title: data.title,
            state:
              'state' in data &&
              (data.state === 'open' || data.state === 'closed')
                ? data.state
                : null,
            loading: false,
          })
      } catch {
        if (active)
          setPreview({
            url: issueUrl!,
            title: null,
            state: null,
            loading: false,
          })
      } finally {
        window.clearTimeout(timeout)
      }
    }

    void loadPreview()
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [issueUrl])

  if (!issue) return null
  const current = preview?.url === issue.url ? preview : null
  const loading = !current
  const closed = current?.state === 'closed'
  const IssueIcon = closed ? CircleCheck : CircleDot

  return (
    <aside className='room-issue' aria-label='Issue liée'>
      <IssueIcon
        className={`room-issue-icon${closed ? ' room-issue-icon--closed' : ''}`}
        size={22}
        aria-hidden='true'
      />
      <div className='room-issue-content'>
        <div className='room-issue-meta'>
          <span>Issue liée</span>
          {current?.state && (
            <span className='room-issue-state'>
              {closed ? 'Fermée' : 'Ouverte'}
            </span>
          )}
        </div>
        <a
          href={issue.url}
          target='_blank'
          rel='noopener noreferrer'
          className='room-issue-link'
        >
          <span>{current?.title ?? issue.label}</span>
          <ArrowUpRight size={18} aria-hidden='true' />
        </a>
        {(loading || current?.title) && (
          <p className='room-issue-detail' aria-live='polite'>
            {loading ? 'Chargement du titre…' : issue.label}
          </p>
        )}
      </div>
    </aside>
  )
}
