import { matchPattern } from '../src'
import { NO_MATCH, MATCHES_WITH_PARAMS, MATCHES_WITHOUT_PARAMS } from './utils'

it.each([
  /* Simple paths */
  ['/', '/', MATCHES_WITHOUT_PARAMS],
  ['/', '/route', NO_MATCH],
  ['/test', '/test', MATCHES_WITHOUT_PARAMS],
  ['/test', '/route', NO_MATCH],
  ['/test', '/test/route', NO_MATCH],
  ['/test', '/test/', MATCHES_WITHOUT_PARAMS],
  ['/test', '/TEST/', NO_MATCH],
  ['/test/', '/test/', MATCHES_WITHOUT_PARAMS],
  ['/test/', '/route', NO_MATCH],
  ['/test/', '/test', NO_MATCH],
  ['/test/', '/test//', NO_MATCH],

  /* Path params */
  ['/:test', '/route', MATCHES_WITH_PARAMS({ test: 'route' })],
  ['/:test', '/route/', MATCHES_WITH_PARAMS({ test: 'route' })],
  ['/:test', '/route.json', MATCHES_WITH_PARAMS({ test: 'route.json' })],
  ['/:test', '/route/test', NO_MATCH],
  [
    '/:test',
    '/;,:@&=+$-_.!~*()',
    MATCHES_WITH_PARAMS({ test: ';,:@&=+$-_.!~*()' }),
  ],

  /* No prefix characters */
  ['test', 'test', MATCHES_WITHOUT_PARAMS],
  ['test', '/test', NO_MATCH],
  [':test', 'route', MATCHES_WITH_PARAMS({ test: 'route' })],
  [':test', '/route', NO_MATCH],
  [':test', 'route/', MATCHES_WITH_PARAMS({ test: 'route' })],

  /* Formats */
  ['/test.json', '/test.json', MATCHES_WITHOUT_PARAMS],
  ['/test.json', '/test', NO_MATCH],
  ['/:test.json', '/.json', NO_MATCH],
  ['/:test.json', '/test.json', MATCHES_WITH_PARAMS({ test: 'test' })],
  ['/:test.json', '/route.json', MATCHES_WITH_PARAMS({ test: 'route' })],
  ['/:test.json', '/route.json.json', NO_MATCH],

  /* Format and path params */
  [
    '/:test.:format',
    '/route.html',
    MATCHES_WITH_PARAMS({ test: 'route', format: 'html' }),
  ],
  ['/:test.:format', '/route', NO_MATCH],
  [
    '/:test.:format',
    '/route.html.json',
    MATCHES_WITH_PARAMS({ test: 'route', format: 'html.json' }),
  ],

  /* Multiple path params */
  [
    '/:foo/:bar',
    '/match/route',
    MATCHES_WITH_PARAMS({ foo: 'match', bar: 'route' }),
  ],

  /* Params with pipe delimiters */
  ['/route|:param|', '/route|world|', MATCHES_WITH_PARAMS({ param: 'world' })],
  ['/route|:param|', '/route||', NO_MATCH],
  [
    '/:foo|:bar|',
    '/hello|world|',
    MATCHES_WITH_PARAMS({ foo: 'hello', bar: 'world' }),
  ],
  ['/:foo|:bar|', '/hello||', NO_MATCH],

  /* Unicode */
  ['/:foo', '/café', MATCHES_WITH_PARAMS({ foo: 'café' })],
  ['/café', '/café', MATCHES_WITHOUT_PARAMS],
])('matches "%j" against "%j"', (pattern, input, expectedResult) => {
  expect(matchPattern(pattern, input)).toEqual(expectedResult)
})
