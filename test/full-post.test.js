'use strict'

const t = require('tap')
const Fastify = require('fastify')
const { request } = require('undici')
const From = require('..')
const http = require('node:http')

const instance = Fastify()
instance.register(From)

t.test('full post', async (t) => {
  t.plan(5)
  t.after(() => instance.close())

  const target = http.createServer((req, res) => {
    t.assert.ok('request proxied')
    t.assert.deepEqual(req.method, 'POST')
    t.assert.deepEqual(req.headers['content-type'], 'application/json')
    let data = ''
    req.setEncoding('utf8')
    req.on('data', (d) => {
      data += d
    })
    req.on('end', () => {
      t.same(JSON.parse(data), { hello: 'world' })
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ something: 'else' }))
    })
  })

  instance.post('/', (_request, reply) => {
    reply.from(`http://localhost:${target.address().port}`)
  })

  t.after(() => target.close())

  await new Promise(resolve => instance.listen({ port: 0 }, resolve))

  await new Promise(resolve => target.listen({ port: 0 }, resolve))

  const result = await request(`http://localhost:${instance.server.address().port}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      hello: 'world'
    })
  })

  t.same(await result.body.json(), { something: 'else' })
})
