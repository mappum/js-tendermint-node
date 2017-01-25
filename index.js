'use strict'

const { spawn } = require('child_process')
const EventEmitter = require('events')
const url = require('url')
const RpcClient = require('tendermint')
const old = require('old')

const binaryPath = require.resolve('./tendermint')

class Node extends EventEmitter {
  constructor (opts = {}, onReady) {
    super()
    if (typeof opts === 'function') {
      onReady = opts
      opts = {}
    }
    if (onReady) this.once('ready', onReady)
    console.log(onReady)

    let rpcAddress = opts.rpcAddress || 'tcp://0.0.0.0:46657'
    let args = [
      'node',
      `--log_level=${opts.logLevel || 'notice'}`,
      `--moniker=${opts.moniker || 'anonymous'}`,
      `--node_laddr=${opts.nodeAddress || 'tcp://0.0.0.0:46656'}`,
      `--proxy_app=${opts.proxyApp || 'tcp://127.0.0.1:46658'}`,
      `--rpc_laddr=${rpcAddress}`
    ]
    let child = this.child = spawn(binaryPath, args)
    child.on('error', (err) => this.emit('error', err))

    let waitForRpc = (data) => {
      data = data.toString()
      if (!data.includes('Starting RPC HTTP server')) return
      child.stdout.removeListener('data', waitForRpc)

      let { port } = url.parse(rpcAddress)
      this.rpc = RpcClient(`ws://localhost:${port}/websocket`)
      this.rpc.on('error', (err) => this.emit('error', err))
      for (let k in this.rpc) {
        if (typeof this.rpc[k] !== 'function') continue
        if (this[k] != null) continue
        this[k] = this.rpc[k].bind(this.rpc)
      }

      this.emit('ready', this)
    }
    child.stdout.on('data', waitForRpc)
  }

  kill (signal) {
    this.child.kill(signal)
  }
}

module.exports = old(Node)
