export interface MatchResult {
  matches: boolean
  params: MatchPatternParams
}

export type MatchPatternInput = string | URL
export type MatchPatternParams = Record<string, string | Array<string>>

const ASTERISK = 42
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

const MAX_INPUT_LENGTH = 8192
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
  hasTrailingSlash: boolean
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

    // The pattern "ends with slash" only when the very last token
    // is a literal that ends with '/'. If the last token is a
    // param/wildcard, trailing '/' in a preceding literal is
    // structural (a separator), not trailing.
    const lastToken = tokens[tokens.length - 1]
    const hasTrailingSlash =
      lastToken !== undefined &&
      lastToken.type === TokenType.Literal &&
      lastToken.value.length > 0 &&
      lastToken.value.charCodeAt(lastToken.value.length - 1) === SLASH

    if (PATTERN_CACHE.size >= PATTERN_CACHE_LIMIT) {
      PATTERN_CACHE.delete(PATTERN_CACHE.keys().next().value!)
    }

    parsed = { tokens, isLiteralOnly, hasTrailingSlash }
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
    } else if (code === ASTERISK) {
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

        if (mod === QUESTION_MARK || mod === PLUS || mod === ASTERISK) {
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

      if (charCode === ASTERISK) {
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
        if (pattern.charCodeAt(j) === BACKSLASH && j + 1 < i) {
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

/**
 * Try to match a decoded literal against an encoded input segment.
 * Returns the number of raw input characters consumed, or -1 on failure.
 */
function findEncodedLiteralEnd(
  input: string,
  position: number,
  literal: string,
): number {
  // Each encoded byte (%XX) takes 3 chars vs 1 decoded. The encoded
  // segment can be at most 3x the literal length.
  const maxLength = Math.min(input.length - position, literal.length * 3)

  for (let length = literal.length; length <= maxLength; length++) {
    const segment = input.slice(position, position + length)
    const decoded = decode(segment)

    if (decoded === literal) {
      return length
    }

    // Only abort if a successful decode produced something longer
    // than the literal. Failed decodes return the raw string which
    // may be longer due to unresolved %XX sequences.
    if (decoded.length > literal.length && decoded !== segment) {
      return -1
    }
  }

  return -1
}

function matchTokens(
  inputString: string,
  tokens: Array<Token>,
  tolerateTrailingSlash: boolean,
): MatchResult {
  const inputLength = inputString.length

  let position = 0
  let wildcardIndex = 0
  const params = Object.create(null) as MatchPatternParams

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === TokenType.Literal) {
      if (inputString.startsWith(token.value, position)) {
        position += token.value.length
        continue
      }

      // The input may be URL-encoded. Try decoding the corresponding
      // input segment to see if it matches the literal. Only attempt
      // this when the remaining input contains a '%'.
      if (inputString.indexOf('%', position) !== -1) {
        const encodedLength = findEncodedLiteralEnd(
          inputString,
          position,
          token.value,
        )

        if (encodedLength !== -1) {
          position += encodedLength
          continue
        }
      }

      // If this literal ends with '/' and the only remaining token is
      // an optional/zero-or-more param, try matching without the trailing
      // slash. This allows `/users` to match pattern `/users/:id?`.
      if (
        token.value.charCodeAt(token.value.length - 1) === SLASH &&
        i + 1 === tokens.length - 1
      ) {
        const nextToken = tokens[i + 1]
        if (
          nextToken.type === TokenType.Param &&
          (nextToken.modifier === '?' || nextToken.modifier === '*')
        ) {
          const trimmed = token.value.slice(0, -1)
          if (inputString.startsWith(trimmed, position)) {
            position += trimmed.length
            i++
            continue
          }
        }
      }

      return NO_MATCH
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
      token.type === TokenType.Wildcard ||
      (token.type === TokenType.Param &&
        (token.modifier === '?' || token.modifier === '*'))

    if (!allowEmpty && position === endPosition) {
      return NO_MATCH
    }

    if (token.type === TokenType.Wildcard) {
      if (position !== endPosition) {
        params[String(wildcardIndex)] = decode(
          inputString.slice(position, endPosition),
        )
      }
      wildcardIndex++
    } else if (position !== endPosition) {
      const captured = decode(inputString.slice(position, endPosition))
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

  // If the pattern doesn't end with '/', tolerate a trailing slash
  // in the input that wasn't consumed by any token.
  const unconsumed = inputLength - position

  if (unconsumed > 0) {
    if (
      tolerateTrailingSlash &&
      unconsumed === 1 &&
      inputString.charCodeAt(position) === SLASH
    ) {
      // Trailing slash — accepted.
    } else {
      return NO_MATCH
    }
  }

  return {
    matches: true,
    params,
  }
}

function removeQueryAndFragment(input: string): string {
  const hashIndex = input.indexOf('#')
  if (hashIndex !== -1) {
    input = input.slice(0, hashIndex)
  }
  const queryIndex = input.indexOf('?')
  return queryIndex === -1 ? input : input.slice(0, queryIndex)
}

function removeTrailingSlash(input: string): string {
  if (input.length > 1 && input.charCodeAt(input.length - 1) === SLASH) {
    return input.slice(0, -1)
  }
  return input
}

function decode(value: string): string {
  if (value.indexOf('%') === -1) {
    return value
  }

  try {
    return decodeURIComponent(value)
  } catch {
    return value
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
  const rawInput = typeof input === 'string' ? input : input.href

  if (rawInput.length > MAX_INPUT_LENGTH) {
    throw new Error(
      `matchPattern: input URL exceeds the maximum allowed length of ${MAX_INPUT_LENGTH} characters (received ${rawInput.length}).`,
    )
  }

  let inputString = removeQueryAndFragment(rawInput)

  const { tokens, isLiteralOnly, hasTrailingSlash } =
    parsePatternOrGetFromCache(pattern)

  // Pure literal patterns are just a string equality check.
  // Try raw first, then decoded (for encoded inputs like %C3%A9 vs é).
  // When the pattern doesn't end with '/', also try with trailing
  // slash stripped from the input.
  if (isLiteralOnly) {
    if (inputString === pattern || decode(inputString) === pattern) {
      return { matches: true, params: Object.create(null) }
    }
    if (!hasTrailingSlash) {
      const stripped = removeTrailingSlash(inputString)
      if (stripped === pattern || decode(stripped) === pattern) {
        return { matches: true, params: Object.create(null) }
      }
    }
    return NO_MATCH
  }

  return matchTokens(inputString, tokens, !hasTrailingSlash)
}
