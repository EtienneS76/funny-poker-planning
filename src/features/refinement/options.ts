export const universes = [
  { id: 'hp', label: 'Harry Potter' },
  { id: 'pk', label: 'Pokémon' },
  { id: 'sw', label: 'Star Wars' },
  { id: 'lr', label: 'Seigneur des Anneaux' },
] as const

export const sizings = [
  { id: 'fib', label: 'Fibonacci', cards: ['1', '2', '3', '5', '8', '13', '21'] },
  { id: 'tee', label: 'T-shirts', cards: ['XS', 'S', 'M', 'L', 'XL'] },
  { id: 'pow', label: 'Puissances de 2', cards: ['1', '2', '4', '8', '16', '32'] },
] as const

export type RefinementDraft = {
  name: string
  universe: typeof universes[number]['id']
  sizing: typeof sizings[number]['id']
  issueUrl: string | null
}

export function parseIssueUrl(value: string) {
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`)
    const match = url.pathname.match(/^\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9_.-]+)\/issues\/([1-9][0-9]*)\/?$/)
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || !match) return null
    return { url: `https://github.com/${match[1]}/${match[2]}/issues/${match[3]}`, label: `${match[1]}/${match[2]} · #${match[3]}` }
  } catch {
    return null
  }
}