// Sans caractères ambigus (0/o, 1/l/i) pour qu'un lien reste lisible et dictable
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // 31 caractères
const SLUG_LENGTH = 7
const MAX_ATTEMPTS = 5

// Plus grand multiple de 31 inférieur à 256 : les octets au-dessus sont rejetés
// pour que chaque caractère ait exactement la même probabilité (pas de biais du modulo)
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length)

export function generateSlug(length = SLUG_LENGTH): string {
  let slug = ''
  while (slug.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2))
    for (const byte of bytes) {
      if (byte >= UNBIASED_LIMIT) continue
      slug += ALPHABET[byte % ALPHABET.length]
      if (slug.length === length) break
    }
  }
  return slug
}

// Génère un slug et vérifie son unicité via `exists` (à brancher sur l'index by_slug)
export async function generateUniqueSlug(
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const slug = generateSlug()
    if (!(await exists(slug))) return slug
  }
  throw new Error('Impossible de générer un slug unique, réessaie.')
}
