import { matchPattern } from '#src/index.js'

it('does not throw any errors for a normal input', () => {
  expect(() =>
    matchPattern('http://localhost/user/123', 'http://localhost/user/:userId'),
  ).not.toThrow()
})

it('throws an error if the input exceeds the maximum allowed length', () => {
  const longInput = 'http://localhost/' + 'a'.repeat(8200)

  expect(() => matchPattern(longInput, '*')).toThrow(
    `received ${longInput.length}`,
  )
})
