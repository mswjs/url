export interface MatchResult {
  matches: boolean
  params: MatchPatternParams
}

export type MatchPatternInput = string | URL
export type MatchPatternParams = Record<string, string | Array<string>>

const AMPERSAND = 42
const SLASH = 47
const COLON = 58
const QUESTION_MARK = 63
const PLUS = 43
const BACKSLASH = 92
const UNDERSCORE = 95

const enum TokenType {
  Literal,
  Wildcard,
  Param,
}

type Token =
  | { type: TokenType.Literal; value: string }
  | { type: TokenType.Wildcard; nextLiteral: string | undefined }
  | {
      type: TokenType.Param
      name: string
      modifier: '' | '?' | '+' | '*'
      nextLiteral: string | undefined
    }

const PATTERN_CACHE_LIMIT = 1000
const PATTERN_CACHE = new Map<string, ParsedPattern>()
const NO_MATCH: MatchResult = Object.freeze({
  matches: false,
  params: Object.freeze(Object.create(null)),
} satisfies MatchResult)

function isIdentStartCode(code: number): boolean {
  return (
    (code >= 97 && code <= 122) ||
    (code >= 65 && code <= 90) ||
    code === UNDERSCORE
  )
}

function isIdentCharCode(code: number): boolean {
  return isIdentStartCode(code) || (code >= 48 && code <= 57)
}

interface ParsedPattern {
  tokens: Array<Token>
  isLiteralOnly: boolean
}

function parsePatternOrGetFromCache(pattern: string): ParsedPattern {
  let parsed = PATTERN_CACHE.get(pattern)

  if (parsed === undefined) {
    const tokens = parsePattern(pattern)
    let isLiteralOnly = pattern.indexOf('\\') === -1

    for (let i = 0; isLiteralOnly && i < tokens.length; i++) {
      if (tokens[i].type !== TokenType.Literal) {
        isLiteralOnly = false
      }
    }

    if (PATTERN_CACHE.size >= PATTERN_CACHE_LIMIT) {
      PATTERN_CACHE.delete(PATTERN_CACHE.keys().next().value!)
    }

    parsed = { tokens, isLiteralOnly }
    PATTERN_CACHE.set(pattern, parsed)
  }

  return parsed
}

function parsePattern(pattern: string): Array<Token> {
  const tokens: Array<Token> = []
  let i = 0
  const length = pattern.length

  while (i < length) {
    const code = pattern.charCodeAt(i)

    if (code === BACKSLASH && i + 1 < length) {
      // Escaped character — consume the backslash and the next character
      // as a literal. Fall through to the literal branch below by not
      // advancing `i` here (the literal branch handles it).
    } else if (code === AMPERSAND) {
      tokens.push({
        type: TokenType.Wildcard,
        nextLiteral: undefined,
      })
      i++
      continue
    } else if (
      code === COLON &&
      i + 1 < length &&
      isIdentStartCode(pattern.charCodeAt(i + 1))
    ) {
      const start = ++i

      while (i < length && isIdentCharCode(pattern.charCodeAt(i))) {
        i++
      }

      const name = pattern.slice(start, i)
      let modifier: '' | '?' | '+' | '*' = ''

      if (i < length) {
        const mod = pattern.charCodeAt(i)

        if (mod === QUESTION_MARK || mod === PLUS || mod === AMPERSAND) {
          modifier = pattern[i] as '?' | '+' | '*'
          i++
        }
      }

      tokens.push({
        type: TokenType.Param,
        name,
        modifier,
        nextLiteral: undefined,
      })
      continue
    }

    // Literal characters. When backslashes are present, we build the
    // value character by character to strip them. Otherwise, use a
    // fast slice.
    let hasEscape = false
    const start = i

    while (i < length) {
      const charCode = pattern.charCodeAt(i)

      if (charCode === BACKSLASH && i + 1 < length) {
        hasEscape = true
        i += 2
        continue
      }

      if (charCode === AMPERSAND) {
        break
      }

      if (
        charCode === COLON &&
        i + 1 < length &&
        isIdentStartCode(pattern.charCodeAt(i + 1))
      ) {
        break
      }

      i++
    }

    if (hasEscape) {
      let value = ''
      for (let j = start; j < i; j++) {
        if (
          pattern.charCodeAt(j) === BACKSLASH &&
          j + 1 < i
        ) {
          j++
        }
        value += pattern[j]
      }
      tokens.push({ type: TokenType.Literal, value })
    } else {
      tokens.push({
        type: TokenType.Literal,
        value: pattern.slice(start, i),
      })
    }
  }

  // Precompute nextLiteral for each wildcard/param in a single backward pass
  // so the matching loop doesn't need to scan forward through tokens.
  let lastLiteral: string | undefined

  for (let j = tokens.length - 1; j >= 0; j--) {
    const token = tokens[j]

    if (token.type === TokenType.Literal) {
      lastLiteral = token.value
    } else {
      token.nextLiteral = lastLiteral
    }
  }

  return tokens
}

function matchTokens(inputString: string, tokens: Array<Token>): MatchResult {
  const inputLength = inputString.length

  let position = 0
  let wildcardIndex = 0
  const params = Object.create(null) as MatchPatternParams

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === TokenType.Literal) {
      if (!inputString.startsWith(token.value, position)) {
        return NO_MATCH
      }

      position += token.value.length
      continue
    }

    // Wildcard or param — use precomputed nextLiteral.
    // Params without + or * modifiers are segment-scoped (stop at '/').
    const nextLiteralValue = token.nextLiteral
    const isSegmentScoped =
      token.type === TokenType.Param &&
      token.modifier !== '+' &&
      token.modifier !== '*'
    let endPosition: number

    if (nextLiteralValue === undefined) {
      if (isSegmentScoped) {
        const slashIndex = inputString.indexOf('/', position)
        endPosition = slashIndex === -1 ? inputLength : slashIndex
      } else {
        endPosition = inputLength
      }
    } else {
      const idx = inputString.indexOf(nextLiteralValue, position)

      if (idx === -1) {
        if (
          token.type === TokenType.Param &&
          (token.modifier === '?' || token.modifier === '*')
        ) {
          endPosition = position
        } else {
          return NO_MATCH
        }
      } else if (isSegmentScoped && nextLiteralValue.charCodeAt(0) !== SLASH) {
        // Only check for '/' when the next literal doesn't already
        // start with '/' — if it does, indexOf(nextLiteral) already
        // found the segment boundary.
        const slashIndex = inputString.indexOf('/', position)
        endPosition = slashIndex === -1 || slashIndex >= idx ? idx : slashIndex
      } else {
        endPosition = idx
      }
    }

    // Check emptiness before allocating the captured substring.
    const allowEmpty =
      token.type === TokenType.Param &&
      (token.modifier === '?' || token.modifier === '*')

    if (!allowEmpty && position === endPosition) {
      return NO_MATCH
    }

    if (token.type === TokenType.Wildcard) {
      params[String(wildcardIndex++)] = inputString.slice(position, endPosition)
    } else if (position !== endPosition) {
      const captured = inputString.slice(position, endPosition)
      const existing = params[token.name]

      if (existing !== undefined) {
        if (Array.isArray(existing)) {
          existing.push(captured)
        } else {
          params[token.name] = [existing, captured]
        }
      } else {
        params[token.name] = captured
      }
    }

    position = endPosition
  }

  if (position !== inputLength) {
    return NO_MATCH
  }

  return {
    matches: true,
    params,
  }
}

function removeQueryString(input: string): string {
  const queryIndex = input.indexOf('?')
  return queryIndex === -1 ? input : input.slice(0, queryIndex)
}

function decodeInput(input: string): string {
  if (input.indexOf('%') === -1) {
    return input
  }

  try {
    return decodeURIComponent(input)
  } catch {
    return input
  }
}

/**
 * Match a URL against the given pattern.
 * @example
 * matchPattern('http://localhost/user/123', 'http://localhost/user/:userId')
 * // { matches: true, params: { userId: '123' } }
 */
export function matchPattern(
  input: MatchPatternInput,
  pattern: string,
): MatchResult {
  const inputString = decodeInput(
    removeQueryString(typeof input === 'string' ? input : input.href),
  )
  const { tokens, isLiteralOnly } = parsePatternOrGetFromCache(pattern)

  // Pure literal patterns are just a string equality check.
  if (isLiteralOnly) {
    return inputString === pattern
      ? { matches: true, params: Object.create(null) }
      : NO_MATCH
  }

  return matchTokens(inputString, tokens)
}
