'use strict'

const t = require('tap')
const Fastify = require('fastify')
const From = require('..')
const https = require('node:https')
const { request, Agent } = require('undici')
const fs = require('node:fs')
const querystring = require('node:querystring')
const path = require('node:path')
const certs = {
  key: fs.readFileSync(path.join(__dirname, 'fixtures', 'fastify.key')),
  cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'fastify.cert'))
}

if (process.platform === 'win32') {
  t.pass()
  process.exit(0)
}

const instance = Fastify({
  https: certs
})
instance.register(From, {
  http: true
})

t.test('unix https', async (t) => {
  t.plan(7)
  t.teardown(instance.close.bind(instance))

  const socketPath = `${__filename}.socket`

  try {
    fs.unlinkSync(socketPath)
  } catch (_) {
  }

  const target = https.createServer(certs, (req, res) => {
    t.pass('request proxied')
    t.equal(req.method, 'GET')
    t.equal(req.url, '/hello')
    res.statusCode = 205
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('x-my-header', 'hello!')
    res.end('hello world')
  })

  instance.get('/', (_request, reply) => {
    reply.from(`unix+https://${querystring.escape(socketPath)}/hello`)
  })

  t.teardown(target.close.bind(target))

  await instance.listen({ port: 0 })

  await new Promise(resolve => target.listen(socketPath, resolve))

  const result = await request(`https://localhost:${instance.server.address().port}`, {
    dispatcher: new Agent({
      connect: {
        rejectUnauthorized: false
      }
    })
  })

  t.equal(result.headers['content-type'], 'text/plain')
  t.equal(result.headers['x-my-header'], 'hello!')
  t.equal(result.statusCode, 205)
  t.equal(await result.body.text(), 'hello world')
})
