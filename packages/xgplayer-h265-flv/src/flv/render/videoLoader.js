import {
  CONTROL_HEIGHT,
  EVENTS,
  SCREENSHOT_TYPE,
  VIDEO_ENC_TYPE,
} from "../constant";
import { dataURLToFile, downloadImg, getBrowser, now } from "../utils";
import CommonLoader from "./common.js";

export default class VideoLoader extends CommonLoader {
  constructor(player) {
    super();
    this.player = player;
    const $videoElement = document.createElement("video");
    const $canvasElement = document.createElement("canvas");
    $canvasElement.style.position = "absolute";
    $canvasElement.style.top = 0;
    $canvasElement.style.left = 0;
    $canvasElement.style.width = '100%';
    $canvasElement.width = '480';
    $canvasElement.height = '270';
    $canvasElement.style.height = '100%';


    this.$canvasElement = $canvasElement;
    this.$videoElement = $videoElement;

    $videoElement.muted = true;
    $videoElement.disablePictureInPicture = true;
    $videoElement.controls = "true";
    $videoElement.style.position = "absolute";
    $videoElement.style.top = 0;
    $videoElement.style.left = 0;
    $videoElement.style.width = '100%';
    $videoElement.style.height = '100%';
    
    this._delayPlay = false;
    player.$container.appendChild($canvasElement);
    player.$container.appendChild($videoElement);
    this.videoInfo = {
      width: "",
      height: "",
      encType: "",
    };
    const _opt = this.player._opt;
    this.$videoElement = $videoElement;
    this.resize();

    this.$videoElement.addEventListener("canplay", () => {
      if (this._delayPlay) {
        this.player.debug.log(
          "Video",
          `canplay and _delayPlay is true and next play()`
        );
        this._play();
      }
    });

    // proxy(this.$videoElement, "timeupdate", (event) => {
    //   // this.player.emit(EVENTS.videoTimeUpdate, event.timeStamp);
    //   const timeStamp = parseInt(event.timeStamp, 10);
    //   this.player.emit(EVENTS.timeUpdate, timeStamp);
    //   // check is pause;
    //   if (!this.isPlaying() && this.init) {
    //     this.player.debug.log(
    //       "Video",
    //       `timeupdate and this.isPlaying is false and retry play`
    //     );
    //     this.$videoElement.play();
    //   }
    // });

    this.player.debug.log("Video", "init");
  }

  destroy() {
    super.destroy();
    this.$canvasElement = null;
    if (this.$videoElement) {
      this.$videoElement.pause();
      this.$videoElement.currentTime = 0;
      this.$videoElement.src = "";
      this.$videoElement.removeAttribute("src");
      this.$videoElement = null;
    }
    if (this.trackGenerator) {
      this.trackGenerator.stop();
      this.trackGenerator = null;
    }
    if (this.vwriter) {
      this.vwriter.close();
      this.vwriter = null;
    }
    this.player.debug.log("Video", "destroy");
  }

  fixChromeVideoFlashBug() {
    const browser = getBrowser();
    const type = browser.type.toLowerCase();
    if (type === "chrome" || type === "edge") {
      const $container = this.player.$container;
      $container.style.backdropFilter = "blur(0px)";
      $container.style.translateZ = "0";
    }
  }

  play() {
    if (this.$videoElement) {
      const readyState = this._getVideoReadyState();
      this.player.debug.log("Video", `play and readyState: ${readyState}`);
      if (readyState === 0) {
        this.player.debug.warn(
          "Video",
          "readyState is 0 and set _delayPlay to true"
        );
        this._delayPlay = true;
        return;
      }
      this._play();
    }
  }

  _getVideoReadyState() {
    let result = 0;
    if (this.$videoElement) {
      result = this.$videoElement.readyState;
    }
    return result;
  }

  _play() {
    this.$videoElement &&
      this.$videoElement
        .play()
        .then(() => {
          this._delayPlay = false;
          this.player.debug.log("Video", "_play success");
          setTimeout(() => {
            if (!this.isPlaying()) {
              this.player.debug.warn("Video", `play failed and retry play`);
              this._play();
            }
          }, 100);
        })
        .catch((e) => {
          this.player.debug.error("Video", "_play error", e);
        });
  }

  pause(isNow) {
    // 预防
    // https://developer.chrome.com/blog/play-request-was-interrupted/
    // http://alonesuperman.com/?p=23
    if (isNow) {
      this.$videoElement && this.$videoElement.pause();
    } else {
      setTimeout(() => {
        this.$videoElement && this.$videoElement.pause();
      }, 100);
    }
  }

  clearView() {}

  initCanvasViewSize() {
    this.resize();
  }

  //
  render(msg) {
    if (this.vwriter) {
      this.vwriter.write(msg.videoFrame);
    }
  }

  resize() {
    let width = this.player.width;
    let height = this.player.height;
    const option = this.player._opt;
    const rotate = option.rotate;
    if (option.hasControl && !option.controlAutoHide) {
      height -= CONTROL_HEIGHT;
    }

    this.$videoElement.width = width;
    this.$videoElement.height = height;

    if (rotate === 270 || rotate === 90) {
      this.$videoElement.width = height;
      this.$videoElement.height = width;
    }
    let resizeWidth = this.$videoElement.width;
    let resizeHeight = this.$videoElement.height;
    let left = (width - resizeWidth) / 2;
    let top = (height - resizeHeight) / 2;
    let objectFill = "contain";

    // 默认是true
    // 视频画面做等比缩放后,高或宽对齐canvas区域,画面不被拉伸,但有黑边

    // 视频画面完全填充canvas区域,画面会被拉伸
    if (!option.isResize) {
      objectFill = "fill";
    }

    // 视频画面做等比缩放后,完全填充canvas区域,画面不被拉伸,没有黑边,但画面显示不全
    if (option.isFullResize) {
      objectFill = "none";
    }
    this.$videoElement.style.objectFit = objectFill;
    this.$videoElement.style.transform = "rotate(" + rotate + "deg)";
    this.$videoElement.style.left = left + "px";
    this.$videoElement.style.top = top + "px";
  }

  isPlaying() {
    return this.$videoElement && !this.$videoElement.paused;
  }
}
