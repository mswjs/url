import { matchPattern } from '../src'
import { NO_MATCH, MATCHES_WITH_PARAMS, MATCHES_WITHOUT_PARAMS } from './utils'

it.each([
  /* Simple paths */
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

  /* Path params */
  ['/route', '/:test', MATCHES_WITH_PARAMS({ test: 'route' })],
  ['/route/', '/:test', NO_MATCH],
  ['/route.json', '/:test', MATCHES_WITH_PARAMS({ test: 'route.json' })],
  ['/route/test', '/:test', NO_MATCH],
  [
    '/;,:@&=+$-_.!~*()',
    '/:test',
    MATCHES_WITH_PARAMS({ test: ';,:@&=+$-_.!~*()' }),
  ],

  /* No prefix characters */
  ['test', 'test', MATCHES_WITHOUT_PARAMS],
  ['/test', 'test', NO_MATCH],
  ['route', ':test', MATCHES_WITH_PARAMS({ test: 'route' })],
  ['/route', ':test', NO_MATCH],
  ['route/', ':test', NO_MATCH],

  /* Formats */
  ['/test.json', '/test.json', MATCHES_WITHOUT_PARAMS],
  ['/test', '/test.json', NO_MATCH],
  ['/.json', '/:test.json', NO_MATCH],
  ['/test.json', '/:test.json', MATCHES_WITH_PARAMS({ test: 'test' })],
  ['/route.json', '/:test.json', MATCHES_WITH_PARAMS({ test: 'route' })],
  ['/route.json.json', '/:test.json', NO_MATCH],

  /* Format and path params */
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

  /* Multiple path params */
  [
    '/match/route',
    '/:foo/:bar',
    MATCHES_WITH_PARAMS({ foo: 'match', bar: 'route' }),
  ],

  /* Params with pipe delimiters */
  ['/route|world|', '/route|:param|', MATCHES_WITH_PARAMS({ param: 'world' })],
  ['/route||', '/route|:param|', NO_MATCH],
  [
    '/hello|world|',
    '/:foo|:bar|',
    MATCHES_WITH_PARAMS({ foo: 'hello', bar: 'world' }),
  ],
  ['/hello||', '/:foo|:bar|', NO_MATCH],

  /* Unicode */
  ['/café', '/:foo', MATCHES_WITH_PARAMS({ foo: 'café' })],
  ['/café', '/café', MATCHES_WITHOUT_PARAMS],
])('matches "%j" against "%j"', (input, pattern, expectedResult) => {
  expect(matchPattern(input, pattern)).toEqual(expectedResult)
})
