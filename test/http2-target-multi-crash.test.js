'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const { request } = require('undici')
const From = require('..')

test('http -> http2 crash multiple times', async (t) => {
  const instance = Fastify()

  t.teardown(instance.close.bind(instance))

  instance.get('/', (_request, reply) => {
    reply.from()
  })

  instance.register(From, {
    base: 'http://localhost:3128',
    http2: {
      sessionTimeout: 6000
    },
    sessionTimeout: 200
  })

  await instance.listen({ port: 0 })
  let target = setupTarget()
  await target.listen({ port: 3128 })
  await request(`http://localhost:${instance.server.address().port}`)
  await target.close()
  target = setupTarget()
  await target.listen({ port: 3128 })
  await request(`http://localhost:${instance.server.address().port}`)
  await target.close()
  const result = await request(`http://localhost:${instance.server.address().port}`)

  t.equal(result.statusCode, 503)
  t.match(result.headers['content-type'], /application\/json/)
  t.same(await result.body.json(), {
    statusCode: 503,
    code: 'FST_REPLY_FROM_SERVICE_UNAVAILABLE',
    error: 'Service Unavailable',
    message: 'Service Unavailable'
  })

  function setupTarget () {
    const target = Fastify({
      http2: true
    })

    target.get('/', (request, reply) => {
      t.pass('request proxied')
      reply.code(200).send({
        hello: 'world'
      })
    })
    return target
  }
})
