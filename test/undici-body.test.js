'use strict'

const t = require('tap')
const Fastify = require('fastify')
const From = require('..')
const http = require('node:http')
const get = require('simple-get').concat

const instance = Fastify()

t.plan(9)
t.teardown(instance.close.bind(instance))

const bodyString = JSON.stringify({ hello: 'world' })

const parsedLength = Buffer.byteLength(bodyString)

const target = http.createServer((req, res) => {
  t.pass('request proxied')
  t.equal(req.method, 'POST')
  t.equal(req.headers['content-type'], 'application/json')
  t.same(req.headers['content-length'], parsedLength)
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

t.teardown(target.close.bind(target))

target.listen({ port: 0 }, (err) => {
  t.error(err)

  instance.addContentTypeParser('application/json', function (_req, payload, done) {
    done(null, payload)
  })

  instance.register(From, {
    base: `http://localhost:${target.address().port}`,
    undici: true
  })

  instance.listen({ port: 0 }, (err) => {
    t.error(err)

    get({
      url: `http://localhost:${instance.server.address().port}`,
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: bodyString
    }, (err, _res, data) => {
      t.error(err)
      const parsed = JSON.parse(data)
      t.same(parsed, { something: 'else' })
    })
  })
})
