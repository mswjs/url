import { matchPattern, MatchResult } from '#src/index.js'
import {
  NO_MATCH,
  MATCHES_WITH_PARAMS,
  MATCHES_WITHOUT_PARAMS,
} from '#tests/utils.js'

it.each<
  [
    Parameters<typeof matchPattern>[0],
    Parameters<typeof matchPattern>[1],
    MatchResult,
  ]
>([
  /* Multi-segment params don't swallow a tolerated trailing slash */
  ['/users/:path+', '/users/123/', MATCHES_WITH_PARAMS({ path: '123' })],
  ['/users/:path*', '/users/123/', MATCHES_WITH_PARAMS({ path: '123' })],
  [
    '/users/:path+',
    '/users/123/posts/',
    MATCHES_WITH_PARAMS({ path: '123/posts' }),
  ],
  [
    'http://localhost/:path+',
    new URL('http://localhost/a/b/'),
    MATCHES_WITH_PARAMS({ path: 'a/b' }),
  ],
  ['/users/:path*', '/users//', MATCHES_WITHOUT_PARAMS],

  /* No trailing slash in the input — captures are unchanged */
  ['/users/:path+', '/users/123', MATCHES_WITH_PARAMS({ path: '123' })],
  [
    '/users/:path+',
    '/users/123/posts',
    MATCHES_WITH_PARAMS({ path: '123/posts' }),
  ],

  /* A trailing slash in the pattern is required and stays structural */
  ['/users/:path+/', '/users/123/', MATCHES_WITH_PARAMS({ path: '123' })],
  ['/users/:path+/', '/users/123', NO_MATCH],
])('matches %j against %j', (pattern, input, expectedResult) => {
  expect(matchPattern(pattern, input)).toEqual(expectedResult)
})
