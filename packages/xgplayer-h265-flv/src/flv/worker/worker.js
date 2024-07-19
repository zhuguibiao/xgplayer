import Module from "../wasm/libffmpeg_264_265.js";
import { WORKER_CMD_TYPE, MEDIA_TYPE } from "../constant";

class WasmDecoder {
  constructor() {
    this.buffer = [];
    // this.initModule();
  }
  decodeVideo(arrayBuffer, ts, isIFrame) {
    var size = arrayBuffer.length;
    var cacheBuffer = this.Module._malloc(size);
    this.Module.HEAPU8.set(arrayBuffer, cacheBuffer);
    this.Module._decodeData(cacheBuffer, size, ts);
    if (cacheBuffer != null) {
      this.Module._free(cacheBuffer);
      cacheBuffer = null;
    }
  }
  async initModule() {
    var _this = this;
    const M = await Module();
    _this.Module = M;
    var videoCallback = _this.Module.addFunction(function (
      yuvData,
      width,
      height,
      pts
    ) {
      if (!yuvData) return;
      let size =
        width * height +
        (width / 2) * (height / 2) +
        (width / 2) * (height / 2);
      let tmp = _this.Module.HEAPU8.subarray(yuvData, yuvData + size);
      let data = new Uint8Array(tmp);
      var obj = {
        data: data,
        width,
        height,
      };
      postMessage({
        cmd: WORKER_CMD_TYPE.render,
        data: obj,
        ts: 0,
      });
    },
      "viiii");

    var ret = this.Module._openDecoder(1, videoCallback, 0);
    if (ret == 0) {
      console.log("openDecoder success");
      postMessage({
        cmd: WORKER_CMD_TYPE.init,
        data: 1,
      });
      this.initPlay();
    } else {
      console.error("openDecoder failed with error", ret);
      return;
    }
  }
  pushBuffer(bufferData, options) {
    if (options.type === MEDIA_TYPE.video) {
      this.buffer.push({
        ts: options.ts,
        payload: bufferData,
        type: MEDIA_TYPE.video,
        isIFrame: options.isIFrame,
      });
    }
  }
  initPlay() {
    const loop = () => {
      if (this.buffer.length) {
        var data = this.buffer.shift();
        this.decodeVideo(data.payload, data.ts);
      } else {

      }
    };
    this.stopId = setInterval(loop, 10);
  }
  close() {
    console.log("close");
    clearInterval(this.stopId);
    this.Module.flushDecoder();
    this.Module.closeDecoder();
  }
}

self.decoder = new WasmDecoder();
self.onmessage = function (evt) {
  const msg = evt.data;
  switch (msg.cmd) {
    case WORKER_CMD_TYPE.init:
      self.decoder.initModule();
      break;
    case WORKER_CMD_TYPE.decode:
      self.decoder.pushBuffer(msg.buffer, msg.options);
      break;
    case WORKER_CMD_TYPE.videoCode:
      self.decoder.decodeVideo(msg.buffer, msg.options.ts);
      break;
    case WORKER_CMD_TYPE.render:
      break;
    case WORKER_CMD_TYPE.wasmError:
      break;
    case WORKER_CMD_TYPE.close:
      self.decoder.close();
      break;
    default:
  }
};
