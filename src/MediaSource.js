

function VideoMediaSource(element) {
    let videoElement = null;
    let codecInfo = null;

    let mediaSource = null;
    let sourceBuffer = null;

    let initSegmentData = null;

    let ctrlDelayFlag = false;
    let delay = 0.5;
    let waitingCount = 0;
    let time = 0;

    let segmentWaitDecode = [];

    let firstTimeStamp = null;
    let isFirstTimeStamp = false;


    let onDurationChangeCallback = null;
    let onCanplayCallback = null;

    function constructor(element) {
        videoElement = element;
    }

    constructor.prototype = {
        init() {
            videoElement.controls = false;
            videoElement.autoplay = "autoplay";
            //videoElement.preload = "auto";
            videoElement.muted = true;

            addVideoEventListener(videoElement);

            appendInitSegment();
        },

        setMediaSegment(mediaSegment) {
            appendNextMediaSegment(mediaSegment)
        },

        setFirstTimeStamp(time) {
            if(!isFirstTimeStamp) {
                console.log('set firstTimeStamp:', time)
                firstTimeStamp = time;
                isFirstTimeStamp = true;
            }
        },

        setDurationChangeCallBack(callback) {
            onDurationChangeCallback = callback;
        },

        set CodecInfo(CodecInfo) {
            codecInfo = CodecInfo;
        },

        get CodecInfo() {
            return codecInfo;
        },

        set InitSegment(data) {
            initSegmentData = data;
        },

        get InitSegment() {
            return initSegmentData;
        },

        onCanplayCallback(callback) {
            onCanplayCallback = callback;
        },

        close() {
            videoElement.pause();
            removeEventListener();
            mediaSource.removeSourceBuffer(sourceBuffer);
            mediaSource.endOfStream();
            sourceBuffer = null;
            mediaSource = null;
            videoElement = null;
        }
    }

    return new constructor(element);

    function appendInitSegment() {
        if(mediaSource == null || mediaSource.readyState === 'end') {
            mediaSource = new MediaSource();
            addMediaSourceEventListener(mediaSource);
            videoElement.src = window.URL.createObjectURL(mediaSource);
            //console.log('new MediaSource');
            return;
        }

        //console.log('appendInitSegment start');
        if(mediaSource.sourceBuffers.length === 0) {
            mediaSource.duration = 0;
            let codecs = 'video/mp4;codecs="avc1.' + codecInfo + '"';
            if(!MediaSource.isTypeSupported(codecs)) {
                //console.log('要播放视频格式 video/mp4;codecs="avc1.64002a", video/mp4;codecs="avc1.64002a"，您还需要安装一个额外的微软组件，参见 https://support.mozilla.org/kb/fix-video-audio-problems-firefox-windows')
                console.log('not support ' + codecs)
                return;
            }
            sourceBuffer = mediaSource.addSourceBuffer(codecs);
            addSourceBufferEventListener(sourceBuffer);
        }

        let initSegment = initSegmentData;
        if(initSegment == null) {
            mediaSource.endOfStream();
            console.log('no initSegmentData');
        }
        //console.log(sourceBuffer)
        sourceBuffer.appendBuffer(initSegment);
        //console.log(sourceBuffer)
        // saveAs(new File(initSegment, "test"));
        //  Savesegments.set(initSegment, 0);
        //  segmentsLength += initSegment.length;
        //  segmentsNum --;
        console.log('appendInitSegment end')
    }

    function appendNextMediaSegment(mediaData) {

        if(sourceBuffer == null) {
            segmentWaitDecode.push(mediaData);
            return;
        }
        //console.log(mediaSource.readyState, mediaSource.readyState,sourceBuffer.updating)
        if(mediaSource.readyState === 'closed' || mediaSource.readyState === "ended") {
            console.log('mediaSource closed or ended')
            return;
        }

        if(onDurationChangeCallback) {
            //90000为采样率，先写死
            let rtpTimestamp = videoElement.currentTime * 90000 + firstTimeStamp + 3600;
            //console.log('callback time: ', rtpTimestamp)
            //console.log('sourceBuffer: ', sourceBuffer.timestampOffset)
            onDurationChangeCallback(rtpTimestamp);
        }

        //console.count('一帧');

        //try {
        if(segmentWaitDecode.length) {
            segmentWaitDecode.push(mediaData);
            //console.log(segmentWaitDecode)
        }else {
            if(!sourceBuffer.updating) {
                sourceBuffer.appendBuffer(mediaData);
            } else {
                segmentWaitDecode.push(mediaData);
            }
        }
        //}catch (e){
        //    console.log('appendNextMediaSegment Error')
        //}



        //console.log(sourceBuffer)
    }

    /**
     * Video事件
     * @param videoElement video对象
     */
    function addVideoEventListener(videoElement) {
        videoElement.addEventListener('loadstart', onloadstart);

        videoElement.addEventListener('waiting', onWaiting);

        videoElement.addEventListener('durationchange', onDurationChange);

        videoElement.addEventListener('timeupdate', timeupdate);

        videoElement.addEventListener('canplay', oncanplay);

        videoElement.addEventListener('canplaythrough', oncanplaythrough);

        videoElement.addEventListener('error', onVideoError);
    }

    function onloadstart() {
        console.log('loadstart');
    }

    function onDurationChange() {
        //console.log('durationchange');
        if (mediaSource === null) {
            return
        }

        //console.log('currentTime：', videoElement.currentTime);
        // if(onDurationChangeCallback) {
        //     //90000为采样率，先写死
        //     let rtpTimestamp = videoElement.currentTime * 90000 + firstTimeStamp ;
        //     //console.log('callback time: ', rtpTimestamp)
        //     onDurationChangeCallback(rtpTimestamp);
        // }

        //try {
        if(sourceBuffer && sourceBuffer.buffered && sourceBuffer.buffered.length > 0) {
            checkBuffer();
            //console.log('end: ',sourceBuffer.buffered.end(0))
            if(ctrlDelayFlag) {
                let startTime = sourceBuffer.buffered.start(0);
                let endTime = sourceBuffer.buffered.end(0);
                let diffTime = videoElement.currentTime === 0 ? endTime - startTime: endTime - videoElement.currentTime
                if(diffTime >= delay + 0.1) {
                    if(sourceBuffer.updating) {
                        return;
                    }
                    let tempCurrntTime = endTime - delay;
                    console.log('跳秒前', videoElement.currentTime)
                    videoElement.currentTime = tempCurrntTime.toFixed(3);
                    console.log('跳秒后', videoElement.currentTime)
                    //ctrlDelayFlag = false;
                }
            }
        }
        //}catch(e) {
        //    console.log('sourceBuffer has been moved')
        //}

    }

    function timeupdate() {
        // console.log('******timeupdate******');
        // console.log(videoElement.currentTime);
        // console.log('******timeupdate end******')
    }

    function oncanplay() {
        // if(isFirstTimeStamp && (firstTimeStamp == null)) {
        //     //firstTimeStamp =
        //     isFirstTimeStamp = false;
        // }

        onCanplayCallback && onCanplayCallback(videoElement);
        console.log('canplay');
    }

    function oncanplaythrough() {
        ctrlDelayFlag = true;
        console.log('canplaythrough');
    }

    function onVideoError() {
        console.log('error');
        //console.log(e)
        console.log(videoElement.currentTime)
    }


    /**
     * MediaSource事件
     * @param mediaSource
     */
    function addMediaSourceEventListener(mediaSource) {
        mediaSource.addEventListener('sourceopen', onSourceOpen);

        mediaSource.addEventListener('error', onMediaSourceError);
    }

    function onSourceOpen() {
        console.log('OnsourceOpen');
        appendInitSegment(); //此处重新调用一次，是为了建立sourceBuffer
    }

    function onMediaSourceError() {
        console.log('mediaSource error');
        console.log(videoElement.currentTime)
    }

    /**
     * sourceBuffer事件
     */
    function addSourceBufferEventListener(sourceBuffer) {
        sourceBuffer.addEventListener('error', onSourceBufferError);

        sourceBuffer.addEventListener('update', onUpdate);
    }

    function onSourceBufferError() {
        console.log('sourceBuffer Error');
        console.log(videoElement.currentTime)
    }

    function onUpdate() {
        //console.log('sourceBuffer update');
        if(segmentWaitDecode.length > 0) {
            if(!sourceBuffer.updating) {
                sourceBuffer.appendBuffer(segmentWaitDecode[0]);

                //console.log('segmentWaitDecode:  ' + segmentWaitDecode.length)
                segmentWaitDecode.shift();
            }
        }
        //console.log(e)
    }

    function checkBuffer() {
        let minute = 20;
        let bufferTime = 10;
        let startTime = sourceBuffer.buffered.start(0);
        let endTime = sourceBuffer.buffered.end(0);
        if (!sourceBuffer.updating && (endTime - startTime > minute)) {
            sourceBuffer.remove(startTime, endTime - bufferTime)
        }else if(sourceBuffer.updating && (endTime - startTime > minute)) {
            console.log('clear buffer failed!')
        }
    }

    function onWaiting() {
        console.log('waiting....')
        ctrlDelayFlag = false;

        if(delay < 1.5) {
            if(waitingCount === 0) {
                time = Date.now();
                waitingCount++;
            }else {
                waitingCount++;
                if((Date.now() - time) <= 60000 && waitingCount >= 5) {
                    delay += 0.1;
                    console.log('delay: ', delay);
                    time = Date.now();
                    waitingCount = 0;
                }
            }
        }
    }

    function removeEventListener() {
        videoElement.removeEventListener('loadstart', onloadstart);
        videoElement.removeEventListener('waiting', onWaiting);
        videoElement.removeEventListener('durationchange', onDurationChange);
        videoElement.removeEventListener('timeupdate', timeupdate);
        videoElement.removeEventListener('canplay', oncanplay);
        videoElement.removeEventListener('canplaythrough', oncanplaythrough);
        videoElement.removeEventListener('error', onVideoError);

        mediaSource.removeEventListener('sourceopen', onSourceOpen);
        mediaSource.removeEventListener('error', onMediaSourceError);

        sourceBuffer.removeEventListener('error', onSourceBufferError);
        sourceBuffer.removeEventListener('update', onUpdate);
    }

}



export default VideoMediaSource;
