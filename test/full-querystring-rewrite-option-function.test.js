'use strict'

const t = require('tap')
const Fastify = require('fastify')
const { request } = require('undici')
const From = require('..')
const http = require('node:http')
const querystring = require('node:querystring')

const instance = Fastify()

t.test('full querystring rewrite option function', async (t) => {
  t.plan(7)
  t.after(() => instance.close())

  const target = http.createServer((req, res) => {
    t.assert.ok('request proxied')
    t.assert.deepEqual(req.method, 'GET')
    t.assert.deepEqual(req.url, '/world?b=c')
    res.statusCode = 205
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('x-my-header', 'hello!')
    res.end('hello world')
  })

  instance.get('/hello', (_request, reply) => {
    reply.from(`http://localhost:${target.address().port}/world?a=b`, {
      queryString () {
        return querystring.stringify({ b: 'c' })
      }
    })
  })

  t.after(() => target.close())

  await new Promise(resolve => target.listen({ port: 0 }, resolve))

  instance.register(From)

  await new Promise(resolve => instance.listen({ port: 0 }, resolve))

  const result = await request(`http://localhost:${instance.server.address().port}/hello?a=b`)

  t.assert.deepEqual(result.headers['content-type'], 'text/plain')
  t.assert.deepEqual(result.headers['x-my-header'], 'hello!')
  t.assert.deepEqual(result.statusCode, 205)
  t.assert.deepEqual(await result.body.text(), 'hello world')
})
