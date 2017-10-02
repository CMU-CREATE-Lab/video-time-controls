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

  this.playOnLoad_ = config.playOnLoad || this.video_.autoplay || true;

  this.loop_ = config.loop || this.video_.loop || true;

  this.video_.autoplay = this.playOnLoad_;

  this.video_.loop = this.loop_;

  this.loadedUI_ = false;

  this.captureTimes_ = config.captureTimes;

  this.requestAnimationFrameId_ = null;

  this.startSlideDrag_ = false;

  this.isFullScreen_ = false;

  this.isFillScreen_ = false;

  this.preFullScreenProperties_ = {};

  this.isMobileDevice_ = !(navigator.userAgent.match(/CrOS/) != null) &&
    (navigator.userAgent.match(/Android/i) ||
     navigator.userAgent.match(/webOS/i) || navigator.userAgent.match(/iPhone/i) ||
     navigator.userAgent.match(/iPad/i) ||
     navigator.userAgent.match(/iPod/i) ||
     navigator.userAgent.match(/BlackBerry/i) ||
     navigator.userAgent.match(/Windows Phone/i) ||
     navigator.userAgent.match(/Mobile/i)) != null;

  this.template_ = '\
    <div class="controls" style="display: none"> \
      <div class="captureTime" title="Capture time"> \
        <div class="currentCaptureTime"><div class="captureTimeMain"><div id="currentTime"></div></div></div> \
      </div> \
      <div class="timelineSliderFiller"> \
        <div id="Tslider1" class="timelineSlider"></div> \
      </div> \
      <div title="Toggle full screen" class="fullScreen"></div> \
      <div title="Play" class="playbackButton"></div> \
      <button class="toggleSpeed" id="fastSpeed" title="Toggle playback speed">Fast</button> \
      <button class="toggleSpeed" id="mediumSpeed" title="Toggle playback speed">Medium</button> \
      <button class="toggleSpeed" id="slowSpeed" title="Toggle playback speed">Slow</button> \
    </div>';

  // Add the template to the DOM
  this.render_();

  this.initEvents_();
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
  return this.getDuration() * this.getFps();
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

  $(".timelineSlider").slider("value", 0);

  if (typeof(config.playOnLoad) !== undefined) {
    this.playOnLoad_ = config.playOnLoad;
    this.video_.autoplay = this.playOnLoad_;
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
 * Pause the video
 * @public
 */
VideoTimeControls.prototype.pause = function() {
  $(".playbackButton").trigger("click");
};


/**
 * Start playing the video
 * @public
 */
VideoTimeControls.prototype.play = function() {
  $(".playbackButton").trigger("click");
};


/**
 * Set the initial UI for the play/pause button when a video is loaded
 * @private
 */
VideoTimeControls.prototype.setInitialTimelineUIState_ = function() {
  var $playbackButton = $(".playbackButton");

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
  var $div = $("<div>", {id: this.id_});
  $div.insertBefore($(this.video_));
  document.getElementById(this.id_).innerHTML = this.template_;
  $(this.video_).prependTo($div);
  $div.css({
    "position" : "relative"
  });

  // Chromium bug (https://bugs.chromium.org/p/chromium/issues/detail?id=382879)
  // Need to play the video again (if it was playing) after moving it in the DOM
  if (this.playOnLoad_) {
    this.video_.play();
  }
};


/**
 * Setup DOM events
 * @private
 */
VideoTimeControls.prototype.initEvents_ = function() {
  var that = this;

  $(window).on("resize", function() {
    if (that.isFillScreen_ || $(that.video_).hasClass("max-size")) {
      $(that.video_).css({
        "width" : $(window).width(),
        "height" : $(window).height()
      });
    }
  });

  $(that.video_).on("resize", function() {
    $(".controls").css({
      "width" : $(that.video_).width() + "px"
    });
    $(".controls").show();
  });

  $(that.video_).on("loadeddata", function() {
    if (!that.loadedUI_) {
      that.initUI_();
    }
    if (that.playOnLoad_ && that.video_.paused) {
      that.video_.play();
    }
    $(that.video_).trigger("resize");
    that.requestUpdateFunction_();
  });

  document.addEventListener("keydown", function(event) {
    // Play/pause on space bar
    if (event.keyCode == 32 ) {
      $(".playbackButton").trigger("click");
    }
  });

  $(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange', function() {
    that.isFullScreen_ = !that.isFullScreen_;
    if (that.isFullScreen_ && !that.isMobileDevice_) {
      $(".controls").css({
        "zIndex" : 2147483647,
      });
    } else {
      $(".controls").css({
        "zIndex" : 10,
      });
    }
    $("#" + that.id_ + " .fullScreen").button({
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
    $(".timelineSlider").slider("value", this.video_.currentTime * this.getFps());
    this.renderCurrentTime_();
  }
  this.requestAnimationFrameId_ = this.requestAnimFrame_.call(window, this.requestUpdateFunction_.bind(this));
};


/**
 * Initialize the play/pause button
 * @private
 */
VideoTimeControls.prototype.initPlaybackButton_ = function() {
  var $playbackButton = $(".playbackButton");
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
  var $fullScreenButton = $(".fullScreen");
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
  var $fastSpeedButton = $("#fastSpeed");
  var $mediumSpeedButton = $("#mediumSpeed");
  var $controls = $(".controls");
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
  var $mediumSpeedButton = $("#mediumSpeed");
  var $slowSpeedButton = $("#slowSpeed");
  var $controls = $(".controls");
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
  var $slowSpeedButton = $("#slowSpeed");
  var $fastSpeedButton = $("#fastSpeed");
  var $controls = $(".controls");
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
  var $timelineSlider = $(".timelineSlider");
  var that = this;
  $timelineSlider.slider({
    min: 0,
    max: that.getNumFrames() - 1, // this way the time scrubber goes exactly to the end of timeline
    range: "min",
    step: 1,
    slide: function(e, ui) {
      var newTime = ui.value / that.getFps();
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
  $(".timelineSlider .ui-slider-handle").attr("title", "Drag to go to a different point in time");
};


/**
 * Render the current time
 * @private
 */
VideoTimeControls.prototype.renderCurrentTime_ = function() {
  var currentCaptureTimeIdx = $(".timelineSlider").slider("value");
  $("#currentTime").html(this.captureTimes_[currentCaptureTimeIdx]);
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

  $(".toggleSpeed .ui-button-text").css("padding", "1px");

  if (!this.video_.style.width && !this.video_.style.height && !this.video_.getAttribute("width") && !this.video_.getAttribute("height")) {
    $(this.video_).addClass("max-size");
  }

  $(".timelineSlider .ui-slider-range").css("background", this.sliderColor_);

  if (this.isMobileDevice_) {
    $(".timelineSlider").css("height", "21px");

    $(".timelineSlider .ui-slider-handle").css({
      "width" : "30px",
      "height" : "29px"
    });

    $(".timelineSliderFiller, .toggleSpeed").css({
      "left" : "104px"
    });

    $(".captureTime").css({
      "left" : "176px",
      "font-size" : "21px",
      "bottom" : "15px"
    });

    $(".playbackButton.ui-button").css({
      "width" : "60px",
      "height" : "60px"
    });

    $(".toggleSpeed.ui-button").css({
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
  var video = this.video_;
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
      if (video.requestFullscreen) {
        video.requestFullscreen();
      } else if (video.msRequestFullscreen) {
        video.msRequestFullscreen();
      } else if (video.mozRequestFullScreen) {
        video.mozRequestFullScreen();
      } else if (video.webkitRequestFullScreen) {
        video.webkitRequestFullScreen();
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
