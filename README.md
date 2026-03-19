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

matchPattern('/user/abc-123', '/user/:userId')
// { matches: true, params: { userId: 'abc-123' } }
```

This function supports the following features:

- URL strings and `URL` instances as the `input`;
- Absolute and relative URLs;
- Wildcards (`http://*.domain.com:*/route`);
- Path parameters, including optional (`:param?`), splat (`:param*`), and one-or-more (`:param+`) modifiers;
- Encoded URL segments;

`matchPattern` uses token-based comparision to completely forego regular expressions, which should, technically, make it more performant and less prone to vulnerabilities. Doesn't promise full feature parity with `path-to-regexp` but currently uses its test suite as the compliance bar.

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
