import {
  CONTROL_HEIGHT,
  EVENTS,
  SCREENSHOT_TYPE,
  VIDEO_ENC_TYPE,
} from "../constant";
import { dataURLToFile, downloadImg, getBrowser, now } from "../utils";
import CommonLoader from "./common.js";

export default class NativeRenderLoader extends CommonLoader {
  constructor(player) {
    super();
    this.player = player;
    const $videoElement = document.createElement("video");
    this.$videoElement = $videoElement;
    $videoElement.muted = true;
    $videoElement.disablePictureInPicture = true;
    $videoElement.controls = "true";
    $videoElement.style.position = "absolute";
    $videoElement.style.top = 0;
    $videoElement.style.left = 0;
    $videoElement.style.width = "100%";
    $videoElement.style.height = "100%";

    this._delayPlay = false;
    player.$container.appendChild($videoElement);
    this.videoInfo = {
      width: "",
      height: "",
      encType: "",
    };
    const _opt = this.player._opt;
    this.$videoElement = $videoElement;

    this.$videoElement.addEventListener("canplay", () => {
      if (this._delayPlay) {
        this._play();
      }
    });
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
  }

  isPlaying() {
    return this.$videoElement && !this.$videoElement.paused;
  }
}
