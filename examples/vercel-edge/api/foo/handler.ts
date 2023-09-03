export const config = {
  runtime: 'edge'
}

export default async function handler(_request: Request) {
  return new Response('foo:' + Buffer.from('buffer').toString('hex'))
}

// stop auto reload
if (import.meta.hot) {
  import.meta.hot.accept()
}
