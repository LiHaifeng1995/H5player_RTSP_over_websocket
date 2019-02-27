importScripts(
    './H264SPSParser.js',
    './H264Session.js',
);


addEventListener('message', receiveMessage);

let sdpInfo = null;
let rtpSession = null;
let videoCHID = -1;
let videoRtpSessionsArray = [];

function  receiveMessage(event) {
    //console.log(event.data)
    let message = event.data;

    switch (message.type) {
        case 'sdpInfo':
            sdpInfo = message.data;

            initRTPSession(sdpInfo.sdpInfo);
        case 'rtpDataArray':
            //console.log(message.data.length)
            for (let num = 0; num < message.data.length; num++) {
                receiveMessage({
                    'type': 'rtpData',
                    'data': message.data[num],
                });
            }
            break;
        case 'rtpData':
            videoCHID = message.data.rtspInterleave[1];
            if (typeof videoRtpSessionsArray[videoCHID] !== "undefined") {
                videoRtpSessionsArray[videoCHID].remuxRTPData(message.data.rtspInterleave,
                    message.data.header, message.data.payload);
            }else { // RTCP包
                //console.log('Interleave:  ' + videoCHID);
                //console.log(message.data.rtspInterleave, message.data.header);
                //return;
            }
            break;
    }
}

function initRTPSession(sdpInfo) {
    for(let [i, len] = [0, sdpInfo.length]; i < len; i++) {
        if(sdpInfo[i].codecName === 'H264') {
            //console.log(sdpInfo)
            rtpSession = new H264Session();
            rtpSession.init();
            rtpSession.rtpSessionCallback = RtpReturnCallback;
            if(sdpInfo[i].Framerate) {
                rtpSession.setFrameRate(sdpInfo[i].Framerate);
            }
        }

        if(rtpSession !== null) {
            videoCHID = sdpInfo[i].RtpInterlevedID;
            videoRtpSessionsArray[videoCHID] = rtpSession;
        }
    }
}

function RtpReturnCallback(dataInfo) {

    if(dataInfo == null || dataInfo == undefined) {
        //console.log('数据为空')
        return;
    }
    let mediaData = dataInfo;
    if(mediaData.decodeMode === 'canvas') {
        sendMessage('YUVData', mediaData.frameData);
        return;
    }
    //console.log( mediaData.SEIInfo)
    if(mediaData.initSegmentData !== null && mediaData.initSegmentData !== undefined) {
        //sendMessage('codecInfo', mediaData.codecInfo)
        //sendMessage('initSegment', mediaData.initSegmentData);
        sendMessage('videoInit', mediaData);
        sendMessage('firstvideoTimeStamp', mediaData.timeStamp);

    }else if(mediaData.SEIInfo !== null && mediaData.SEIInfo !== undefined) {//SEI信息
        sendMessage('SEI', mediaData.SEIInfo);
    }

    if (mediaData.frameData && mediaData.frameData.length > 0) {
        sendMessage('videoTimeStamp', mediaData.timeStamp);
        sendMessage('mediaSample', mediaData.mediaSample);
        //console.log(mediaData.frameData.length)
        sendMessage('videoRender', mediaData.frameData);
    }
    mediaData = null;
}

function sendMessage(type, data) {
    let event = {
        type: type,
        data: data
    }
    if(type === 'videoRender') {
        postMessage(event, [data.buffer]);
    }else {
        postMessage(event);
    }
    event = null;
}
