import { matchPattern, MatchResult } from '../src'
import { NO_MATCH, MATCHES_WITH_PARAMS, MATCHES_WITHOUT_PARAMS } from './utils'

it.each<
  [
    Parameters<typeof matchPattern>[0],
    Parameters<typeof matchPattern>[1],
    MatchResult,
  ]
>([
  /* Empty input */
  ['', '', MATCHES_WITHOUT_PARAMS],
  ['', '/:param', NO_MATCH],

  /* Absolute URLs */
  ['http://localhost', 'http://localhost', MATCHES_WITHOUT_PARAMS],
  ['http://localhost/', 'http://localhost/', MATCHES_WITHOUT_PARAMS],
  [
    'http://localhost/some/path',
    'http://localhost/some/path',
    MATCHES_WITHOUT_PARAMS,
  ],
  ['http://localhost', 'http://localhost/user/123', NO_MATCH],

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

  /* Wildcard non-match */
  ['http://localhost', 'http://localhost/*', NO_MATCH],
  ['http://localhost/', 'http://localhost/*', NO_MATCH],

  /* Three or more wildcards */
  [
    'http://a.b.c',
    'http://*.*.*',
    MATCHES_WITH_PARAMS({ '0': 'a', '1': 'b', '2': 'c' }),
  ],

  /* Mixed wildcard and path parameters */
  [
    'http://example.com/user/123',
    'http://*/user/:id',
    MATCHES_WITH_PARAMS({ '0': 'example.com', id: '123' }),
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

  /* Param names with digits and underscores */
  [
    'http://localhost/123',
    'http://localhost/:user_id',
    MATCHES_WITH_PARAMS({ user_id: '123' }),
  ],
  [
    'http://localhost/abc',
    'http://localhost/:param2',
    MATCHES_WITH_PARAMS({ param2: 'abc' }),
  ],

  /* Colon in input (not pattern) */
  [
    'http://localhost:8080/foo',
    'http://localhost:8080/:param',
    MATCHES_WITH_PARAMS({ param: 'foo' }),
  ],

  /* Query strings and fragments */
  [
    'http://localhost/user?id=1',
    'http://localhost/:param',
    MATCHES_WITH_PARAMS({ param: 'user?id=1' }),
  ],
  ['http://localhost/user?id=1', 'http://localhost/user', NO_MATCH],
  [
    'http://localhost/path#section',
    'http://localhost/:param',
    MATCHES_WITH_PARAMS({ param: 'path#section' }),
  ],

  /* Optional path parameter (?) */
  [
    'http://localhost/user',
    'http://localhost/:param?',
    MATCHES_WITH_PARAMS({ param: 'user' }),
  ],
  ['http://localhost/', 'http://localhost/:param?', MATCHES_WITHOUT_PARAMS],
  [
    'http://localhost/user/settings',
    'http://localhost/:param?/settings',
    MATCHES_WITH_PARAMS({ param: 'user' }),
  ],
  [
    'http://localhost//settings',
    'http://localhost/:param?/settings',
    MATCHES_WITHOUT_PARAMS,
  ],

  /* One or more path parameter (+) */
  [
    'http://localhost/user/123',
    'http://localhost/:param+',
    MATCHES_WITH_PARAMS({ param: 'user/123' }),
  ],
  [
    'http://localhost/user',
    'http://localhost/:param+',
    MATCHES_WITH_PARAMS({ param: 'user' }),
  ],
  ['http://localhost/', 'http://localhost/:param+', NO_MATCH],

  /* Zero or more path parameter (*) */
  [
    'http://localhost/user/123',
    'http://localhost/:param*',
    MATCHES_WITH_PARAMS({ param: 'user/123' }),
  ],
  ['http://localhost/', 'http://localhost/:param*', MATCHES_WITHOUT_PARAMS],

  /* URL instance as input */
  [
    new URL('http://localhost/user/123'),
    'http://localhost/user/:param',
    MATCHES_WITH_PARAMS({ param: '123' }),
  ],
  [
    new URL('http://localhost/user/123'),
    'http://localhost/user/*',
    MATCHES_WITH_PARAMS({ '0': '123' }),
  ],
  [new URL('http://localhost'), 'http://localhost', NO_MATCH],
  [new URL('http://localhost'), 'http://localhost/', MATCHES_WITHOUT_PARAMS],
  [new URL('http://localhost/'), 'http://localhost', NO_MATCH],
  [new URL('http://localhost/'), 'http://localhost/', MATCHES_WITHOUT_PARAMS],
  [new URL('http://localhost/user/'), 'http://localhost/user', NO_MATCH],
  [
    new URL('http://localhost/user/'),
    'http://localhost/user/',
    MATCHES_WITHOUT_PARAMS,
  ],
])('matches %j against %j', (input, pattern, expectedResult) => {
  expect(matchPattern(input, pattern)).toStrictEqual(expectedResult)
})
