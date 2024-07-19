import EventEmitter from 'eventemitter3'
import {
  NetLoader,
  Buffer,
  MSE,
  EVENT,
  StreamingError,
  BandwidthService,
  SeiService,
  GapService,
  MediaStatsService,
  isMediaPlaying,
  Logger,
  getVideoPlaybackQuality
} from 'xgplayer-streaming-shared'

import { Logger as TransmuxerLogger, FlvDemuxer } from 'xgplayer-transmuxer'
import { BufferService } from './services'
import { getOption } from './options'
import { searchKeyframeIndex } from './utils'
import { Flv } from './index'
import Player from './player'

export const logger = new Logger('flv')

export class FlvH265 extends EventEmitter {
  constructor(opts) {
    super()
    this._opts = getOption(opts)
    this.flvPlayer = null
    this.player = opts.player
    window.AudioContext =
      window.AudioContext || window.webkitAudioContext || window.mozAudioContext
    this.audioCtx = new AudioContext()
    this.audioStack = []
    this.audioTracks = { samples: [] }
    this.flvDecodeTime = 0
  }
  checkH265() {
    this.mediaLoader = new NetLoader({
      // ...this._opts.fetchOptions,
      onProgress: this._onCheckProgress,
      responseType: 'arraybuffer',
      finnalUrl: this._opts.url
    })
    this.FlvDemuxer = new FlvDemuxer()
    this.mediaLoader.load({ url: this._opts.url, range: false })
  }

  _onCheckProgress = chunk => {
    const { videoTrack } = this.FlvDemuxer
    try {
      this.FlvDemuxer.demuxAndFix(chunk)
    } catch (error) {}
    if (videoTrack.codec && !this._firstProgressEmit) {
      this._firstProgressEmit = true
      if (
        videoTrack.codecType == 'hevc' &&
        !MediaSource.isTypeSupported(`video/mp4;codecs=${videoTrack.codec}`)
      ) {
        this.mediaLoader.cancel()
        // this.player.destroy()
        // this.player.root.removeChild( this.player.root.querySelector('video'))
        this.player.root.removeChild(this.player.root.querySelector('.xgplayer-error'))
        this.flvPlayer = new Player(this.player.root)
        this.flvPlayer.decoderWorker.init()
        this.load()
      } else {
        this.mediaLoader.cancel()
        // this.flvPlayer = new Flv()
        // this.flvPlayer.load(this._opts.url, true)
      }
    }
  }
  load() {
    this._FlvDemuxer = new FlvDemuxer()
    this._mediaLoader = new NetLoader({
      ...this._opts.fetchOptions,
      onProgress: this._onProgress,
      responseType: 'arraybuffer'
    })
    this._mediaLoader.load({ url: this._opts.url, range: false })

    setTimeout(() => {
      // this.loopPlayBuffers()
      this._mediaLoader.cancel()
    }, 10000)
  }

  _onProgress = async chunk => {
    this.flvDecodeTime++
    var _this = this
    const { videoTrack, audioTrack } = this._FlvDemuxer
    try {
      this._FlvDemuxer.demuxAndFix(chunk)
    } catch (error) {}
    // console.log(audioTrack.samples, videoTrack.samples)
    if (videoTrack.samples && videoTrack.samples.length) {
      for (let index = 0; index < videoTrack.samples.length; index++) {
        const sample = videoTrack.samples[index]
        const u = []
        for (let index = 0; index < sample.units.length; index++) {
          const element = sample.units[index]
          u.push(this.setStartCode(element, false))
        }
        this.flvPlayer.decoderWorker.decodeVideo(this.concat(u), 1, 1)
      }
    }

    if (audioTrack.samples && audioTrack.samples.length) {
      console.log(audioTrack.samples)
      // this.audioTracks = { ...audioTrack, samples: this.audioTracks.samples }
      // this.audioTracks.samples = [...this.audioTracks.samples, ...audioTrack.samples]
      // if (this.flvDecodeTime == 5) {
      // let decodeAudioArray = this.getNewAac(this.audioTracks)
      let decodeAudioArray = this.getNewAac(audioTrack)
      // this.audioTracks = { samples: [] }
      this.audioCtx.decodeAudioData(
        decodeAudioArray.buffer,
        function (buffer) {
          console.log(buffer)
          // 将音频数据压入数组，等待播放
          _this.audioStack.push(buffer)
          _this.loopPlayBuffers()
        },
        function (e) {
          // console.error('decodeAudioData fail:', e)
        }
      )
      // }
      this.flvDecodeTime = 0
    }
  }

  /**
   * 获取添加adts头部信息的aac数据
   * @memberof flvAudioPlayer
   */
  getNewAac(aac) {
    const {
      objectType: audioObjectType,
      sampleRateIndex: samplingFrequencyIndex,
      channelCount: channelConfig
    } = aac
    let output = []
    let _this = this
    aac.samples.forEach(sample => {
      const headers = _this.getAdtsHeaders({
        audioObjectType: 5,
        samplingFrequencyIndex,
        channelConfig,
        adtsLen: sample.size + 7
      })
      output.push(...headers, ...sample.data)
    })
    console.log(aac.samples.length)
    return new Uint8Array(output)
  }

  /**
   * 计算adts头部, aac文件需要增加adts头部才能被audioContext decode
   * 添加aac头部参考：https://github.com/Xmader/flv2aac/blob/master/main.js
   */
  getAdtsHeaders(init) {
    const { audioObjectType, samplingFrequencyIndex, channelConfig, adtsLen } = init
    const headers = new Uint8Array(7)
    headers[0] = 0xff // syncword:0xfff                           高8bits
    headers[1] = 0xf0 // syncword:0xfff                           低4bits
    headers[1] |= 0 << 3 // MPEG Version:0 for MPEG-4,1 for MPEG-2   1bit
    headers[1] |= 0 << 1 // Layer:0                                  2bits
    headers[1] |= 1 // protection absent:1                      1bit

    headers[2] = (audioObjectType - 1) << 6 // profile:audio_object_type - 1                      2bits
    headers[2] |= (samplingFrequencyIndex & 0x0f) << 2 // sampling frequency index:sampling_frequency_index  4bits
    headers[2] |= 0 << 1 // private bit:0                                      1bit
    headers[2] |= (channelConfig & 0x04) >> 2 // channel configuration:channel_config               高1bit

    headers[3] = (channelConfig & 0x03) << 6 // channel configuration：channel_config     低2bits
    headers[3] |= 0 << 5 // original：0                               1bit
    headers[3] |= 0 << 4 // home：0                                   1bit
    headers[3] |= 0 << 3 // copyright id bit：0                       1bit
    headers[3] |= 0 << 2 // copyright id start：0                     1bit

    headers[3] |= (adtsLen & 0x1800) >> 11 // frame length：value    高2bits
    headers[4] = (adtsLen & 0x7f8) >> 3 // frame length：value    中间8bits
    headers[5] = (adtsLen & 0x7) << 5 // frame length：value    低3bits
    headers[5] |= 0x1f // buffer fullness：0x7ff 高5bits
    headers[6] = 0xfc

    return headers
  }

  loopPlayBuffers = async () => {
    var _this = this
    if (this.audioStack.length == 0) {
      return
    }
    var buffer = this.audioStack.shift()

    if (this.audioBufferSourceNode) {
      this.audioBufferSourceNode.stop(0)
    }

    this.audioBufferSourceNode = this.audioCtx.createBufferSource()
    this.audioBufferSourceNode.buffer = buffer
    this.audioBufferSourceNode.connect(this.audioCtx.destination)
    this.audioBufferSourceNode.start(0, 0, buffer.duration)
    this.audioBufferSourceNode.onended = function (e) {
      // console.log(e)
      _this.loopPlayBuffers()
    }
  }
  setStartCode = function (dataStream, replace = false) {
    let returnStream = null
    const DEFINE_STARTCODE = new Uint8Array([0, 0, 0, 1])
    if (replace) {
      returnStream = dataStream
      returnStream[0] = DEFINE_STARTCODE[0]
      returnStream[1] = DEFINE_STARTCODE[1]
      returnStream[2] = DEFINE_STARTCODE[2]
      returnStream[3] = DEFINE_STARTCODE[3]
    } else {
      returnStream = new Uint8Array(DEFINE_STARTCODE.length + dataStream.length)
      returnStream.set(DEFINE_STARTCODE, 0)
      returnStream.set(dataStream, DEFINE_STARTCODE.length)
    }

    return returnStream
  }

  concat(arrays) {
    let totalLength = arrays.reduce((acc, value) => acc + value.length, 0)
    let result = new Uint8Array(totalLength)
    if (!arrays.length) return result
    let length = 0
    for (let array of arrays) {
      result.set(array, length)
      length += array.length
    }
    return result
  }
}
