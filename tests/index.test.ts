import { matchPattern, MatchResult } from '../src'
import { MATCHES_WITH_PARAMS, MATCHES_WITHOUT_PARAMS } from './utils'

it.each<
  [
    Parameters<typeof matchPattern>[0],
    Parameters<typeof matchPattern>[1],
    MatchResult,
  ]
>([
  /* Absolute URLs */
  ['http://localhost', 'http://localhost', MATCHES_WITHOUT_PARAMS],
  ['http://localhost/', 'http://localhost/', MATCHES_WITHOUT_PARAMS],
  [
    'http://localhost/some/path',
    'http://localhost/some/path',
    MATCHES_WITHOUT_PARAMS,
  ],

  /* Wildcard */
  ['http://localhost', '*://localhost', MATCHES_WITH_PARAMS({ '0': 'http' })],
  ['http://localhost', 'http://*', MATCHES_WITH_PARAMS({ '0': 'localhost' })],
  [
    'http://localhost:3000',
    'http://localhost:*',
    MATCHES_WITH_PARAMS({ '0': '3000' }),
  ],
  [
    'http://localhost:3000/',
    'http://localhost:*',
    MATCHES_WITH_PARAMS({ '0': '3000/' }),
  ],
  [
    'http://localhost:3000/',
    'http://localhost:*/',
    MATCHES_WITH_PARAMS({ '0': '3000' }),
  ],
  [
    'http://localhost:3000/user',
    'http://localhost:*',
    MATCHES_WITH_PARAMS({ '0': '3000/user' }),
  ],
  [
    'http://subdomain.localhost',
    'http://*.localhost',
    MATCHES_WITH_PARAMS({ '0': 'subdomain' }),
  ],
  [
    'http://localhost/user',
    'http://localhost*',
    MATCHES_WITH_PARAMS({ '0': '/user' }),
  ],
  [
    'http://localhost/user',
    'http://localhost/*',
    MATCHES_WITH_PARAMS({ '0': 'user' }),
  ],
  [
    'http://localhost/user/123',
    'http://localhost/*',
    MATCHES_WITH_PARAMS({ '0': 'user/123' }),
  ],
  [
    'http://localhost/user/123',
    'http://localhost/user/*',
    MATCHES_WITH_PARAMS({ '0': '123' }),
  ],
  [
    'http://localhost/user/123/settings',
    'http://localhost/user/*/*',
    MATCHES_WITH_PARAMS({ '0': '123', '1': 'settings' }),
  ],

  /* Path parameters */
  [
    'http://localhost',
    'http://:param',
    MATCHES_WITH_PARAMS({ param: 'localhost' }),
  ],
  [
    'http://localhost/user/123',
    'http://:param',
    MATCHES_WITH_PARAMS({ param: 'localhost/user/123' }),
  ],
  [
    'http://localhost/user/123',
    'http://localhost/:param',
    MATCHES_WITH_PARAMS({ param: 'user/123' }),
  ],
  [
    'http://localhost/user/123',
    'http://localhost/:param/123',
    MATCHES_WITH_PARAMS({ param: 'user' }),
  ],
  [
    'http://localhost/user/123',
    'http://localhost/user/:param',
    MATCHES_WITH_PARAMS({ param: '123' }),
  ],
  [
    'http://localhost/user/123/settings',
    'http://localhost/:param/123/:param',
    MATCHES_WITH_PARAMS({ param: ['user', 'settings'] }),
  ],
])('matches %j against %j', (input, pattern, expectedResult) => {
  expect(matchPattern(input, pattern)).toStrictEqual(expectedResult)
})
