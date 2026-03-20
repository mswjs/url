# `@msw/url`

Utilities for working with URLs.

## Motivation

I need a reliable and performant path matching library for Mock Service Worker. Here are my options right now:

- `URLPattern`
  - 👍 Standard API supported in the browser and Node.js;
  - 👎 Abysmally slow;
  - 👎 Has subpar ergonomics;
  - 👎 Misses certain features (e.g. repeated parameters).
- `path-to-regexp`
  - 👍 The industry standard;
  - 👎 Prone to vulnerabilities due to dependency on `RegExp`;
  - 👎 Misses certain features (e.g. wildcards).
  - 👎 Behavioral changes across breaking versions mean more work on my end for compatibility;
- `@remix-run/route-pattern`
  - 👍 Aims to cover most of the modern expectations;
  - 👎 Does not support relative URLs;
  - 👎 Heavily designed around framework routing.

I've been using `path-to-regexp` for years now, but it's rather painful to update as it introduces breaking changes in behaviors that I cannot directly propagate to my users, and sitting on older versions is a potential security vulnerability waiting to happen. The standard APIs are so slow they shouldn't be used by anyone, to begin with, and the modern libraries design around their priorities, which aren't always benefitial to me.

**This library isn't an answer to any downsides of the existing solutions**. I built it for myself, plan to use it myself. I don't endorse or recommend you use it.

## Getting started

```sh
npm i @msw/url
```

## API

### `matchPattern(input, pattern)`

Matches a URL against the given pattern.

```ts
import { matchPattern } from '@msw/url'
```

`matchPattern` uses token-based comparision to completely forego regular expressions, which should, technically, make it more performant and less prone to vulnerabilities. Doesn't promise full feature parity with `path-to-regexp` but currently uses its test suite as the compliance bar.

#### Absolute and relative URLs

```ts
matchPattern('/user', '/user')
matchPattern('https://acme.com/user', 'https://acme.com/user')
```

#### Trailing slashes

The pattern is the source of truth. If it ends with a trailing slash, then the input must also end with it to match. If the pattern doesn't end with a trailing slash, then the trailing slash in the input is ignored when matching.

```ts
// No trailing slash in the pattern? Ignore it.
matchPattern('/api', '/api') // ✅
matchPattern('/api/', '/api') // ✅

// Trailing slash in the pattern? It's required.
matchPattern('/api/', '/api/') // ✅
matchPattern('/api', '/api/') // ❌
```

> This is to accommodate to JavaScript developers not being used to providing trailing slashes.

#### Path parameters

```ts
matchPattern('/user/123', '/user/:userId')
// { matches: true, params: { userId: '123' } }
```

> Parameter values are always strings, just like any other segment of a URL.

##### Optional parameters

```ts
matchPattern('/user/', '/user/:userId?')
// { matches: true, params: {} }

matchPattern('/user/123', '/user/:userId?')
// { matches: true, params: { userId: '123' } }
```

##### Splat parameters

```ts
matchPattern('/user/', '/user/:userId*')
// { matches: true, params: {} }

matchPattern('/user/123', '/user/:userId*')
// { matches: true, params: { userId: '123' } }

matchPattern('/user/123/messages', '/user/:userId*')
// { matches: true, params: { userId: '123/messages' } }
```

##### One-or-more parameters

```ts
matchPattern('/user/', '/user/:userId+')
// { matches: false }

matchPattern('/user/123', '/user/:userId+')
// { matches: true, params: { userId: '123' } }

matchPattern('/user/123/messages', '/user/:userId+')
// { matches: true, params: { userId: '123/messages' } }
```

#### Wildcards

```ts
matchPattern('http://acme.com/user/123', 'http://*.com/user/*')
// { matches: true, params: { '0': 'acme', '1': '123' } }
```

> If no value is present at the wildcard's position, the pattern will still match with the wildcard parameter value `''`. Wildcards are, effectively, unnamed splat parameters.

A slash preceding a wildcard is not a part of the wildcard and is _required_:

```ts
matchPattern('/user/', '/user/*') // ✅ { params: { '0': ''} }
matchPattern('/user', '/user/*') // ❌
```

#### Encoded URL segments

```ts
matchPattern('/%E4%B8%AD%E6%96%87', '/:name')
// { matches: true, params: { name: '中文' } }
```

## Benchmarks

```sh
pnpm bench
```

You can run the benchmarks to see how this library compares to `URLPattern`, `path-to-regexp`, `find-my-way`, and `@remix-run/route-pattern`. It wins across some categories, loses in others. I find its performance acceptable to adopt in my tooling.

## Related work

- [`URLPattern`](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern)
- [`node-match-path`](https://npmx.dev/package/node-match-path)
- [`path-to-regexp`](https://npmx.dev/package/path-to-regexp)
- [`@remix-run/route-pattern`](https://npmx.dev/package/@remix-run/route-pattern)
