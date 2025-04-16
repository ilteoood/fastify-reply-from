'use strict'

const t = require('node:test')
const Fastify = require('fastify')
const From = require('..')
const https = require('node:https')
const fs = require('node:fs')
const { request, Agent } = require('undici')
const querystring = require('node:querystring')
const path = require('node:path')
const certs = {
  key: fs.readFileSync(path.join(__dirname, 'fixtures', 'fastify.key')),
  cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'fastify.cert'))
}

if (process.platform === 'win32') {
  t.assert.ok()
  process.exit(0)
}

const socketPath = `${__filename}.socket`

try {
  fs.unlinkSync(socketPath)
} catch (_) {
}

const instance = Fastify({
  https: certs
})
instance.register(From, {
  base: `unix+https://${querystring.escape(socketPath)}`
})

t.test('unix https undici', async (t) => {
  t.plan(7)
  t.after(() => instance.close())

  const target = https.createServer(certs, (req, res) => {
    t.assert.ok('request proxied')
    t.assert.deepEqual(req.method, 'GET')
    t.assert.deepEqual(req.url, '/hello')
    res.statusCode = 205
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('x-my-header', 'hello!')
    res.end('hello world')
  })

  instance.get('/', (_request, reply) => {
    reply.from('hello')
  })

  t.after(() => target.close())

  await instance.listen({ port: 0 })

  await new Promise(resolve => target.listen(socketPath, resolve))

  const result = await request(`https://localhost:${instance.server.address().port}`, {
    dispatcher: new Agent({
      connect: {
        rejectUnauthorized: false
      }
    })
  })

  t.assert.deepEqual(result.headers['content-type'], 'text/plain')
  t.assert.deepEqual(result.headers['x-my-header'], 'hello!')
  t.assert.deepEqual(result.statusCode, 205)
  t.assert.deepEqual(await result.body.text(), 'hello world')
})
