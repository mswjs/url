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
  /* Wildcards retry later occurrences of the next literal */
  ['*a', '1a1a', MATCHES_WITH_PARAMS({ '0': '1a1' })],
  ['*ab', 'ab-ab', MATCHES_WITH_PARAMS({ '0': 'ab-' })],
  [
    '/user/*/settings',
    '/user/a/settings/settings',
    MATCHES_WITH_PARAMS({ '0': 'a/settings' }),
  ],
  [
    '/files/*/report',
    '/files/2024/report/report',
    MATCHES_WITH_PARAMS({ '0': '2024/report' }),
  ],
  ['/user/*/settings', '/user/a/other', NO_MATCH],

  /* Leftmost binding still wins when it completes the match */
  ['/user/*/settings', '/user/a/settings', MATCHES_WITH_PARAMS({ '0': 'a' })],
  ['*a*b', '1a2a3b', MATCHES_WITH_PARAMS({ '0': '1', '1': '2a3' })],

  /* Path parameters retry within their segment */
  ['/:file.js', '/app.js.js', MATCHES_WITH_PARAMS({ file: 'app.js' })],

  /* Optional parameters mid-pattern can be omitted with their slash */
  ['/a/:p?/:p', '/a/x', MATCHES_WITH_PARAMS({ p: 'x' })],
  ['/a/:p?/:p', '/a/x/y', MATCHES_WITH_PARAMS({ p: ['x', 'y'] })],
  ['/users/:id?/posts', '/users/posts', MATCHES_WITHOUT_PARAMS],
  [
    '/users/:id?/posts',
    '/users/123/posts',
    MATCHES_WITH_PARAMS({ id: '123' }),
  ],
  ['/users/:path*/latest', '/users/latest', MATCHES_WITHOUT_PARAMS],

  /* Wildcards can bind empty before an encoded literal */
  ['*café', 'caf%C3%A9', MATCHES_WITHOUT_PARAMS],
])('matches %j against %j', (pattern, input, expectedResult) => {
  expect(matchPattern(pattern, input)).toEqual(expectedResult)
})
