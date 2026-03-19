export interface MatchResult {
  matches: boolean
  params: MatchPatternParams
}

export type MatchPatternInput = string | URL
export type MatchPatternParams = Record<string, string | Array<string>>

const AMPERSAND = 42 // *
const COLON = 58 // :
const QUESTION_MARK = 63 // ?
const PLUS = 43 // +
const UNDERSCORE = 95 // _

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

function parsePattern(pattern: string): Array<Token> {
  const tokens: Array<Token> = []
  let i = 0
  const length = pattern.length

  while (i < length) {
    const code = pattern.charCodeAt(i)

    if (code === AMPERSAND) {
      tokens.push({
        type: TokenType.Wildcard,
        nextLiteral: undefined,
      })
      i++
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
    } else {
      const start = i

      while (i < length) {
        const charCode = pattern.charCodeAt(i)

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
  const params: MatchPatternParams = {}

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === TokenType.Literal) {
      if (!inputString.startsWith(token.value, position)) {
        return {
          matches: false,
          params: {},
        }
      }

      position += token.value.length
      continue
    }

    // Wildcard or param — use precomputed nextLiteral.
    const nextLiteralValue = token.nextLiteral
    let endPosition: number

    if (nextLiteralValue === undefined) {
      endPosition = inputLength
    } else {
      const idx = inputString.indexOf(nextLiteralValue, position)

      if (idx === -1) {
        if (
          token.type === TokenType.Param &&
          (token.modifier === '?' || token.modifier === '*')
        ) {
          endPosition = position
        } else {
          return {
            matches: false,
            params: {},
          }
        }
      } else {
        endPosition = idx
      }
    }

    // Check emptiness before allocating the captured substring.
    const allowEmpty =
      token.type === TokenType.Param &&
      (token.modifier === '?' || token.modifier === '*')

    if (!allowEmpty && position === endPosition) {
      return {
        matches: false,
        params: {},
      }
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
    return {
      matches: false,
      params: {},
    }
  }

  return {
    matches: true,
    params,
  }
}

export function matchPattern(
  input: MatchPatternInput,
  pattern: string,
): MatchResult {
  const tokens = parsePattern(pattern)

  if (input instanceof URL) {
    const result = matchTokens(input.href, tokens)

    if (result.matches || input.pathname !== '/') {
      return result
    }

    // The URL constructor implicitly adds a trailing slash for root
    // pathnames. Retry without it to make the implicit slash optional.
    return matchTokens(input.href.slice(0, -1), tokens)
  }

  return matchTokens(input, tokens)
}
