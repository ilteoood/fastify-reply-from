'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const { request, Agent } = require('undici')
const From = require('..')
const nock = require('nock')

test('hostname', async (t) => {
  const instance = Fastify()
  t.after(() => instance.close())

  nock('http://httpbin.org')
    .get('/ip')
    .reply(200, function () {
      t.assert.deepEqual(this.req.headers.host, 'httpbin.org')
      return { origin: '127.0.0.1' }
    })

  instance.get('*', (_request, reply) => {
    reply.from(null, {
      rewriteRequestHeaders: (originalReq, headers) => {
        t.assert.deepEqual(headers.host, 'httpbin.org')
        t.assert.deepEqual(originalReq.headers.host, `localhost:${instance.server.address().port}`)
        return headers
      }
    })
  })

  instance.register(From, {
    base: 'http://httpbin.org',
    http: {} // force the use of Node.js core
  })

  await instance.listen({ port: 0 })

  const res = await request(`http://localhost:${instance.server.address().port}/ip`, {
    dispatcher: new Agent({
      pipelining: 0
    })
  })
  t.assert.deepEqual(res.statusCode, 200)
  t.assert.deepEqual(res.headers['content-type'], 'application/json')
  t.assert.deepEqual(typeof (await res.body.json()).origin, 'string')
})

test('hostname and port', async (t) => {
  const instance = Fastify()
  t.after(() => instance.close())

  nock('http://httpbin.org:8080')
    .get('/ip')
    .reply(200, function () {
      t.assert.deepEqual(this.req.headers.host, 'httpbin.org:8080')
      return { origin: '127.0.0.1' }
    })

  instance.register(From, {
    base: 'http://httpbin.org:8080',
    http: true
  })

  instance.get('*', (_request, reply) => {
    reply.from()
  })

  await instance.listen({ port: 0 })

  const res = await request(`http://localhost:${instance.server.address().port}/ip`, {
    dispatcher: new Agent({
      pipelining: 0
    })
  })
  t.assert.deepEqual(res.statusCode, 200)
  t.assert.deepEqual(res.headers['content-type'], 'application/json')
  t.assert.deepEqual(typeof (await res.body.json()).origin, 'string')
})
