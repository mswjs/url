import { matchPattern, MatchResult } from '#src/index.js'
import { NO_MATCH, MATCHES_WITH_PARAMS } from '#tests/utils.js'

/**
 * @see https://github.com/mswjs/msw/issues/2836
 */
it.each<
  [
    Parameters<typeof matchPattern>[0],
    Parameters<typeof matchPattern>[1],
    MatchResult,
  ]
>([
  /* Omitted optional param after another param */
  ['/users/:id/:tab?', '/users/1', MATCHES_WITH_PARAMS({ id: '1' })],
  ['/users/:id/:tab?', '/users/1/', MATCHES_WITH_PARAMS({ id: '1' })],
  [
    '/users/:id/:tab?',
    '/users/1/posts',
    MATCHES_WITH_PARAMS({ id: '1', tab: 'posts' }),
  ],
  ['/users/:id/:tab?', '/users/1/posts/2', NO_MATCH],
  ['/users/:id/:tab?', '/users', NO_MATCH],
  ['/:a/:b?', '/x', MATCHES_WITH_PARAMS({ a: 'x' })],
  [
    'https://api.example.com/users/:id/:tab?',
    'https://api.example.com/users/1',
    MATCHES_WITH_PARAMS({ id: '1' }),
  ],
  [
    'https://api.example.com/users/:id/:tab?',
    new URL('https://api.example.com/users/1'),
    MATCHES_WITH_PARAMS({ id: '1' }),
  ],

  /* Omitted zero-or-more param after another param */
  ['/users/:id/:path*', '/users/1', MATCHES_WITH_PARAMS({ id: '1' })],
  [
    '/users/:id/:path*',
    '/users/1/a/b',
    MATCHES_WITH_PARAMS({ id: '1', path: 'a/b' }),
  ],
  [
    '/users/:id/files/:path*',
    '/users/1/files',
    MATCHES_WITH_PARAMS({ id: '1' }),
  ],
  [
    '/users/:id/files/:path*',
    '/users/1/files/a/b',
    MATCHES_WITH_PARAMS({ id: '1', path: 'a/b' }),
  ],
  ['/users/:id/files/:path*', '/users/1', NO_MATCH],

  /* Omitted optional param in the middle of the pattern */
  [
    '/users/:id/:tab?/settings',
    '/users/1/settings',
    MATCHES_WITH_PARAMS({ id: '1' }),
  ],
  [
    '/users/:id/:tab?/settings',
    '/users/1/posts/settings',
    MATCHES_WITH_PARAMS({ id: '1', tab: 'posts' }),
  ],

  /* Multiple consecutive optional params */
  ['/:a/:b?/:c?', '/x', MATCHES_WITH_PARAMS({ a: 'x' })],
  ['/:a/:b?/:c?', '/x/y', MATCHES_WITH_PARAMS({ a: 'x', b: 'y' })],
  ['/:a/:b?/:c?', '/x/y/z', MATCHES_WITH_PARAMS({ a: 'x', b: 'y', c: 'z' })],
  ['/:a?/:b?', '/x', MATCHES_WITH_PARAMS({ a: 'x' })],

  /* Omitted optional param after a wildcard or a multi-segment param */
  ['/files/*/:tab?', '/files/a', MATCHES_WITH_PARAMS({ '0': 'a' })],
  ['/files/:path+/:tab?', '/files/a', MATCHES_WITH_PARAMS({ path: 'a' })],
])('matches %j against %j', (pattern, input, expectedResult) => {
  expect(matchPattern(pattern, input)).toEqual(expectedResult)
})
