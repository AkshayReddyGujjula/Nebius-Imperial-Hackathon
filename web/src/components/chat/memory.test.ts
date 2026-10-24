import { describe, expect, it } from 'vitest'
import { countFacts, isChanged, parseMemory } from './memory'

describe('parseMemory', () => {
  it('splits headings, bullets and text, dropping the title', () => {
    const lines = parseMemory('# user.md\n\n## Situation\n- Exam is worth 40%\n* 70% prepared\nLikes hackathons')
    expect(lines).toEqual([
      { kind: 'heading', text: 'Situation' },
      { kind: 'bullet', text: 'Exam is worth 40%' },
      { kind: 'bullet', text: '70% prepared' },
      { kind: 'text', text: 'Likes hackathons' },
    ])
    expect(countFacts(lines)).toBe(3)
  })

  it('matches changed lines loosely', () => {
    expect(isChanged('Exam is worth 40%', ['- exam is worth 40%'])).toBe(true)
    expect(isChanged('Exam is worth 40%', ['Sleeps 8 hours'])).toBe(false)
    expect(isChanged('Anything', [''])).toBe(false)
  })
})
