/**
 * @fileoverview A CMU CREATE Lab Time Machine-esque timeslider for videos.
 * @author Paul Dille
 */

/**
 * A time slider for interacting with a video
 *
 * @constructor
 * @param  {object} config Options to set in this VideoTimeControls
 * @requires JQuery
 * @requires JQueryUI
 */

"use strict";

var VideoTimeControls = function (config) {
  // TODO
  this.startDwell_ = config.startDwell || 0;

  // TODO
  this.endDwell_ = config.endDwell || 0;

  this.fps_ = config.videoFps || 12;

  this.videoId_ = config.videoId;

  this.id_ = config.id || "video-time-slider-controls-" + new Date().getTime();

  this.sliderColor_ = config.sliderColor || "red";

  this.video_ = $("#" + this.videoId_)[0];

  this.$videoContainer_ = $("<div>", {id: this.id_, class: "video-time-slider-controls-container"});

  this.playOnLoad_ = typeof(config.playOnLoad) != "undefined" ? config.playOnLoad : true;

  this.loop_ = config.loop || this.video_.loop || true;

  this.video_.loop = this.loop_;

  this.loadedUI_ = false;

  this.captureTimes_ = config.captureTimes;

  this.startTimeInMs_ = config.startTimeInMs;

  this.requestAnimationFrameId_ = null;

  this.startSlideDrag_ = false;

  this.isFullScreen_ = false;

  this.isFillScreen_ = false;

  this.preFullScreenProperties_ = {};

  this.lastVideoTime_ = 0;

  this.lastCaptureTimeStr_ = "";

  this.keysDown_ = [];

  this.$captureTimeElm_ = "";

  this.showTimestamps_ = typeof(config.showTimestamps) != "undefined" ? config.showTimestamps : true;

  this.showSpeedControls_ = typeof(config.showSpeedControls) != "undefined" ? config.showSpeedControls : true;

  this.showFullscreenControls_ = typeof(config.showFullscreenControls) != "undefined" ? config.showFullscreenControls : true;

  this.isMobileDevice_ = !(navigator.userAgent.match(/CrOS/) != null) &&
    (navigator.userAgent.match(/Android/i) ||
     navigator.userAgent.match(/webOS/i) || navigator.userAgent.match(/iPhone/i) ||
     navigator.userAgent.match(/iPad/i) ||
     navigator.userAgent.match(/iPod/i) ||
     navigator.userAgent.match(/BlackBerry/i) ||
     navigator.userAgent.match(/Windows Phone/i) ||
     navigator.userAgent.match(/Mobile/i)) != null;

  this.template_ = '<div class="controls" style="display: none">';

  if (this.showTimestamps_) {
    this.template_ += '\
      <div id="captureTimeContainer" class="captureTime" title="Capture time"> \
        <div class="currentCaptureTime"><div class="captureTimeMain"><div id="currentTime"></div></div></div> \
      </div>';
  }

  this.template_ += '\
      <div id="timelineSliderContainer" class="timelineSliderFiller"> \
        <div id="Tslider1" class="timelineSlider"></div> \
      </div>';

  if (this.showFullscreenControls_) {
    this.template_ += '<div title="Toggle full screen" id="fullScreenContainer" class="fullScreen"></div>';
  }

  this.template_ += '<div title="Play" class="playbackButton"></div>';

  if (this.showSpeedControls_) {
    this.template_ += '\
      <button class="toggleSpeed" id="fastSpeed" title="Toggle playback speed">Fast</button> \
      <button class="toggleSpeed" id="mediumSpeed" title="Toggle playback speed">Medium</button> \
      <button class="toggleSpeed" id="slowSpeed" title="Toggle playback speed">Slow</button>';
  }

  this.template_ += '</div>';

  // Add the template to the DOM
  this.render_();

  if (!this.showSpeedControls_ && !this.showTimestamps_) {
    $("#" + this.id_ + " #timelineSliderContainer, " + "#" + this.id_ + " #fullScreenContainer").addClass("noTimestamps noSpeedControls");
  } else if (!this.showSpeedControls_ && this.showTimestamps_) {
    $("#" + this.id_ + " #captureTimeContainer").addClass("noSpeedControls");
  }

  this.initEvents_();

  // For the case where 'loadeddata' didn't fire because the listener was added too late
  if (!this.loadedUI_ && this.video_.readyState > 2) {
    this.onFirstLoad_();
  }
};


/**
 * Sets to a new array of capture time string
 * @public
 * @param {newCaptureTimes} Array of strings
 */
VideoTimeControls.prototype.setCaptureTimes = function(newCaptureTimes) {
  this.captureTimes_ = newCaptureTimes;
};


/**
 * Returns the duration of the video
 * @public
 * @returns {number}
 */
VideoTimeControls.prototype.getDuration = function() {
  return this.video_.duration;
};


/**
 * Returns the current time of the video
 * @public
 * @returns {number}
 */
VideoTimeControls.prototype.getCurrentTime = function() {
  return this.video_.currentTime;
};


/**
 * Returns the frame rate of the video
 * @public
 * @returns {number}
 */
VideoTimeControls.prototype.getFps = function() {
  return this.fps_;
};


/**
 * Returns the number of frames in the video
 * @public
 * @returns {number}
 */
VideoTimeControls.prototype.getNumFrames = function() {
  return Math.ceil(this.getDuration() * this.getFps());
};


/**
 * Returns the source of the video
 * @public
 * @returns {string}
 */
VideoTimeControls.prototype.getSrc = function() {
  return this.video_.src;
};


/**
 * Returns the play state of the video
 * @public
 * @returns {bool}
 */
VideoTimeControls.prototype.isPaused = function() {
  return this.video_.paused;
};


/**
 * Load a new video
 * @public
 * @param {config} Key value pair of video options
 */
VideoTimeControls.prototype.loadNewVideo = function(config) {
  this.video_.src = config.videoSrc;
  this.fps_ = config.videoFps || this.fps_;

  $("#" + this.id_ + " #timelineSliderContainer .timelineSlider").slider("value", 0);

  if (typeof(config.playOnLoad) !== undefined) {
    this.playOnLoad_ = config.playOnLoad;
  }

  if (typeof(config.loop) !== undefined) {
    this.loop_ = config.loop;
    this.video_.loop = this.loop_;
  }

  if (this.playOnLoad_) {
    this.video_.load();
  }

  this.setInitialTimelineUIState_();
};


/**
 * Play/Pause the video
 * @public
 */
VideoTimeControls.prototype.togglePlayPause = function() {
  $("#" + this.id_ + " .playbackButton").trigger("click");
};


/**
 * Set the initial UI for the play/pause button when a video is loaded
 * @private
 */
VideoTimeControls.prototype.setInitialTimelineUIState_ = function() {
  var $playbackButton = $("#" + this.id_ + " .playbackButton");

  if (this.playOnLoad_) {
    $playbackButton.removeClass("play").addClass("pause").attr("title", "Pause");
    $playbackButton.button({icons: {secondary: "ui-icon-custom-pause"}});
  } else {
    $playbackButton.removeClass("pause").addClass("play").attr("title", "Play");
    $playbackButton.button({icons: {secondary: "ui-icon-custom-play"}});
  }
};


/**
 * Insert the html template string for the time slider into the DOM
 * @private
 */
VideoTimeControls.prototype.render_ = function() {
  this.$videoContainer_.insertBefore($(this.video_));
  document.getElementById(this.id_).innerHTML = this.template_;
  $(this.video_).prependTo(this.$videoContainer_);
  this.$captureTimeElm_ = $("#" + this.id_ + " #currentTime");
  this.$videoContainer_.css({
    "position" : "absolute",
    "background" : "black"
  });

  // Chromium bug (https://bugs.chromium.org/p/chromium/issues/detail?id=382879)
  // Need to play the video again (if it was playing) after moving it in the DOM
  if (this.playOnLoad_) {
    this.video_.play();
  }
};


VideoTimeControls.prototype.onFirstLoad_ = function() {
  if (!this.loadedUI_) {
    this.initUI_();
  }
  if (this.playOnLoad_ && this.video_.paused) {
    if ($("#" + this.id_ + " .playbackButton").hasClass("pause")) {
      this.video_.play();
    } else {
      this.togglePlayPause();
    }
  }
  $(this.video_).trigger("resize");
  this.requestUpdateFunction_();
};


/**
 * Setup DOM events
 * @private
 */
VideoTimeControls.prototype.initEvents_ = function() {
  var that = this;

  $(window).on("resize", function() {
    if (that.isFillScreen_) {
      $(that.video_).css({
        "width" : $(window).width(),
        "height" : $(window).height() - $("#" + that.id_ + " .controls").outerHeight(),
      });
    }
  });

  $(that.video_).on("resize", function() {
    $("#" + that.id_ + " .controls").css({
      "width" : $(that.video_).width() + "px"
    }).show();
  }).on("loadeddata", function() {
    that.onFirstLoad_();
  }).on("click", function() {
    $("#" + that.id_ + " .playbackButton").trigger("click");
  });

  $(document).on("keydown", function(e) {
    switch(e.keyCode) {
      // Play/pause on space bar
      case 32:
        that.togglePlayPause();
        break;
      // Left/Right arrows
      case 37:
      case 39:
        $("#" + that.id_ + " .ui-slider-handle").trigger("focus");
        break;
      // 'a' key
      case 65:
        if (!that.video_.paused) {
          $("#" + that.id_ + " .playbackButton").trigger("click");
        }
        that.video_.currentTime = 0;
        that.updateTimeControls_();
        break;
      // 's' key
      case 83:
        if (!that.video_.paused) {
          $("#" + that.id_ + " .playbackButton").trigger("click");
        }
        that.video_.currentTime = that.video_.duration;
        that.updateTimeControls_();
        break;
    }
    that.keysDown_.push(e.keyCode);
  }).on("keyup", function(e) {
    that.keysDown_.length = 0;
  });

  $(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange', function() {
    that.isFullScreen_ = !that.isFullScreen_;
    if (that.isFullScreen_ && !that.isMobileDevice_) {
      $("#" + that.id_ + " .controls").css({
        "zIndex" : 2147483647,
      });
    } else {
      $("#" + that.id_ + " .controls").css({
        "zIndex" : 10,
      });
    }
    $("#" + that.id_ + " #fullScreenContainer").button({
      icons: {
        primary: that.isFullScreen_ ? "ui-icon-custom-fullScreenOff" : "ui-icon-custom-fullScreenOn"
      }
    });

  });
};


/**
 * Run during each animation frame
 * @private
 */
VideoTimeControls.prototype.requestUpdateFunction_ = function() {
  if (!this.video_.paused) {
    this.updateTimeControls_();
  }
  this.requestAnimationFrameId_ = this.requestAnimFrame_.call(window, this.requestUpdateFunction_.bind(this));
};


VideoTimeControls.prototype.updateTimeControls_ = function() {
  $("#" + this.id_ + " #timelineSliderContainer .timelineSlider").slider("value", Math.ceil(this.video_.currentTime * this.getFps() - 0.1));
  this.renderCurrentTime_();
};


/**
 * Initialize the play/pause button
 * @private
 */
VideoTimeControls.prototype.initPlaybackButton_ = function() {
  var $playbackButton = $("#" + this.id_ + " .playbackButton");
  var that = this;

  $playbackButton.button({
    icons: {
      secondary: "ui-icon-custom-play"
    },
    text: false
  }).on("click", function() {
    if ($playbackButton.attr("title") == "Play") {
      $playbackButton.removeClass("play").addClass("pause").attr("title", "Pause");
      $playbackButton.button({icons: {secondary: "ui-icon-custom-pause"}});
      that.video_.play();
      that.requestUpdateFunction_();
    } else {
      $playbackButton.removeClass("pause").addClass("play").attr("title", "Play");
      $playbackButton.button({icons: {secondary: "ui-icon-custom-play"}});
      that.video_.pause();
      if (that.requestAnimationFrameId_) {
        that.cancelAnimFrame_.call(window, that.requestAnimationFrameId_);
        that.requestAnimationFrameId_ = null;
      }
    }
  });
};


/**
 * Initialize the play/pause button
 * @private
 */
VideoTimeControls.prototype.initFullScreenButton_ = function() {
  var $fullScreenButton = $("#" + this.id_ + " #fullScreenContainer");
  var that = this;

  $fullScreenButton.button({
    icons: {
      primary: "ui-icon-custom-fullScreenOn"
    },
    text: false
  }).on("click", function() {
    that.handleFullScreen_();
  });
};


/**
 * Initialize the animationRate control button for fast speed
 * @private
 */
VideoTimeControls.prototype.initFastSpeedButton_ = function() {
  var $fastSpeedButton = $("#" + this.id_ + " #fastSpeed");
  var $mediumSpeedButton = $("#" + this.id_ + " #mediumSpeed");
  var $controls = $("#" + this.id_ + " .controls");
  var that = this;

  $fastSpeedButton.button({
    text: true
  }).click(function() {
    $controls.prepend($mediumSpeedButton);
    $mediumSpeedButton.stop(true, true).show();
    $fastSpeedButton.slideUp(300);
    that.video_.playbackRate = 0.5;
  });
  $fastSpeedButton.show();
};


/**
 * Initialize the animationRate control button for medium speed
 * @private
 */
VideoTimeControls.prototype.initMediumSpeedButton_ = function() {
  var $mediumSpeedButton = $("#" + this.id_ + " #mediumSpeed");
  var $slowSpeedButton = $("#" + this.id_ + " #slowSpeed");
  var $controls = $("#" + this.id_ + " .controls");
  var that = this;

  $mediumSpeedButton.button({
    text: true
  }).click(function() {
    $controls.prepend($slowSpeedButton);
    $slowSpeedButton.stop(true, true).show();
    $mediumSpeedButton.slideUp(300);
    that.video_.playbackRate = 0.25;
  });
};


/**
 * Initialize the animationRate control button for slow speed
 * @private
 */
VideoTimeControls.prototype.initSlowSpeedButton_ = function() {
  var $slowSpeedButton = $("#" + this.id_ + " #slowSpeed");
  var $fastSpeedButton = $("#" + this.id_ + " #fastSpeed");
  var $controls = $("#" + this.id_ + " .controls");
  var that = this;

  $slowSpeedButton.button({
    text: true
  }).click(function() {
    $controls.prepend($fastSpeedButton);
    $fastSpeedButton.stop(true, true).show();
    $slowSpeedButton.slideUp(300);
    that.video_.playbackRate = 1.0;
  });
};


/**
 * Initialize the time slider bar
 * @private
 */
VideoTimeControls.prototype.initTimelineSlider_ = function() {
  var $timelineSlider = $("#" + this.id_ + " #timelineSliderContainer .timelineSlider");
  var that = this;
  $timelineSlider.slider({
    min: 0,
    max: that.getNumFrames() - 1, // this way the time scrubber goes exactly to the end of timeline
    range: "min",
    step: 1,
    slide: function(e, ui) {
      var newTime = ((ui.value + 0.1) / that.getFps());
      that.video_.currentTime = newTime;
      that.renderCurrentTime_();
    },
    start: function(e, ui) {
      if (that.startSlideDrag_) return;
      that.startSlideDrag_ = true;
      that.wasPlaying_ = !that.video_.paused;
      that.video_.pause();
    },
    stop: function(e, ui) {
      that.startSlideDrag_ = false;
      if (that.wasPlaying_) {
        that.video_.play();
      }
    }
  }).removeClass("ui-corner-all").children().removeClass("ui-corner-all");
  $("#" + this.id_ + " #timelineSliderContainer .timelineSlider .ui-slider-handle").attr("title", "Drag to go to a different point in time");
};


VideoTimeControls.prototype.getCurrentCaptureTime = function() {
  var currentVideoTime = this.video_.currentTime;

  if (currentVideoTime == this.lastVideoTime_) return "";

  this.lastVideoTime_ = currentVideoTime;

  if (this.captureTimes_ && this.captureTimes_.length) {
    var currentCaptureTimeIdx = $("#" + this.id_ + " #timelineSliderContainer .timelineSlider").slider("value");
    var newCaptureTime = this.captureTimes_[currentCaptureTimeIdx];
    if (this.lastCaptureTimeStr_ == newCaptureTime) {
      return "";
    }
    this.lastCaptureTimeStr_ = newCaptureTime;
    return newCaptureTime;
  }

  // If capture times were not passed in, compute time steps based on start time
  // passed in from config.

  var u = currentVideoTime / this.video_.duration;
  // 24 * 60 * 60 * 10000
  var timeOffset = 86400000 * u;
  var timeInSec = Math.ceil(this.startTimeInMs_ + timeOffset);
  var currentTimeStr = moment(timeInSec).format("MMM DD, YYYY hh:mm A");
  if (this.lastCaptureTimeStr_ == currentTimeStr) {
    return "";
  }
  this.lastCaptureTimeStr_ = currentTimeStr;
  return currentTimeStr;
};


/**
 * Render the current time
 * @private
 */
VideoTimeControls.prototype.renderCurrentTime_ = function() {
  if (!this.showTimestamps_) return;

  var captureTimeStr = this.getCurrentCaptureTime();
  if (captureTimeStr) {
    this.$captureTimeElm_.html(captureTimeStr);
  }
};


/**
 * Initialize the UI elements of the time sliders
 * @private
 */
VideoTimeControls.prototype.initUI_ = function() {
  this.loadedUI_ = true;
  this.initTimelineSlider_();
  this.initPlaybackButton_();
  this.initFastSpeedButton_();
  this.initMediumSpeedButton_();
  this.initSlowSpeedButton_();
  this.initFullScreenButton_();
  this.renderCurrentTime_();
  this.setInitialTimelineUIState_();

  $("#" + this.id_ + " .toggleSpeed .ui-button-text").css("padding", "1px");

  if (!this.video_.style.width && !this.video_.style.height && !this.video_.getAttribute("width") && !this.video_.getAttribute("height")) {
    $(this.video_).addClass("max-size");
  }

  $("#" + this.id_ + " #timelineSliderContainer .timelineSlider .ui-slider-range").css("background", this.sliderColor_);

  if (this.isMobileDevice_) {
    $("#" + this.id_ + " #timelineSliderContainer .timelineSlider").css("height", "21px");

    $("#" + this.id_ + " #timelineSliderContainer .timelineSlider .ui-slider-handle").css({
      "width" : "30px",
      "height" : "29px"
    });

    $("#" + this.id_ + " #timelineSliderContainer .timelineSliderFiller, .toggleSpeed").css({
      "left" : "104px"
    });

    $("#" + this.id_ + " #captureTimeContainer").css({
      "left" : "176px",
      "font-size" : "21px",
      "bottom" : "15px"
    });

    $("#" + this.id_ + " .playbackButton.ui-button").css({
      "width" : "60px",
      "height" : "60px"
    });

    $("#" + this.id_ + " .toggleSpeed.ui-button").css({
      "width" : "60px",
      "height" : "30px",
      "bottom" : "10px"
    });
  } else {
    var controlsStyle = '<style>video::-webkit-media-controls-enclosure{display: none;}</style>';
    $('head').append(controlsStyle);
  }
};


/**
 * Bring the video into full screen, whether that is 'fill screen' based
 * on browser or device restrictions.
 * @private
 */
VideoTimeControls.prototype.handleFullScreen_ = function() {
  var videoContainer = this.$videoContainer_[0];
  if (this.isFullScreenAPISupported_()) {
    if (this.isFullScreen_) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.webkitCancelFullScreen) {
        document.webkitCancelFullScreen();
      }
    } else {
      if (videoContainer.requestFullscreen) {
        videoContainer.requestFullscreen();
      } else if (videoContainer.msRequestFullscreen) {
        videoContainer.msRequestFullscreen();
      } else if (videoContainer.mozRequestFullScreen) {
        videoContainer.mozRequestFullScreen();
      } else if (videoContainer.webkitRequestFullScreen) {
        videoContainer.webkitRequestFullScreen();
      }
    }
  } else {
    // Fallback to 'fill' screen
    if (this.isFillScreen_) {
      $(this.video_).css({
        width: '',
        height: ''
      });
    }
    this.isFillScreen_ = !this.isFillScreen_;
    $(this.video_).toggleClass("max-size");
    $(window).trigger("resize");
  }
};


/**
 * Determine whether the HTML5 full screen API is supported by the current browser/device.
 * @private
 */
VideoTimeControls.prototype.isFullScreenAPISupported_ = function() {
  // Older webkits do not support fullscreen across iframes.
  if (document.webkitCancelFullScreen && !document.webkitExitFullscreen) {
    return (self === top);
  }
  return !!(document.documentElement.requestFullscreen || document.documentElement.msRequestFullscreen || document.documentElement.mozRequestFullScreen || document.documentElement.webkitRequestFullScreen);
};


/**
 * Request an animation frame before the next browser repaint
 * @private
 */
VideoTimeControls.prototype.requestAnimFrame_ =
  window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.oRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  function(callback) {
    return window.setTimeout(callback, 1000 / 60);
  };


/**
 * Cancel current animation frame
 * @private
 */
VideoTimeControls.prototype.cancelAnimFrame_ =
    window.cancelAnimationFrame ||
    window.webkitCancelAnimationFrame ||
    window.mozCancelAnimationFrame ||
    window.oCancelAnimationFrame ||
    window.msCancelAnimationFrame ||
    function(requestId) {};
