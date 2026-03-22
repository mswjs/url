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
  /* Empty input */
  ['', '', MATCHES_WITHOUT_PARAMS],
  ['/:param', '', NO_MATCH],

  /* Absolute URLs */
  ['http://localhost', 'http://localhost', MATCHES_WITHOUT_PARAMS],
  ['http://localhost/', 'http://localhost/', MATCHES_WITHOUT_PARAMS],
  [
    'http://localhost/some/path',
    'http://localhost/some/path',
    MATCHES_WITHOUT_PARAMS,
  ],
  ['http://localhost/user/123', 'http://localhost', NO_MATCH],

  /* Wildcard */
  ['*://localhost', 'http://localhost', MATCHES_WITH_PARAMS({ '0': 'http' })],
  ['http://*', 'http://localhost', MATCHES_WITH_PARAMS({ '0': 'localhost' })],
  [
    'http://localhost:*',
    'http://localhost:3000',
    MATCHES_WITH_PARAMS({ '0': '3000' }),
  ],
  [
    'http://localhost:*',
    'http://localhost:3000/',
    MATCHES_WITH_PARAMS({ '0': '3000/' }),
  ],
  [
    'http://localhost:*/',
    'http://localhost:3000/',
    MATCHES_WITH_PARAMS({ '0': '3000' }),
  ],
  [
    'http://localhost:*',
    'http://localhost:3000/user',
    MATCHES_WITH_PARAMS({ '0': '3000/user' }),
  ],
  [
    'http://*.localhost',
    'http://subdomain.localhost',
    MATCHES_WITH_PARAMS({ '0': 'subdomain' }),
  ],
  [
    'http://localhost*',
    'http://localhost/user',
    MATCHES_WITH_PARAMS({ '0': '/user' }),
  ],
  [
    'http://localhost/*',
    'http://localhost/user',
    MATCHES_WITH_PARAMS({ '0': 'user' }),
  ],
  [
    'http://localhost/*',
    'http://localhost/user/123',
    MATCHES_WITH_PARAMS({ '0': 'user/123' }),
  ],
  [
    'http://localhost/user/*',
    'http://localhost/user/123',
    MATCHES_WITH_PARAMS({ '0': '123' }),
  ],
  [
    'http://localhost/user/*/*',
    'http://localhost/user/123/settings',
    MATCHES_WITH_PARAMS({ '0': '123', '1': 'settings' }),
  ],
  ['http://localhost/*', 'http://localhost', NO_MATCH],
  ['http://localhost/*', 'http://localhost/', MATCHES_WITHOUT_PARAMS],
  [
    'http://localhost/*a*a*a',
    'http://localhost/1a1a1a',
    MATCHES_WITH_PARAMS({ '0': '1', '1': '1', '2': '1' }),
  ],

  /* Three or more wildcards */
  [
    'http://*.*.*',
    'http://a.b.c',
    MATCHES_WITH_PARAMS({ '0': 'a', '1': 'b', '2': 'c' }),
  ],

  /* Mixed wildcard and path parameters */
  [
    'http://*/user/:id',
    'http://example.com/user/123',
    MATCHES_WITH_PARAMS({ '0': 'example.com', id: '123' }),
  ],

  /* Path parameters */
  [
    'http://:param',
    'http://localhost',
    MATCHES_WITH_PARAMS({ param: 'localhost' }),
  ],
  ['http://:param', 'http://localhost/user/123', NO_MATCH],
  ['http://localhost/:param', 'http://localhost/user/123', NO_MATCH],
  [
    'http://localhost/:param/123',
    'http://localhost/user/123',
    MATCHES_WITH_PARAMS({ param: 'user' }),
  ],
  [
    'http://localhost/user/:param',
    'http://localhost/user/123',
    MATCHES_WITH_PARAMS({ param: '123' }),
  ],
  [
    'http://localhost/:param/123/:param',
    'http://localhost/user/123/settings',
    MATCHES_WITH_PARAMS({ param: ['user', 'settings'] }),
  ],

  /* Param names with digits and underscores */
  [
    'http://localhost/:user_id',
    'http://localhost/123',
    MATCHES_WITH_PARAMS({ user_id: '123' }),
  ],
  [
    'http://localhost/:param2',
    'http://localhost/abc',
    MATCHES_WITH_PARAMS({ param2: 'abc' }),
  ],

  /* Colon in input (not pattern) */
  [
    'http://localhost:8080/:param',
    'http://localhost:8080/foo',
    MATCHES_WITH_PARAMS({ param: 'foo' }),
  ],

  /* Query strings and fragments */
  [
    'http://localhost/:param',
    'http://localhost/user?id=1',
    MATCHES_WITH_PARAMS({ param: 'user' }),
  ],
  [
    'http://localhost/user',
    'http://localhost/user?id=1',
    MATCHES_WITHOUT_PARAMS,
  ],
  [
    'http://localhost/:param',
    'http://localhost/path#section',
    MATCHES_WITH_PARAMS({ param: 'path' }),
  ],

  /* Optional path parameter (?) */
  [
    'http://localhost/:param?',
    'http://localhost/user',
    MATCHES_WITH_PARAMS({ param: 'user' }),
  ],
  ['http://localhost/:param?', 'http://localhost/', MATCHES_WITHOUT_PARAMS],
  [
    'http://localhost/:param?/settings',
    'http://localhost/user/settings',
    MATCHES_WITH_PARAMS({ param: 'user' }),
  ],
  [
    'http://localhost/:param?/settings',
    'http://localhost//settings',
    MATCHES_WITHOUT_PARAMS,
  ],
  [
    'http://localhost/user/:id?',
    'http://localhost/user',
    MATCHES_WITHOUT_PARAMS,
  ],

  /* One or more path parameter (+) */
  [
    'http://localhost/:param+',
    'http://localhost/user/123',
    MATCHES_WITH_PARAMS({ param: 'user/123' }),
  ],
  [
    'http://localhost/:param+',
    'http://localhost/user',
    MATCHES_WITH_PARAMS({ param: 'user' }),
  ],
  ['http://localhost/:param+', 'http://localhost/', NO_MATCH],

  /* Zero or more path parameter (*) */
  [
    'http://localhost/:param*',
    'http://localhost/user/123',
    MATCHES_WITH_PARAMS({ param: 'user/123' }),
  ],
  ['http://localhost/:param*', 'http://localhost/', MATCHES_WITHOUT_PARAMS],

  /* URL-encoded param decoding */
  [
    'http://localhost/:name',
    'http://localhost/caf%C3%A9',
    MATCHES_WITH_PARAMS({ name: 'café' }),
  ],
  [
    'http://localhost/:param',
    'http://localhost/hello%20world',
    MATCHES_WITH_PARAMS({ param: 'hello world' }),
  ],
  [
    'http://localhost/*',
    'http://localhost/100%25',
    MATCHES_WITH_PARAMS({ '0': '100%' }),
  ],
  [
    'http://localhost/:param',
    'http://localhost/no-encoding',
    MATCHES_WITH_PARAMS({ param: 'no-encoding' }),
  ],
  [
    'http://localhost/:param',
    'http://localhost/%E4%B8%AD%E6%96%87',
    MATCHES_WITH_PARAMS({ param: '中文' }),
  ],
  [
    'http://localhost/:param',
    'http://localhost/bad%encoding',
    MATCHES_WITH_PARAMS({ param: 'bad%encoding' }),
  ],

  /* URL-encoded literal matching */
  [
    'http://localhost/café',
    'http://localhost/caf%C3%A9',
    MATCHES_WITHOUT_PARAMS,
  ],
  [
    'http://localhost/hello world',
    'http://localhost/hello%20world',
    MATCHES_WITHOUT_PARAMS,
  ],
  [
    'http://localhost/中文/posts',
    'http://localhost/%E4%B8%AD%E6%96%87/posts',
    MATCHES_WITHOUT_PARAMS,
  ],
  [
    'http://localhost/café/:section',
    'http://localhost/caf%C3%A9/menu',
    MATCHES_WITH_PARAMS({ section: 'menu' }),
  ],
  [
    'http://localhost/redirect/:url',
    `http://localhost/redirect/${encodeURIComponent('http://example.com:5001/example')}`,
    MATCHES_WITH_PARAMS({ url: 'http://example.com:5001/example' }),
  ],

  /* Escaped characters in pattern */
  ['/users/\\*', '/users/*', MATCHES_WITHOUT_PARAMS],
  ['/users/\\*', '/users/abc', NO_MATCH],
  ['/users/\\:id', '/users/:id', MATCHES_WITHOUT_PARAMS],
  ['/users/\\:id', '/users/123', NO_MATCH],
  ['/users/a\\\\b', '/users/a\\b', MATCHES_WITHOUT_PARAMS],
  ['/path/to/\\*.:ext', '/path/to/*.txt', MATCHES_WITH_PARAMS({ ext: 'txt' })],

  /* Relative URLs (path-only) */
  ['/users/settings', '/users/settings', MATCHES_WITHOUT_PARAMS],
  ['/users/other', '/users/settings', NO_MATCH],
  ['/users/:id', '/users/123', MATCHES_WITH_PARAMS({ id: '123' })],
  ['/users/:id/posts', '/users/123', NO_MATCH],
  [
    '/users/:userId/posts/:postId',
    '/users/123/posts/456',
    MATCHES_WITH_PARAMS({ userId: '123', postId: '456' }),
  ],
  ['/users/*', '/users/123', MATCHES_WITH_PARAMS({ '0': '123' })],
  [
    '/users/*/*',
    '/users/123/posts',
    MATCHES_WITH_PARAMS({ '0': '123', '1': 'posts' }),
  ],
  ['/users/:id?', '/users/123', MATCHES_WITH_PARAMS({ id: '123' })],
  ['/users/:id?', '/users/', MATCHES_WITHOUT_PARAMS],
  [
    '/users/:path+',
    '/users/123/posts',
    MATCHES_WITH_PARAMS({ path: '123/posts' }),
  ],
  ['/users/:path+', '/users/', NO_MATCH],
  [
    '/users/:path*',
    '/users/123/posts',
    MATCHES_WITH_PARAMS({ path: '123/posts' }),
  ],
  ['/users/:path*', '/users/', MATCHES_WITHOUT_PARAMS],
  ['/users/:name', '/users/caf%C3%A9', MATCHES_WITH_PARAMS({ name: 'café' })],
  ['/users/:id', '/users/123?tab=posts', MATCHES_WITH_PARAMS({ id: '123' })],
  ['/users/123', '/users/123?tab=posts', MATCHES_WITHOUT_PARAMS],

  /* URL instance as input */
  [
    'http://localhost/user/:param',
    new URL('http://localhost/user/123'),
    MATCHES_WITH_PARAMS({ param: '123' }),
  ],
  [
    'http://localhost/user/*',
    new URL('http://localhost/user/123'),
    MATCHES_WITH_PARAMS({ '0': '123' }),
  ],
  ['http://localhost', new URL('http://localhost'), MATCHES_WITHOUT_PARAMS],
  ['http://localhost/', new URL('http://localhost'), MATCHES_WITHOUT_PARAMS],
  ['http://localhost', new URL('http://localhost/'), MATCHES_WITHOUT_PARAMS],
  ['http://localhost/', new URL('http://localhost/'), MATCHES_WITHOUT_PARAMS],
  [
    'http://localhost/user',
    new URL('http://localhost/user/'),
    MATCHES_WITHOUT_PARAMS,
  ],
  [
    'http://localhost/user/',
    new URL('http://localhost/user/'),
    MATCHES_WITHOUT_PARAMS,
  ],
])('matches %j against %j', (pattern, input, expectedResult) => {
  expect(matchPattern(pattern, input)).toEqual(expectedResult)
})
