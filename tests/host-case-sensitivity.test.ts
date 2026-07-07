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
  /* Hosts are case-insensitive */
  [
    'http://EXAMPLE.com/user',
    'http://example.com/user',
    MATCHES_WITHOUT_PARAMS,
  ],
  [
    'http://example.com/user',
    'http://EXAMPLE.com/user',
    MATCHES_WITHOUT_PARAMS,
  ],
  [
    'http://Example.Com/user',
    'http://example.COM/user',
    MATCHES_WITHOUT_PARAMS,
  ],
  ['http://EXAMPLE.com', 'http://example.com', MATCHES_WITHOUT_PARAMS],
  [
    'http://EXAMPLE.com/user',
    'http://example.com/user/',
    MATCHES_WITHOUT_PARAMS,
  ],

  /* Schemes are case-insensitive */
  [
    'HTTP://example.com/user',
    'http://example.com/user',
    MATCHES_WITHOUT_PARAMS,
  ],
  [
    'http://example.com/user',
    'HTTP://example.com/user',
    MATCHES_WITHOUT_PARAMS,
  ],

  /* URL instance as input (`href` lowercases the host) */
  [
    'http://EXAMPLE.com/user',
    new URL('http://EXAMPLE.com/user'),
    MATCHES_WITHOUT_PARAMS,
  ],

  /* Path parameters and wildcards around a mixed-case host */
  [
    'http://Example.COM/user/:id',
    'http://example.com/user/123',
    MATCHES_WITH_PARAMS({ id: '123' }),
  ],
  [
    'http://*.Example.COM/',
    'http://api.example.com/',
    MATCHES_WITH_PARAMS({ '0': 'api' }),
  ],
  [
    'http://EXAMPLE.com:*/user',
    'http://example.com:3000/user',
    MATCHES_WITH_PARAMS({ '0': '3000' }),
  ],

  /* Parameter names in the host remain case-sensitive */
  [
    'http://:subDomain.example.COM/',
    'http://api.example.com/',
    MATCHES_WITH_PARAMS({ subDomain: 'api' }),
  ],

  /* IPv6 hosts are case-insensitive */
  [
    'http://[2001:DB8::1]/path',
    'http://[2001:db8::1]/path',
    MATCHES_WITHOUT_PARAMS,
  ],
  [
    'http://[2001:DB8::1]/path',
    new URL('http://[2001:DB8::1]/path'),
    MATCHES_WITHOUT_PARAMS,
  ],

  /* Userinfo remains case-sensitive */
  [
    'http://User@example.COM/',
    'http://User@example.com/',
    MATCHES_WITHOUT_PARAMS,
  ],
  ['http://user@example.com/', 'http://USER@example.com/', NO_MATCH],

  /* Paths remain case-sensitive */
  ['http://example.com/USER', 'http://example.com/user', NO_MATCH],
  ['http://example.com/user', 'http://example.com/USER', NO_MATCH],
  ['/USERS', '/users', NO_MATCH],

  /* A URL embedded in a relative path is not a host */
  [
    '/redirect/HTTP://EXAMPLE.com/x',
    '/redirect/http://example.com/x',
    NO_MATCH,
  ],
])('matches %j against %j', (pattern, input, expectedResult) => {
  expect(matchPattern(pattern, input)).toEqual(expectedResult)
})
