import { matchPattern } from '../src'
import { NO_MATCH, MATCHES_WITH_PARAMS, MATCHES_WITHOUT_PARAMS } from './utils'

it.each([
  /* Simple paths (adapted from path-to-regexp) */
  ['/', '/', MATCHES_WITHOUT_PARAMS],
  ['/route', '/', NO_MATCH],
  ['/test', '/test', MATCHES_WITHOUT_PARAMS],
  ['/route', '/test', NO_MATCH],
  ['/test/route', '/test', NO_MATCH],
  ['/test/', '/test', NO_MATCH],
  ['/TEST/', '/test', NO_MATCH],
  ['/test/', '/test/', MATCHES_WITHOUT_PARAMS],
  ['/route', '/test/', NO_MATCH],
  ['/test', '/test/', NO_MATCH],
  ['/test//', '/test/', NO_MATCH],

  /* Path params (adapted from path-to-regexp) */
  ['/route', '/:test', MATCHES_WITH_PARAMS({ test: 'route' })],
  ['/route/', '/:test', MATCHES_WITH_PARAMS({ test: 'route/' })],
  ['/route.json', '/:test', MATCHES_WITH_PARAMS({ test: 'route.json' })],
  ['/route/test', '/:test', MATCHES_WITH_PARAMS({ test: 'route/test' })],
  [
    '/;,:@&=+$-_.!~*()',
    '/:test',
    MATCHES_WITH_PARAMS({ test: ';,:@&=+$-_.!~*()' }),
  ],

  /* No prefix characters (adapted from path-to-regexp) */
  ['test', 'test', MATCHES_WITHOUT_PARAMS],
  ['/test', 'test', NO_MATCH],
  ['route', ':test', MATCHES_WITH_PARAMS({ test: 'route' })],
  ['/route', ':test', MATCHES_WITH_PARAMS({ test: '/route' })],
  ['route/', ':test', MATCHES_WITH_PARAMS({ test: 'route/' })],

  /* Formats (adapted from path-to-regexp) */
  ['/test.json', '/test.json', MATCHES_WITHOUT_PARAMS],
  ['/test', '/test.json', NO_MATCH],
  ['/.json', '/:test.json', NO_MATCH],
  ['/test.json', '/:test.json', MATCHES_WITH_PARAMS({ test: 'test' })],
  ['/route.json', '/:test.json', MATCHES_WITH_PARAMS({ test: 'route' })],
  ['/route.json.json', '/:test.json', NO_MATCH],

  /* Format and path params (adapted from path-to-regexp) */
  [
    '/route.html',
    '/:test.:format',
    MATCHES_WITH_PARAMS({ test: 'route', format: 'html' }),
  ],
  ['/route', '/:test.:format', NO_MATCH],
  [
    '/route.html.json',
    '/:test.:format',
    MATCHES_WITH_PARAMS({ test: 'route', format: 'html.json' }),
  ],

  /* Multiple path params (adapted from path-to-regexp) */
  [
    '/match/route',
    '/:foo/:bar',
    MATCHES_WITH_PARAMS({ foo: 'match', bar: 'route' }),
  ],

  /* Params with pipe delimiters (adapted from path-to-regexp) */
  ['/route|world|', '/route|:param|', MATCHES_WITH_PARAMS({ param: 'world' })],
  ['/route||', '/route|:param|', NO_MATCH],
  [
    '/hello|world|',
    '/:foo|:bar|',
    MATCHES_WITH_PARAMS({ foo: 'hello', bar: 'world' }),
  ],
  ['/hello||', '/:foo|:bar|', NO_MATCH],

  /* Unicode (adapted from path-to-regexp) */
  ['/café', '/:foo', MATCHES_WITH_PARAMS({ foo: 'café' })],
  ['/café', '/café', MATCHES_WITHOUT_PARAMS],
])('matches "%j" against "%j"', (input, pattern, expectedResult) => {
  expect(matchPattern(input, pattern)).toStrictEqual(expectedResult)
})
