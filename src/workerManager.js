import VideoMediaSource from './MediaSource.js';
import MP4Remux from './MP4Remux.js';
import IvsDrawer from './ivsDrawer.js';

function WorkerManager() {
    let videoWorker;
    let SDPInfo;
    let messageArray = [];
    let rtpStackCount = 0;
    let videoElement = null;
    let canvasElement = null;
    let videoMS = null;

    const rtpStackCheckNum = 10;

    let codecInfo = null;
    let initSegmentData = null;
    let mediaInfo = {
        id: 1,
        samples: null,
        baseMediaDecodeTime: 0
    };
    let numBox = 1;
    let mediaSegNum = 0; //用于记录缓存的box个数
    let mediaFrameData = null; //用于缓存未喂入mse的box
    let mediaFrameSize = 0; //mediaFrameData的大小
    let preBaseDecodeTime = 0; //上一个解码时间
    let curBaseDecodeTime = 0; //从第一帧到当前帧的持续时间
    let mediaSegmentData = null; //MP4化的数据
    let sequenseNum = 1;

    let mp4Remux;

    let firstTimeStamp = null; //第一个视频帧的时间戳
    let SEIinfo = null;
    let ivsDrawer = null;
    let info = null;
    let MAX_INFO = 25; // 限制info最大长度
    let startDrawIVS = false;
    let lastTime = 0;
    function constructor() {

    }

    constructor.prototype = {
        init(video,canvas) {
            videoWorker = new Worker('./src/videoWorker.js');
            videoWorker.onmessage = videoWorkerMessage;
            videoElement = video;
            canvasElement = canvas;

            mp4Remux = new MP4Remux();
            mp4Remux.init();

            SEIinfo = new IVSQueue();
            info = new LruCache(MAX_INFO);
            ivsDrawer = new IvsDrawer(canvasElement);
        },

        sendSdpInfo(SDPinfo) {
            SDPInfo = SDPinfo;
            //console.log(SDPinfo)
            let message = {
                type: "sdpInfo",
                data: {
                    sdpInfo: SDPInfo
                }
            };
            videoWorker.postMessage(message);
        },

        parseRtpData(rtspinterleave, rtpheader, rtpPacketArray) {
            // console.log(rtspinterleave)
            // console.log( rtpheader)
            // //console.log(rtpPacketArray)
            // console.log(rtpheader[3])

            let mediaType = rtspinterleave[1];
            let idx = parseInt(mediaType / 2, 10);
            let markerBitHex = 128;
            let message = {
                type: "rtpData",
                data: {rtspInterleave: rtspinterleave, header: rtpheader, payload: rtpPacketArray}
            };
            //console.log(rtspinterleave)
            //console.log('idx: ',idx)

            if(idx !== 0) {
                console.log('idx: ',rtspinterleave);
                //console.log(SDPInfo)
                return;
            }
            switch (SDPInfo[idx].codecName) {
                case"H264":
                    messageArray.push(message);
                    if (rtpStackCount >= rtpStackCheckNum || (rtpheader[1] & markerBitHex) === markerBitHex) {
                        if((rtpheader[1] & markerBitHex) === markerBitHex) {
                            //onsole.log('遇到终止位: ' + rtpheader[1])
                        }
                        let sendMessage = {type: "rtpDataArray", data: messageArray};
                        if (videoWorker) {
                            videoWorker.postMessage(sendMessage)
                        }
                        sendMessage = null;
                        messageArray = [];
                        rtpStackCount = 0
                        //console.log('1111111111')
                    } else {
                        rtpStackCount++
                    }
                    break;
                default:
            }
        },

        /**
         * 更新需要绘制的其它信息
         * @param obj
         */
        updateInfo(obj) {
            info.set(obj.id, obj.name);
        },

        terminate() {
            videoWorker.terminate();
            ivsDrawer.terminate();
            info.clear();
            startDrawIVS = false;
            window.onresize = null;
            if(videoMS) {
                videoMS.close();
                videoMS = null;
            }
        }
    }

    return new constructor();

    function videoWorkerMessage(event) {
        let videoMessage = event.data;
        let type = videoMessage.type;
        //console.log(videoMessage.data)
        switch (type) {
            // case 'codecInfo': //设置codecType
            //     break;
            // case 'initSegment': //第一个buffer，设置SPS等
            case 'videoInit'://合并codecInfo和initSegment
                console.log(videoMessage)
                codecInfo = videoMessage.data.codecInfo;
                //console.log(videoMessage.data)
                initSegmentData = mp4Remux.initSegment(videoMessage.data.initSegmentData);
//console.log(initSegmentData)
                videoMS = new VideoMediaSource(videoElement);
                videoMS.CodecInfo = codecInfo;
                videoMS.InitSegment = initSegmentData;
                //console.log(videoMS.CodecInfo, videoMS.InitSegment)
                videoMS.init();
                videoMS.onCanplayCallback(()=>{ivsDrawer.cover(videoElement)});

                windowResizeEvent(()=>{ivsDrawer.cover(videoElement)});
                break;
            case 'firstvideoTimeStamp':
                firstTimeStamp = videoMessage.data;

                videoMS.setFirstTimeStamp(firstTimeStamp);
                //videoMS.setDurationChangeCallBack(drawIVS);

                console.log('first frame timestamp: ', firstTimeStamp);
                startDrawIVS = true;
                window.requestAnimationFrame(()=>{
                    draw();
                })
                break;
            case 'videoTimeStamp'://时间戳，用于智能同步
                //videoMS.setFirstTimeStamp(videoMessage.data);
                //console.log('frame timestamp: ', videoMessage.data);
                //console.log('npt: ', ( videoMessage.data - firstTimeStamp)/90000)
                break;
            case 'mediaSample': //用于设置baseMediaDecodeTime
                if(mediaInfo.samples == null) {
                    mediaInfo.samples = new Array(numBox);
                }
                //console.log('frameDuration: ' + videoMessage.data.frameDuration)
                curBaseDecodeTime += videoMessage.data.frameDuration;

                mediaInfo.samples[mediaSegNum++] = videoMessage.data;
                break;
            case 'videoRender': //视频数据
                //缓存该segment数据
                let tempBuffer = new Uint8Array(videoMessage.data.length + mediaFrameSize);
                if(mediaFrameSize !== 0) {
                    tempBuffer.set(mediaFrameData);
                }
                //console.log(videoMessage)
                tempBuffer.set(videoMessage.data, mediaFrameSize);
                mediaFrameData = tempBuffer;
                mediaFrameSize = mediaFrameData.length;

                if(mediaSegNum % numBox === 0 && mediaSegNum !== 0) {
                    if (sequenseNum === 1) {
                        mediaInfo.baseMediaDecodeTime = 0
                    } else {
                        mediaInfo.baseMediaDecodeTime = preBaseDecodeTime;
                    }
                    preBaseDecodeTime = curBaseDecodeTime;

//console.log(mediaInfo);
                    mediaSegmentData = mp4Remux.mediaSegment(sequenseNum, mediaInfo, mediaFrameData);
                    sequenseNum++;
                    mediaSegNum = 0;
                    mediaFrameData = null;
                    mediaFrameSize = 0;

                    if (videoMS !== null) {
                        //console.log(mediaSegmentData)
                        videoMS.setMediaSegment(mediaSegmentData)
                    } else {

                    }
                }
                break;
            case 'YUVData'://FFMPEG解码的数据
                //console.log(videoMessage.data)
                //draw(videoMessage.data);
                //yuv2canvas(videoMessage.data.data, videoMessage.data.width, videoMessage.data.height,canvasElement)

                break;
            case 'SEI': //处理SEI信息
                //console.log('SEI timestamp: ', videoMessage.data.timestamp);
                //console.log('SEI-npt: ', (videoMessage.data.timestamp - firstTimeStamp)/90000)
                if(videoMessage.data.ivs !== null) {
                    let ivs = [];
                    videoMessage.data.ivs.map((content, k) => {
                        if(content.state) { //state=1, 绘制该信息
                            ivs.push(content);
                        }else { //state=0, 清除info中对应的id:name
                            // let id = content.id;
                            // console.log('删除', id, info[id]);
                            // delete info[id];
                            // console.log(info)
                        }
                    });

                    //console.log('SEI: ', videoMessage.data.timestamp)
                    SEIinfo.push(videoMessage.data.timestamp, ivs);

                    //console.log(videoMessage.data.timestamp - lastTime)
                    //lastTime = videoMessage.data.timestamp;
                }
                //console.log('timestamp: ', videoMessage.data.timestamp)
                //console.log(SEIinfo)
                break;
            default:
                console.log('暂不支持其他类型');
                break;
        }
    }

    function draw() {
        let timestamp = videoElement.currentTime * 90000 + firstTimeStamp + 3600;//
        drawIVS(timestamp);
        if(startDrawIVS) {
            window.requestAnimationFrame(()=>{draw()});
        }
    }

    /**
     * 根据时间戳获取相应的ivs信息
     * @param timestamp 当前帧的时间戳
     * @returns {*} ivs信息
     */
    function getIVS(timestamp) {
        let preNode = null;
        let nextNode = null;
        preNode = SEIinfo.shift();
        nextNode = SEIinfo.top();
        while((preNode !== undefined) && (preNode !== null)) {
            if(preNode[0] > timestamp) {
                SEIinfo.unshift(preNode);
                //console.log('SEI时间大于video: ', preNode[0], timestamp);
                return null;
            } else if(preNode[0] === timestamp) {
                return preNode[1];
            } else {

                if(nextNode === undefined || nextNode === null) {
                    console.log('last ivs info: ', timestamp, preNode[0], SEIinfo);
                    if(SEIinfo.length()) {
                        SEIinfo.map((v, k)=>{
                            console.log(v);
                        });
                    }
                    return preNode[1];//最后一个node
                }
                if(nextNode[0] > timestamp) {
                    return preNode[1];
                } else if(nextNode[0] === timestamp){
                    nextNode = SEIinfo.shift();
                    return nextNode[1];
                } else {
                    preNode = SEIinfo.shift();
                    nextNode = SEIinfo.top();
                }
            }
        }
        return null;
    }

    /**
     * 绘制智能信息
     * @param timestamp
     */
    function drawIVS(timestamp) {
        //return null;
        let data = getIVS(timestamp);
        // //
        if(data === undefined || data === null) {
            //清空画布
            if(!SEIinfo.length()) {
                ivsDrawer.clearCanvas();
            }
        }else {
            //console.log(info.map.length)
            if(info.map.length > MAX_INFO) {
                console.log('info length: ', info.map.length);
            }

            //获取鹰眼信息
            data.map((content, k) =>{
                let result = info.get(content.id);
                if(result !== undefined && result !== null) {
                    data[k].text = result.value;
                }
            });

            ivsDrawer.draw(data, timestamp);
        }
    }
}


function windowResizeEvent(callback) {
    window.onresize = function() {
        let target = this;
        if (target.resizeFlag) {
            clearTimeout(target.resizeFlag);
        }

        target.resizeFlag = setTimeout(function() {
            callback();
            target.resizeFlag = null;
        }, 100);
    }
}

function yuv2canvas(yuv, width, height, canvas) {

    canvas.width = width;
    canvas.height = height;

    var context    = canvas.getContext("2d");
    var output     = context.createImageData(width, height);
    var outputData = output.data;

    var yOffset = 0;
    var uOffset = width * height;
    var vOffset = width * height + (width*height)/4;
    for (var h=0; h<height; h++) {
        for (var w=0; w<width; w++) {
            var ypos = w + h * width + yOffset;

            var upos = (w>>1) + (h>>1) * width/2 + uOffset;
            var vpos = (w>>1) + (h>>1) * width/2 + vOffset;

            var Y = yuv[ypos];
            var U = yuv[upos] - 128;
            var V = yuv[vpos] - 128;

            var R =  (Y + 1.371*V);
            var G =  (Y - 0.698*V - 0.336*U);
            var B =  (Y + 1.732*U);

            var outputData_pos = w*4 + width*h*4;
            outputData[0+outputData_pos] = R;
            outputData[1+outputData_pos] = G;
            outputData[2+outputData_pos] = B;
            outputData[3+outputData_pos] = 255;
        }
    }

    context.putImageData(output, 0, 0);
}

class IVSQueue {

    constructor() {
        this.list = [];
    }

    push(timestamp, ivs) {
        this.list.push([timestamp, ivs]);
    }

    shift() {
        let tmp = this.list.shift();
        return tmp;
    }

    unshift(node) {
        this.list.unshift(node);
    }

    top() {

        let tmp = this.list[0];
        return tmp;
    }

    length() {
        return this.list.length;
    }

    map(v,k) {
        return this.list.map(v,k);
    }
}

class LruCache {
    constructor(limit) {
        this.limit = limit || 20;
        this.map = [];
    }
    get(key) {
        return this._search(key);
    }
    set(key, value) {
        let result  = this._search(key);
        if(!result) {
            this.map.unshift({
                key: key,
                value: value
            });
            if(this.map.length > this.limit) {
                this.map.pop();
            }
        }
    }

    //每次查找将该元素置于队首
    _search(key) {
        for(let i = 0, length = this.map.length; i < length; i++) {
            if(this.map[i].key === key) {
                let head = this.map.splice(i, 1);
                this.map.unshift(head[0]);
                return head[0];
            }
        }
        return null;
    }

    clear() {
        this.map = [];
    }
}
export default WorkerManager;
