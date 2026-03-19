import { bench, describe } from 'vitest'
import { matchPattern } from '../src'
import { match as pathToRegexpMatch } from 'path-to-regexp'
import { RoutePattern } from '@remix-run/route-pattern'
import FindMyWay from 'find-my-way'

const noop = () => {}

/**
 * Path-only benchmarks.
 * Compares matchPattern, path-to-regexp, and find-my-way on path matching.
 * Remix route-pattern requires full URLs, so it's excluded from this group.
 */

describe('static path', () => {
  const path = '/users/settings/profile'

  const p2rMatcher = pathToRegexpMatch(path)

  const fmw = FindMyWay()
  fmw.on('GET', path, noop)

  bench('matchPattern', () => {
    matchPattern(path, path)
  })

  bench('path-to-regexp', () => {
    p2rMatcher(path)
  })

  bench('find-my-way', () => {
    fmw.find('GET', path)
  })
})

describe('single param', () => {
  const pattern = '/users/:id'
  const input = '/users/123'

  const p2rMatcher = pathToRegexpMatch(pattern)

  const fmw = FindMyWay()
  fmw.on('GET', pattern, noop)

  bench('matchPattern', () => {
    matchPattern(input, pattern)
  })

  bench('path-to-regexp', () => {
    p2rMatcher(input)
  })

  bench('find-my-way', () => {
    fmw.find('GET', input)
  })
})

describe('multiple params', () => {
  const pattern = '/users/:userId/posts/:postId'
  const input = '/users/123/posts/456'

  const p2rMatcher = pathToRegexpMatch(pattern)

  const fmw = FindMyWay()
  fmw.on('GET', pattern, noop)

  bench('matchPattern', () => {
    matchPattern(input, pattern)
  })

  bench('path-to-regexp', () => {
    p2rMatcher(input)
  })

  bench('find-my-way', () => {
    fmw.find('GET', input)
  })
})

describe('param with extension', () => {
  const pattern = '/:file.:ext'
  const input = '/report.pdf'

  const p2rMatcher = pathToRegexpMatch(pattern)

  // find-my-way does not support inline extension params like `:file.:ext`.

  bench('matchPattern', () => {
    matchPattern(input, pattern)
  })

  bench('path-to-regexp', () => {
    p2rMatcher(input)
  })
})

describe('non-match (miss)', () => {
  const pattern = '/users/:id'
  const input = '/posts/123'

  const p2rMatcher = pathToRegexpMatch(pattern)

  const fmw = FindMyWay()
  fmw.on('GET', pattern, noop)

  bench('matchPattern', () => {
    matchPattern(input, pattern)
  })

  bench('path-to-regexp', () => {
    p2rMatcher(input)
  })

  bench('find-my-way', () => {
    fmw.find('GET', input)
  })
})

describe('deeply nested params', () => {
  const pattern = '/api/:version/orgs/:orgId/teams/:teamId/members/:memberId'
  const input = '/api/v2/orgs/42/teams/7/members/99'

  const p2rMatcher = pathToRegexpMatch(pattern)

  const fmw = FindMyWay()
  fmw.on('GET', pattern, noop)

  bench('matchPattern', () => {
    matchPattern(input, pattern)
  })

  bench('path-to-regexp', () => {
    p2rMatcher(input)
  })

  bench('find-my-way', () => {
    fmw.find('GET', input)
  })
})

/**
 * Full URL benchmarks.
 * Compares matchPattern and Remix route-pattern on full URL matching.
 * path-to-regexp and find-my-way only support path matching, so they're
 * excluded from this group.
 */

describe('full URL: static', () => {
  const url = 'http://localhost/users/settings/profile'

  const remixPattern = new RoutePattern(url)

  bench('matchPattern', () => {
    matchPattern(url, url)
  })

  bench('route-pattern', () => {
    remixPattern.match(url)
  })
})

describe('full URL: single param', () => {
  const pattern = 'http://localhost/users/:id'
  const input = 'http://localhost/users/123'

  const remixPattern = new RoutePattern(pattern)

  bench('matchPattern', () => {
    matchPattern(input, pattern)
  })

  bench('route-pattern', () => {
    remixPattern.match(input)
  })
})

describe('full URL: multiple params', () => {
  const pattern = 'http://localhost/users/:userId/posts/:postId'
  const input = 'http://localhost/users/123/posts/456'

  const remixPattern = new RoutePattern(pattern)

  bench('matchPattern', () => {
    matchPattern(input, pattern)
  })

  bench('route-pattern', () => {
    remixPattern.match(input)
  })
})

describe('full URL: non-match (miss)', () => {
  const pattern = 'http://localhost/users/:id'
  const input = 'http://localhost/posts/123'

  const remixPattern = new RoutePattern(pattern)

  bench('matchPattern', () => {
    matchPattern(input, pattern)
  })

  bench('route-pattern', () => {
    remixPattern.match(input)
  })
})
