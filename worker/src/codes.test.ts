import { describe, expect, it } from 'vitest'
import { CODE_LENGTH, generateCode, normalizeCode } from './codes'

describe('generateCode', () => {
  it('produces valid codes', () => {
    for (let i = 0; i < 200; i++) expect(normalizeCode(generateCode())).not.toBeNull()
  })

  it('maps bytes onto the alphabet', () => {
    expect(generateCode(() => new Uint8Array([0, 1, 31, 32, 255, 8]))).toBe('AB9A9J')
  })
})

describe('normalizeCode', () => {
  it('accepts lowercase and surrounding space', () => {
    expect(normalizeCode('  abc234 ')).toBe('ABC234')
  })

  it('rejects look-alike characters, wrong lengths and junk', () => {
    for (const bad of ['ABC23O', 'ABC231', 'ABCDE', 'ABCDEFG', '', 'AB-234']) expect(normalizeCode(bad)).toBeNull()
    expect(CODE_LENGTH).toBe(6)
  })
})
