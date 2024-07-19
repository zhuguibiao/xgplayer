import { DEFAULT_PLAYER_OPTIONS } from '../constant'
import WebGLPlayer from '../render/webgl'
import DecoderWorker from '../worker/index'
export default class Player {
  constructor(container, options) {
    this.$container = container
    this.$container.style.position = 'relative'
    this._opt = Object.assign({}, DEFAULT_PLAYER_OPTIONS, options)
    var $canvasElement = document.createElement('canvas')

    $canvasElement.style.position = 'absolute'
    $canvasElement.style.zIndex = 1
    $canvasElement.style.top = 0
    $canvasElement.style.left = 0
    $canvasElement.style.width = '100%'
    $canvasElement.width = '480'
    $canvasElement.height = '270'
    $canvasElement.style.height = '100%'
    this.$container.appendChild($canvasElement)

    this.$canvasElement = $canvasElement

    this.decoderWorker = new DecoderWorker(this)
  }

  displayVideoFrame(obj) {
    var data = new Uint8Array(obj.data)
    var width = obj.width
    var height = obj.height
    var yLength = width * height
    var uvLength = (width / 2) * (height / 2)
    if (!this.webglPlayer) {
      this.webglPlayer = new WebGLPlayer(this.$canvasElement, {
        preserveDrawingBuffer: false
      })
    }
    this.webglPlayer.renderFrame(data, width, height, yLength, uvLength)
  }

  /**
   * @param url
   * @returns {Promise<unknown>}
   */
  play(url, options) {}

  pause() {
    this.destroy()
  }
}
