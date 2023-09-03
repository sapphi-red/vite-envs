import { expect, test } from 'vitest'
import { handleApi } from './api'

declare var $GlobalBindings: any

test('correct response', async () => {
  const response = await handleApi(
    new Request('http://example.com/api/kv'),
    $GlobalBindings,
    new URL('http://example.com/api/kv')
  )
  expect(response.status).toBe(404)
})
