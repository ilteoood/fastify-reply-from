'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const { request } = require('undici')
const From = require('..')
const https = require('node:https')
const { Agent } = require('undici')

const fs = require('node:fs')
const path = require('node:path')
const certs = {
  key: fs.readFileSync(path.join(__dirname, 'fixtures', 'fastify.key')),
  cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'fastify.cert'))
}

test('https global agent is used, but not destroyed', async (t) => {
  https.globalAgent.destroy = () => {
    t.fail()
  }
  const instance = Fastify({
    https: certs
  })
  t.teardown(instance.close.bind(instance))
  instance.get('/', (_request, reply) => {
    reply.from()
  })

  const target = https.createServer(certs, (req, res) => {
    t.pass('request proxied')
    t.equal(req.method, 'GET')
    t.equal(req.url, '/')
    res.statusCode = 200
    res.end()
  })
  t.teardown(target.close.bind(target))

  await new Promise(resolve => target.listen({ port: 0 }, resolve))

  instance.register(From, {
    base: `https://localhost:${target.address().port}`,
    globalAgent: true,
    http: {
    }
  })

  await new Promise(resolve => instance.listen({ port: 0 }, resolve))

  const result = await request(`https://localhost:${instance.server.address().port}`, {
    dispatcher: new Agent({
      connect: {
        rejectUnauthorized: false
      }
    })
  })

  t.equal(result.statusCode, 200)

  target.close()
})
