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
  /* Literal IPv6 addresses */
  ['http://[::1]/', 'http://[::1]/', MATCHES_WITHOUT_PARAMS],
  ['http://[::1]/', new URL('http://[::1]/'), MATCHES_WITHOUT_PARAMS],
  ['http://[::1]', new URL('http://[::1]'), MATCHES_WITHOUT_PARAMS],
  [
    'http://[2001:db8::1]/path',
    'http://[2001:db8::1]/path',
    MATCHES_WITHOUT_PARAMS,
  ],
  [
    'http://[2001:db8::a1]/x',
    'http://[2001:db8::a1]/x',
    MATCHES_WITHOUT_PARAMS,
  ],
  ['http://[fe80::abcd]/', 'http://[fe80::abcd]/', MATCHES_WITHOUT_PARAMS],
  [
    'http://[2001:db8:85a3::8a2e:370:7334]/',
    'http://[2001:db8:85a3::8a2e:370:7334]/',
    MATCHES_WITHOUT_PARAMS,
  ],

  /* IPv6 with port */
  ['http://[::1]:8080/path', 'http://[::1]:8080/path', MATCHES_WITHOUT_PARAMS],
  [
    'http://[::1]:*/path',
    'http://[::1]:8080/path',
    MATCHES_WITH_PARAMS({ '0': '8080' }),
  ],

  /* IPv6 zone identifier (URL-encoded `%`) */
  [
    'http://[fe80::1%25eth0]/',
    'http://[fe80::1%25eth0]/',
    MATCHES_WITHOUT_PARAMS,
  ],

  /* Path parameters after an IPv6 host */
  [
    'http://[::1]/user/:id',
    new URL('http://[::1]/user/123'),
    MATCHES_WITH_PARAMS({ id: '123' }),
  ],
  [
    'http://[::1]/:resource/:id',
    'http://[::1]/user/123',
    MATCHES_WITH_PARAMS({ resource: 'user', id: '123' }),
  ],
  [
    'http://[2001:db8::1]/user/:id',
    'http://[2001:db8::1]/user/456',
    MATCHES_WITH_PARAMS({ id: '456' }),
  ],

  /* Wildcards alongside an IPv6 host */
  [
    'http://[::1]/*',
    new URL('http://[::1]/foo/bar'),
    MATCHES_WITH_PARAMS({ '0': 'foo/bar' }),
  ],
  ['*://[::1]/path', 'http://[::1]/path', MATCHES_WITH_PARAMS({ '0': 'http' })],
  ['http://*/path', 'http://[::1]/path', MATCHES_WITH_PARAMS({ '0': '[::1]' })],

  /* Mismatches */
  ['http://[::1]/path', 'http://[::2]/path', NO_MATCH],
  ['http://[::1]/path', 'http://[::1]/other', NO_MATCH],
])('matches %j against %j', (pattern, input, expectedResult) => {
  expect(matchPattern(pattern, input)).toEqual(expectedResult)
})
