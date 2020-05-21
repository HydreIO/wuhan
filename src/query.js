import graphql from 'graphql'

const { stripIgnoredCharacters } = graphql
const no_client = () => {
  throw new Error('Missing client')
}

export default (client = no_client()) => (
    query,
    variables = {},
) => {
  if (typeof query !== 'string')
    throw new Error('The query is not a String')
  if (!client.connected)
    throw new Error('The client is not connected')

  const yield_query = function *() {
    const bytes = [
      ...JSON.stringify({
        document: stripIgnoredCharacters(query),
        variables,
      }),
    ].map(c => c.charCodeAt(0))
    const uint16 = new Uint16Array(bytes)
    const uint8 = new Uint8Array(
        uint16.buffer,
        uint16.byteOffset,
        uint16.byteLength,
    )

    yield uint8
  }
  const channel = client.open_channel()
  const iterator = yield_query()

  return {
    async *listen() {
      for await (const chunk of channel.passthrough(iterator)) {
        if (!chunk) return

        const uint16 = new Uint16Array(chunk.buffer)
        const string = String.fromCharCode.apply(
            undefined,
            uint16,
        )

        yield JSON.parse(string)
        /* c8 ignore next 2 */
        // not reachable
      }
    },
    stop: () => {
      channel.close()
    },
  }
}