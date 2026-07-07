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
const OPEN_BRACKET = 91
const CLOSE_BRACKET = 93
const UPPERCASE_A = 65
const UPPERCASE_Z = 90

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
// Backtracking step budget per match. Realistic pattern/input pairs
// resolve in well under a hundred steps; only adversarial inputs
// (e.g. dozens of wildcards over thousands of near-matching
// characters) exhaust it, in which case the match bails out and
// reports no match instead of degrading to quadratic time.
const MAX_MATCH_STEPS = 100_000
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
  normalizedPattern: string
}

/**
 * Lowercase the case-insensitive parts of a URL — the scheme and
 * the host. Applies to both patterns and inputs so that
 * `http://EXAMPLE.com` matches `http://example.com`. The userinfo
 * (`user:pass@`), the path, and `:param` names within the host are
 * case-sensitive and preserved as-is.
 */
function lowercaseSchemeAndHost(url: string): string {
  const schemeSeparatorIndex = url.indexOf('://')

  if (schemeSeparatorIndex === -1) {
    return url
  }

  // A '/' before '://' means the match is inside the path of a
  // relative URL (e.g. `/redirect/http://example.com`) — no host.
  const firstSlashIndex = url.indexOf('/')

  if (firstSlashIndex !== schemeSeparatorIndex + 1) {
    return url
  }

  const authorityStart = schemeSeparatorIndex + 3
  let hostEnd = url.indexOf('/', authorityStart)

  if (hostEnd === -1) {
    hostEnd = url.length
  }

  // Skip the allocation when the scheme and host contain nothing to
  // lowercase. Codes above 127 take the slow path so that non-ASCII
  // hosts are lowercased via String#toLowerCase.
  let needsLowercasing = false

  for (let i = 0; i < hostEnd; i++) {
    const code = url.charCodeAt(i)

    if ((code >= UPPERCASE_A && code <= UPPERCASE_Z) || code > 127) {
      needsLowercasing = true
      break
    }
  }

  if (!needsLowercasing) {
    return url
  }

  const userinfoEnd = url.lastIndexOf('@', hostEnd - 1)

  let result = ''
  let plainStart = 0
  let inBrackets = false
  let i = 0

  while (i < hostEnd) {
    if (i === authorityStart && userinfoEnd >= authorityStart) {
      // The userinfo is case-sensitive — copy it as-is.
      result += url.slice(plainStart, i).toLowerCase()
      result += url.slice(i, userinfoEnd + 1)
      i = userinfoEnd + 1
      plainStart = i
      continue
    }

    const code = url.charCodeAt(i)

    if (code === OPEN_BRACKET) {
      inBrackets = true
    } else if (code === CLOSE_BRACKET) {
      inBrackets = false
    } else if (
      code === COLON &&
      !inBrackets &&
      i + 1 < hostEnd &&
      isIdentStartCode(url.charCodeAt(i + 1))
    ) {
      // Parameter names are case-sensitive — copy them as-is.
      result += url.slice(plainStart, i).toLowerCase()
      const paramStart = i
      i++

      while (i < hostEnd && isIdentCharCode(url.charCodeAt(i))) {
        i++
      }

      result += url.slice(paramStart, i)
      plainStart = i
      continue
    }

    i++
  }

  result += url.slice(plainStart, hostEnd).toLowerCase()
  result += url.slice(hostEnd)

  return result
}

function parsePatternOrGetFromCache(pattern: string): ParsedPattern {
  let parsed = PATTERN_CACHE.get(pattern)

  if (parsed === undefined) {
    const normalizedPattern = lowercaseSchemeAndHost(pattern)
    const tokens = parsePattern(normalizedPattern)
    let isLiteralOnly = normalizedPattern.indexOf('\\') === -1

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

    parsed = { tokens, isLiteralOnly, hasTrailingSlash, normalizedPattern }
    PATTERN_CACHE.set(pattern, parsed)
  }

  return parsed
}

function parsePattern(pattern: string): Array<Token> {
  const tokens: Array<Token> = []
  let i = 0
  const length = pattern.length
  // Tracks whether the cursor is inside a `[...]` group, used for IPv6
  // host literals like `http://[2001:db8::1]/path`. Inside brackets,
  // `:` and `*` are treated as literal characters so that hextets
  // beginning with hex letters (e.g. `:db8`) are not mis-parsed as
  // path parameters.
  let inBrackets = false

  while (i < length) {
    const code = pattern.charCodeAt(i)

    if (code === BACKSLASH && i + 1 < length) {
      // Escaped character — consume the backslash and the next character
      // as a literal. Fall through to the literal branch below by not
      // advancing `i` here (the literal branch handles it).
    } else if (code === ASTERISK && !inBrackets) {
      tokens.push({
        type: TokenType.Wildcard,
        nextLiteral: undefined,
      })
      i++
      continue
    } else if (
      code === COLON &&
      !inBrackets &&
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

      if (charCode === OPEN_BRACKET) {
        inBrackets = true
        i++
        continue
      }

      if (charCode === CLOSE_BRACKET) {
        inBrackets = false
        i++
        continue
      }

      if (charCode === ASTERISK && !inBrackets) {
        break
      }

      if (
        charCode === COLON &&
        !inBrackets &&
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

// Matcher state, kept at module scope so a match doesn't allocate
// closures or scratch arrays per call. Matching is synchronous and
// non-reentrant, so reusing this state across calls is safe.
let matcherInput = ''
let matcherInputLength = 0
let matcherTokens: Array<Token> = []
let matcherTokenCount = 0
let matcherTolerateTrailingSlash = false
let matcherParams: MatchPatternParams | undefined
let matcherRemainingSteps = 0

// (tokenIndex, position) states that already failed. Pruning them
// keeps backtracking polynomial on pathological inputs instead of
// exponential, which is the vulnerability RegExp-based matchers
// are prone to. Allocated lazily — most matches never backtrack.
let matcherFailedStates: Set<number> | undefined

// Wildcard/param bindings along the current match path, as parallel
// arrays to avoid allocating an object per attempted binding. Params
// are materialized from these only once the whole pattern matches.
const matcherBoundTokens: Array<Token> = []
const matcherBoundStarts: Array<number> = []
const matcherBoundEnds: Array<number> = []

function finalizeMatch(): boolean {
  const params = Object.create(null) as MatchPatternParams
  let wildcardIndex = 0

  for (let i = 0; i < matcherBoundTokens.length; i++) {
    const token = matcherBoundTokens[i]
    const start = matcherBoundStarts[i]
    const end = matcherBoundEnds[i]

    if (token.type === TokenType.Wildcard) {
      if (start !== end) {
        params[String(wildcardIndex)] = decode(
          matcherInput.slice(start, end),
        )
      }
      wildcardIndex++
      continue
    }

    if (token.type !== TokenType.Param || start === end) {
      continue
    }

    const captured = decode(matcherInput.slice(start, end))
    const existing = params[token.name]

    if (existing === undefined) {
      params[token.name] = captured
    } else if (Array.isArray(existing)) {
      existing.push(captured)
    } else {
      params[token.name] = [existing, captured]
    }
  }

  matcherParams = params
  return true
}

function bindAndContinue(
  token: Token,
  tokenIndex: number,
  start: number,
  end: number,
): boolean {
  matcherBoundTokens.push(token)
  matcherBoundStarts.push(start)
  matcherBoundEnds.push(end)

  if (matchFrom(tokenIndex + 1, end)) {
    return true
  }

  matcherBoundTokens.pop()
  matcherBoundStarts.pop()
  matcherBoundEnds.pop()

  return false
}

function matchLiteral(
  token: Extract<Token, { type: TokenType.Literal }>,
  tokenIndex: number,
  position: number,
): boolean {
  const value = token.value

  if (matcherInput.startsWith(value, position)) {
    if (matchFrom(tokenIndex + 1, position + value.length)) {
      return true
    }
  } else if (matcherInput.indexOf('%', position) !== -1) {
    // The input may be URL-encoded. Try decoding the corresponding
    // input segment to see if it matches the literal. Only attempt
    // this when the remaining input contains a '%'.
    const encodedLength = findEncodedLiteralEnd(matcherInput, position, value)

    if (
      encodedLength !== -1 &&
      matchFrom(tokenIndex + 1, position + encodedLength)
    ) {
      return true
    }
  }

  // A literal ending with '/' followed by an optional/zero-or-more
  // param: the slash belongs to the optional group. Try consuming
  // the literal without it and binding the param empty. This allows
  // `/users/:id?` to match `/users` and `/a/:p?/:p` to match `/a/x`.
  if (
    value.length > 0 &&
    value.charCodeAt(value.length - 1) === SLASH &&
    tokenIndex + 1 < matcherTokenCount
  ) {
    const nextToken = matcherTokens[tokenIndex + 1]

    if (
      nextToken.type === TokenType.Param &&
      (nextToken.modifier === '?' || nextToken.modifier === '*')
    ) {
      const trimmedValue = value.slice(0, -1)

      if (
        matcherInput.startsWith(trimmedValue, position) &&
        matchFrom(tokenIndex + 2, position + trimmedValue.length)
      ) {
        return true
      }
    }
  }

  return false
}

function matchParamOrWildcard(
  token: Exclude<Token, { type: TokenType.Literal }>,
  tokenIndex: number,
  position: number,
): boolean {
  const nextLiteralValue = token.nextLiteral
  // Params without + or * modifiers are segment-scoped (stop at '/').
  const isSegmentScoped =
    token.type === TokenType.Param &&
    token.modifier !== '+' &&
    token.modifier !== '*'
  const allowEmpty =
    token.type === TokenType.Wildcard ||
    token.modifier === '?' ||
    token.modifier === '*'

  let boundary: number

  if (isSegmentScoped) {
    const slashIndex = matcherInput.indexOf('/', position)
    boundary = slashIndex === -1 ? matcherInputLength : slashIndex
  } else {
    boundary = matcherInputLength
  }

  if (nextLiteralValue === undefined) {
    // No literal follows this token anywhere in the pattern.
    if (tokenIndex === matcherTokenCount - 1) {
      // Last token — it either consumes everything up to the
      // boundary or nothing does.
      if (!allowEmpty && position === boundary) {
        return false
      }

      // A multi-segment param reaching the end of the input must
      // not swallow a tolerated trailing slash — leave it to the
      // final unconsumed-input check instead.
      if (
        token.type === TokenType.Param &&
        !isSegmentScoped &&
        matcherTolerateTrailingSlash &&
        boundary > position &&
        matcherInput.charCodeAt(boundary - 1) === SLASH &&
        (allowEmpty || boundary - 1 > position) &&
        bindAndContinue(token, tokenIndex, position, boundary - 1)
      ) {
        return true
      }

      return bindAndContinue(token, tokenIndex, position, boundary)
    }

    // Only params/wildcards follow. Try every end position,
    // shortest first.
    for (let end = position; end <= boundary; end++) {
      if (!allowEmpty && end === position) {
        continue
      }

      if (bindAndContinue(token, tokenIndex, position, end)) {
        return true
      }
    }

    return false
  }

  // A literal follows this token. Try each occurrence of it,
  // leftmost first, then fall back to an empty capture for
  // optional tokens.
  let searchFrom = position
  let triedEmptyCapture = false

  while (true) {
    const occurrenceIndex = matcherInput.indexOf(nextLiteralValue, searchFrom)

    if (occurrenceIndex === -1 || occurrenceIndex > boundary) {
      break
    }

    if (occurrenceIndex === position) {
      triedEmptyCapture = true
    }

    if (allowEmpty || occurrenceIndex !== position) {
      if (bindAndContinue(token, tokenIndex, position, occurrenceIndex)) {
        return true
      }
    }

    searchFrom = occurrenceIndex + 1
  }

  if (allowEmpty && !triedEmptyCapture) {
    return bindAndContinue(token, tokenIndex, position, position)
  }

  return false
}

function matchFrom(tokenIndex: number, position: number): boolean {
  if (matcherRemainingSteps === 0) {
    return false
  }

  matcherRemainingSteps--

  if (tokenIndex === matcherTokenCount) {
    const unconsumed = matcherInputLength - position

    // If the pattern doesn't end with '/', tolerate a trailing slash
    // in the input that wasn't consumed by any token.
    if (
      unconsumed === 0 ||
      (matcherTolerateTrailingSlash &&
        unconsumed === 1 &&
        matcherInput.charCodeAt(position) === SLASH)
    ) {
      return finalizeMatch()
    }

    return false
  }

  const stateKey = tokenIndex * (matcherInputLength + 1) + position

  if (matcherFailedStates !== undefined && matcherFailedStates.has(stateKey)) {
    return false
  }

  const token = matcherTokens[tokenIndex]
  const matched =
    token.type === TokenType.Literal
      ? matchLiteral(token, tokenIndex, position)
      : matchParamOrWildcard(token, tokenIndex, position)

  if (!matched) {
    if (matcherFailedStates === undefined) {
      matcherFailedStates = new Set()
    }

    matcherFailedStates.add(stateKey)
  }

  return matched
}

/**
 * Single linear pass that binds every wildcard/param to the same first
 * candidate the backtracking matcher would try. Returns a MatchResult
 * when it can conclude on its own, or `undefined` when it failed past
 * a point where untried alternatives exist and backtracking is needed.
 */
function matchTokensLinear(
  inputString: string,
  tokens: Array<Token>,
  tolerateTrailingSlash: boolean,
): MatchResult | undefined {
  const inputLength = inputString.length
  const totalTokens = tokens.length

  let position = 0
  let wildcardIndex = 0
  // Whether any consumed token had another candidate to try. Failing
  // with no alternatives behind us is a definitive no-match.
  let hasAlternatives = false
  const params = Object.create(null) as MatchPatternParams

  for (let i = 0; i < totalTokens; i++) {
    const token = tokens[i]

    if (token.type === TokenType.Literal) {
      const value = token.value

      // A literal ending with '/' followed by an optional/zero-or-more
      // param can alternatively be consumed without the slash, binding
      // the param empty (see matchLiteral).
      let hasTrimAlternative = false

      if (
        value.charCodeAt(value.length - 1) === SLASH &&
        i + 1 < totalTokens
      ) {
        const nextToken = tokens[i + 1]
        hasTrimAlternative =
          nextToken.type === TokenType.Param &&
          (nextToken.modifier === '?' || nextToken.modifier === '*')
      }

      if (inputString.startsWith(value, position)) {
        if (hasTrimAlternative) {
          hasAlternatives = true
        }
        position += value.length
        continue
      }

      // The input may be URL-encoded. Try decoding the corresponding
      // input segment to see if it matches the literal. Only attempt
      // this when the remaining input contains a '%'.
      if (inputString.indexOf('%', position) !== -1) {
        const encodedLength = findEncodedLiteralEnd(
          inputString,
          position,
          value,
        )

        if (encodedLength !== -1) {
          if (hasTrimAlternative) {
            hasAlternatives = true
          }
          position += encodedLength
          continue
        }
      }

      if (hasTrimAlternative) {
        const trimmedValue = value.slice(0, -1)

        if (inputString.startsWith(trimmedValue, position)) {
          position += trimmedValue.length
          // Bind the optional param empty.
          i++
          continue
        }
      }

      return hasAlternatives ? undefined : NO_MATCH
    }

    // Wildcard or param — use precomputed nextLiteral.
    // Params without + or * modifiers are segment-scoped (stop at '/').
    const nextLiteralValue = token.nextLiteral
    const isSegmentScoped =
      token.type === TokenType.Param &&
      token.modifier !== '+' &&
      token.modifier !== '*'
    const allowEmpty =
      token.type === TokenType.Wildcard ||
      token.modifier === '?' ||
      token.modifier === '*'

    let boundary: number

    if (isSegmentScoped) {
      const slashIndex = inputString.indexOf('/', position)
      boundary = slashIndex === -1 ? inputLength : slashIndex
    } else {
      boundary = inputLength
    }

    let endPosition: number

    if (nextLiteralValue === undefined) {
      // No literal follows this token anywhere in the pattern.
      if (i === totalTokens - 1) {
        // Last token — it either consumes everything up to the
        // boundary or nothing does.
        if (!allowEmpty && position === boundary) {
          return hasAlternatives ? undefined : NO_MATCH
        }

        endPosition = boundary

        // A multi-segment param reaching the end of the input must
        // not swallow a tolerated trailing slash — leave it to the
        // final unconsumed-input check instead.
        if (
          token.type === TokenType.Param &&
          !isSegmentScoped &&
          tolerateTrailingSlash &&
          boundary > position &&
          inputString.charCodeAt(boundary - 1) === SLASH &&
          (allowEmpty || boundary - 1 > position)
        ) {
          endPosition = boundary - 1
          hasAlternatives = true
        }
      } else {
        // Only params/wildcards follow. Shortest capture first.
        endPosition = allowEmpty ? position : position + 1

        if (endPosition > boundary) {
          return hasAlternatives ? undefined : NO_MATCH
        }

        if (endPosition < boundary) {
          hasAlternatives = true
        }
      }
    } else {
      let occurrenceIndex = inputString.indexOf(nextLiteralValue, position)

      if (!allowEmpty && occurrenceIndex === position) {
        occurrenceIndex = inputString.indexOf(nextLiteralValue, position + 1)
      }

      if (occurrenceIndex === -1 || occurrenceIndex > boundary) {
        if (!allowEmpty) {
          return hasAlternatives ? undefined : NO_MATCH
        }

        // Empty capture — the last alternative for optional tokens.
        endPosition = position
      } else {
        endPosition = occurrenceIndex
        // Later occurrences (or the empty fallback) may exist;
        // checking precisely costs another scan, so assume so.
        hasAlternatives = true
      }
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

      if (existing === undefined) {
        params[token.name] = captured
      } else if (Array.isArray(existing)) {
        existing.push(captured)
      } else {
        params[token.name] = [existing, captured]
      }
    }

    position = endPosition
  }

  // If the pattern doesn't end with '/', tolerate a trailing slash
  // in the input that wasn't consumed by any token.
  const unconsumed = inputLength - position

  if (
    unconsumed !== 0 &&
    !(
      tolerateTrailingSlash &&
      unconsumed === 1 &&
      inputString.charCodeAt(position) === SLASH
    )
  ) {
    return hasAlternatives ? undefined : NO_MATCH
  }

  return {
    matches: true,
    params,
  }
}

function matchTokens(
  inputString: string,
  tokens: Array<Token>,
  tolerateTrailingSlash: boolean,
): MatchResult {
  const linearResult = matchTokensLinear(
    inputString,
    tokens,
    tolerateTrailingSlash,
  )

  if (linearResult !== undefined) {
    return linearResult
  }

  matcherInput = inputString
  matcherInputLength = inputString.length
  matcherTokens = tokens
  matcherTokenCount = tokens.length
  matcherTolerateTrailingSlash = tolerateTrailingSlash
  matcherParams = undefined
  matcherRemainingSteps = MAX_MATCH_STEPS
  matcherFailedStates = undefined
  matcherBoundTokens.length = 0
  matcherBoundStarts.length = 0
  matcherBoundEnds.length = 0

  matchFrom(0, 0)

  if (matcherParams === undefined) {
    return NO_MATCH
  }

  return {
    matches: true,
    params: matcherParams,
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
 * matchPattern('http://localhost/user/:userId', 'http://localhost/user/123')
 * // { matches: true, params: { userId: '123' } }
 */
export function matchPattern(
  pattern: string,
  input: MatchPatternInput,
): MatchResult {
  const rawInput = typeof input === 'string' ? input : input.href

  if (rawInput.length > MAX_INPUT_LENGTH) {
    throw new Error(
      `matchPattern: input URL exceeds the maximum allowed length of ${MAX_INPUT_LENGTH} characters (received ${rawInput.length}).`,
    )
  }

  const inputString = lowercaseSchemeAndHost(removeQueryAndFragment(rawInput))

  const { tokens, isLiteralOnly, hasTrailingSlash, normalizedPattern } =
    parsePatternOrGetFromCache(pattern)

  // Pure literal patterns are just a string equality check.
  // Try raw first, then decoded (for encoded inputs like %C3%A9 vs é).
  // When the pattern doesn't end with '/', also try with trailing
  // slash stripped from the input.
  if (isLiteralOnly) {
    if (
      inputString === normalizedPattern ||
      decode(inputString) === normalizedPattern
    ) {
      return { matches: true, params: Object.create(null) }
    }
    if (!hasTrailingSlash) {
      const stripped = removeTrailingSlash(inputString)
      if (stripped === normalizedPattern || decode(stripped) === normalizedPattern) {
        return { matches: true, params: Object.create(null) }
      }
    }
    return NO_MATCH
  }

  return matchTokens(inputString, tokens, !hasTrailingSlash)
}
