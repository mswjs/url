import { MatchResult, MatchPatternParams } from '../src'

export const NO_MATCH: MatchResult = { matches: false, params: {} }

export const MATCHES_WITHOUT_PARAMS: MatchResult = { matches: true, params: {} }

export const MATCHES_WITH_PARAMS = (params: MatchPatternParams) => {
  return { matches: true, params }
}
