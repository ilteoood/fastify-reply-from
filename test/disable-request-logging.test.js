'use strict'

const t = require('tap')
const Fastify = require('fastify')
const { request } = require('undici')
const From = require('..')
const http = require('node:http')
const split = require('split2')

const target = http.createServer((req, res) => {
  t.assert.ok('request proxied')
  t.assert.deepEqual(req.method, 'GET')
  t.assert.deepEqual(req.url, '/')
  t.assert.deepEqual(req.headers.connection, 'keep-alive')
  res.statusCode = 205
  res.setHeader('Content-Type', 'text/plain')
  res.setHeader('x-my-header', 'hello!')
  res.end('hello world')
})

t.test('use a custom instance of \'undici\'', async t => {
  t.plan(3)
  t.after(() => target.close())

  await new Promise((resolve, reject) => target.listen({ port: 0 }, err => err ? reject(err) : resolve()))

  t.test('disableRequestLogging is set to true', async t => {
    const logStream = split(JSON.parse)
    const instance = Fastify({
      logger: {
        level: 'info',
        stream: logStream
      }
    })
    t.after(() => instance.close())
    instance.register(From, {
      base: `http://localhost:${target.address().port}`,
      disableRequestLogging: true
    })

    instance.get('/', (_request, reply) => {
      reply.from()
    })

    logStream.on('data', (log) => {
      if (
        log.level === 30 &&
        (
          !log.msg.match('response received') ||
          !log.msg.match('fetching from remote server')
        )
      ) {
        t.assert.ok('request log message does not logged')
      }
    })

    await new Promise(resolve => instance.listen({ port: 0 }, resolve))

    const result = await request(`http://localhost:${instance.server.address().port}`)
    t.assert.deepEqual(result.headers['content-type'], 'text/plain')
    t.assert.deepEqual(result.headers['x-my-header'], 'hello!')
    t.assert.deepEqual(result.statusCode, 205)
    t.assert.deepEqual(await result.body.text(), 'hello world')
  })

  t.test('disableRequestLogging is set to false', async t => {
    const logStream = split(JSON.parse)
    const instance = Fastify({
      logger: {
        level: 'info',
        stream: logStream
      }
    })
    t.after(() => instance.close())
    instance.register(From, {
      base: `http://localhost:${target.address().port}`,
      disableRequestLogging: false
    })

    instance.get('/', (_request, reply) => {
      reply.from()
    })

    logStream.on('data', (log) => {
      if (
        log.level === 30 &&
        (
          log.msg.match('response received') ||
          log.msg.match('fetching from remote server')
        )
      ) {
        t.assert.ok('request log message does not logged')
      }
    })

    await new Promise(resolve => instance.listen({ port: 0 }, resolve))

    const result = await request(`http://localhost:${instance.server.address().port}`)
    t.assert.deepEqual(result.headers['content-type'], 'text/plain')
    t.assert.deepEqual(result.headers['x-my-header'], 'hello!')
    t.assert.deepEqual(result.statusCode, 205)
    t.assert.deepEqual(await result.body.text(), 'hello world')
  })

  t.test('disableRequestLogging is not defined', async t => {
    const logStream = split(JSON.parse)
    const instance = Fastify({
      logger: {
        level: 'info',
        stream: logStream
      }
    })
    t.after(() => instance.close())
    instance.register(From, {
      base: `http://localhost:${target.address().port}`
    })

    instance.get('/', (_request, reply) => {
      reply.from()
    })

    logStream.on('data', (log) => {
      if (
        log.level === 30 &&
        (
          log.msg.match('response received') ||
          log.msg.match('fetching from remote server')
        )
      ) {
        t.assert.ok('request log message does not logged')
      }
    })

    await new Promise(resolve => instance.listen({ port: 0 }, resolve))

    const result = await request(`http://localhost:${instance.server.address().port}`)
    t.assert.deepEqual(result.headers['content-type'], 'text/plain')
    t.assert.deepEqual(result.headers['x-my-header'], 'hello!')
    t.assert.deepEqual(result.statusCode, 205)
    t.assert.deepEqual(await result.body.text(), 'hello world')
  })
})
