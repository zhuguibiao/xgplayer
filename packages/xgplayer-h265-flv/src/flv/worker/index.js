import {
  EVENTS,
  EVENTS_ERROR,
  MEDIA_TYPE,
  WASM_ERROR,
  WORKER_CMD_TYPE,
  WORKER_SEND_TYPE
} from '../constant'
import MyWorker from './worker.js?worker'
export default class DecoderWorker {
  constructor(player) {
    this.player = player
  }

  init() {
    this.decoderWorker = new MyWorker()
    this._initDecoderWorker()
  }
  destroy() {
    this.decoderWorker.postMessage({ cmd: WORKER_SEND_TYPE.close })
    this.decoderWorker.terminate()
    this.decoderWorker = null
    this.player.debug.log(`decoderWorker`, 'destroy')
  }

  _initDecoderWorker() {
    this.decoderWorker.postMessage({ cmd: WORKER_SEND_TYPE.init })
    this.decoderWorker.onmessage = event => {
      const msg = event.data
      switch (msg.cmd) {
        case WORKER_CMD_TYPE.init:
          // this._initWork();
          break
        case WORKER_CMD_TYPE.videoCode:
          break
        case WORKER_CMD_TYPE.render:
          this.player.displayVideoFrame(msg.data)
          break
        case WORKER_CMD_TYPE.wasmError:
          break
        default:
      }
    }
  }
  _initWork() {
    const opt = {
      debug: this.player._opt.debug,
      useOffscreen: this.player._opt.useOffscreen,
      useWCS: this.player._opt.useWCS,
      videoBuffer: this.player._opt.videoBuffer,
      videoBufferDelay: this.player._opt.videoBufferDelay,
      openWebglAlignment: this.player._opt.openWebglAlignment
    }
    this.decoderWorker.postMessage({
      cmd: WORKER_SEND_TYPE.init,
      opt: JSON.stringify(opt)
    })
  }

  decodeVideo(arrayBuffer, ts, isIFrame) {
    const options = {
      type: MEDIA_TYPE.video,
      ts: Math.max(ts, 0),
      isIFrame
    }
    this.decoderWorker.postMessage(
      {
        cmd: WORKER_CMD_TYPE.decode,
        buffer: arrayBuffer,
        options
      },
      [arrayBuffer.buffer]
    )
  }

  updateWorkConfig(config) {
    this.decoderWorker.postMessage({
      cmd: WORKER_SEND_TYPE.updateConfig,
      key: config.key,
      value: config.value
    })
  }
}
