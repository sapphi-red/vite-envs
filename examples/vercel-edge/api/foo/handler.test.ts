import { expect, test } from 'vitest'
import handler from './handler'

test('correct response', async () => {
  const response = await handler(new Request('http://example.com'))
  const res = await response.text()
  expect(res).toMatchInlineSnapshot('"foo:627566666572"')
})
