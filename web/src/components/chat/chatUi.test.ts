import { describe, expect, it } from 'vitest'
import { conditional, openQuestions, questionOf, sentences } from './chatUi'

const msg = (id: string, role: 'user' | 'assistant', suggestions: string[] = []) => ({ id, role, text: 'x', suggestions, recommendedIndex: null, ts: 0 })

describe('chat chunking', () => {
  it('splits sentences and finds the question', () => {
    const t = 'Got it. Your exam matters most.\n- Sleep is key. Which one wins?'
    expect(sentences(t)).toEqual(['Got it.', 'Your exam matters most.', 'Sleep is key.', 'Which one wins?'])
    expect(questionOf(t)).toBe('Which one wins?')
  })
  it('detects conditional chips', () => {
    expect(conditional('If you value the grade, skip the hackathon.')).toEqual({ when: 'the grade', then: 'skip the hackathon' })
    expect(conditional('If sleep matters → leave early.')).toEqual({ when: 'sleep matters', then: 'leave early' })
    expect(conditional('This is plain.')).toBeNull()
  })
  it('queues only unanswered, unskipped questions', () => {
    const chat = [msg('u1', 'user'), msg('a1', 'assistant', ['A']), msg('a2', 'assistant', ['B'])]
    expect(openQuestions(chat, null, []).map((m) => m.id)).toEqual(['a1', 'a2'])
    expect(openQuestions(chat, null, ['a1']).map((m) => m.id)).toEqual(['a2'])
    expect(openQuestions(chat, { text: 'x', users: 1, assistants: 2, at: 0 }, [])).toEqual([])
    expect(openQuestions([...chat, msg('u2', 'user')], null, [])).toEqual([])
  })
})
