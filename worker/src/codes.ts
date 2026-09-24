// Pairing codes: short enough to type with a TV remote or phone, and free of look-alike
// characters (no I/1, O/0). 32^6 ≈ 1 billion codes.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6
const CODE = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`)

export function generateCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  // 256 is a multiple of 32, so the modulo introduces no bias.
  return Array.from(random(CODE_LENGTH), (b) => ALPHABET[b % ALPHABET.length]).join('')
}

/** Uppercases and validates user input; returns null if it can't be a code. */
export function normalizeCode(input: string): string | null {
  const code = input.trim().toUpperCase()
  return CODE.test(code) ? code : null
}
