export function fmtTokens(tokens: number): string {
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : String(tokens)
}

export function fmtUsd(usd: number): string {
  return usd < 0.001 ? '<$0.001' : `$${usd.toFixed(3)}`
}

export function fmtMs(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} m ${seconds % 60} s`
}

export function fmtClock(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export const optionLetter = (i: number): string => String.fromCharCode(65 + i)
export const pct = (value: number): string => `${Math.round(value * 100)}%`
