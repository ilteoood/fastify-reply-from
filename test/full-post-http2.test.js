'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const From = require('..')
const { request, Agent } = require('undici')

test('http -> http2', async function (t) {
  const instance = Fastify()

  t.after(() => instance.close())

  const target = Fastify({
    http2: true
  })

  target.post('/', (request, reply) => {
    t.assert.ok('request proxied')
    t.assert.deepStrictEqual(request.body, { something: 'else' })
    reply.code(200).header('x-my-header', 'hello!').send({
      hello: 'world'
    })
  })

  instance.post('/', (_request, reply) => {
    reply.from()
  })

  t.after(() => target.close())

  await target.listen({ port: 0 })

  instance.register(From, {
    base: `http://localhost:${target.server.address().port}`,
    http2: true
  })

  await instance.listen({ port: 0 })

  const { headers, body, statusCode } = await request(`http://localhost:${instance.server.address().port}`, {
    method: 'POST',
    body: JSON.stringify({ something: 'else' }),
    headers: {
      'content-type': 'application/json'
    },
    dispatcher: new Agent({
      pipelining: 0
    })
  })
  t.assert.deepEqual(statusCode, 200)
  t.assert.deepEqual(headers['x-my-header'], 'hello!')
  t.assert.match(headers['content-type'], /application\/json/)
  t.assert.deepStrictEqual(await body.json(), { hello: 'world' })
  instance.close()
  target.close()
})
