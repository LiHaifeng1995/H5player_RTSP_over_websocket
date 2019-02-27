import WorkerManager from './workerManager.js';
import {hex_md5}  from "./md5.js";

function WebSocketServer(options) {
    let videoElement = null;
    let canvasElement = null;
    let websocket = null;
    let wsURL = null;
    let rtspURL = null;
    let username = null;
    let password = null;
    let CSeq = 1;
    let IsDescribe = false; //RTSP响应报文中，describe时有两段，以'\r\n'分段
    let currentState = "Options";
    let describekey = false;
    let Authentication = '\r\n'; //认证，信令最后四个字节为'\r\n\r\n'，为补足，默认为'\r\n'
    let sessionID = '';
    let rtspSDPData = {};
    let SDPinfo = []; //SDP信息
    let setupSDPIndex = 0;
    let getParameterInterval = null; //保活
    let AACCodecInfo = null;

//RTP包处理相关
    let rtspinterleave = null;
    let RTPPacketTotalSize = 0;
    let rtpheader = null;
    let rtpPacketArray = null;

    let workerManager = null;
    let connectFailCallback = null;

    let lastStreamTime = null; //记录收到码流的时间
    let getStreamInterval = null;
    let noStreamCallback = null;

    const RTSP_INTERLEAVE_LENGTH = 4; //交织头占4个字节
    const RTSP_STATE = {
        OK: 200,
        UNAUTHORIZED: 401,
        NOTFOUND: 404,
        INVALID_RANGE: 457,
        NOTSERVICE: 503,
        DISCONNECT: 999
    };
    const SEND_GETPARM_INTERVAL = 20000; //保活时间

    function constructor({video, canvas, wsUrl, rtspUrl, user, pwd} = {options}) {
        videoElement = video;
        canvasElement = canvas;
        wsURL = wsUrl;
        rtspURL = rtspUrl;
        username = user;
        password = pwd;

    }

    constructor.prototype = {
        init() {
            workerManager = new WorkerManager();
            workerManager.init(videoElement,canvasElement);
        },
        connect() {
            websocket = new WebSocket(wsURL);
            websocket.binaryType = 'arraybuffer';
            websocket.onmessage = ReceiveMessage;
            websocket.onopen = () => {
                let option = StringToU8Array("OPTIONS " + rtspURL + " RTSP/1.0\r\nCSeq: " + CSeq + "\r\n\r\n");
                websocket.send(option);
                //console.log('websocket connect')
            };
            websocket.onerror = ()=> {
                if(connectFailCallback) {
                    connectFailCallback('websocket connect fail');
                }
            }
        },
        close() {
            clearInterval(getParameterInterval);
            clearInterval(getStreamInterval);
            SendRtspCommand(CommandConstructor("TEARDOWN", null));
            websocket.close();
            if(workerManager) {
                workerManager.terminate();
            }
        },
        setCallBack(event, callback) {
            switch (event) {
                case 'error':
                    connectFailCallback = ()=>{
                        callback();
                        this.close();
                    };
                    break;
                case 'noStream':
                    noStreamCallback = ()=>{
                        callback();
                        this.close();
                    };
                    break;
                default:
                    console.log('unsupport event');
            }
        },
        updateInfo(obj) {
            workerManager.updateInfo(obj);
        }
    };



    return new constructor(options);

    /**
     * websocket消息处理函数
     * @param event
     * @constructor
     */
    function ReceiveMessage(event) {
        let data = event.data;
        let receiveUint8 = new Uint8Array(data);
        let PreceiveUint8 = new Uint8Array(receiveUint8.length);
        PreceiveUint8.set(receiveUint8, 0);
        let dataLength = PreceiveUint8.length;
        // if(dataLength < 10) {
        //     //console.log(String.fromCharCode.apply(null, PreceiveUint8))
        // }
        while (dataLength > 0) {
            if (PreceiveUint8[0] != 36) {//非$符号表示RTSP
                //console.log(PreceiveUint8[0], PreceiveUint8[1], PreceiveUint8[2], PreceiveUint8[3], PreceiveUint8[4])
                //console.log(PreceiveUint8.length)
                let PreceiveMsg = String.fromCharCode.apply(null, PreceiveUint8);
                //console.log(PreceiveMsg)
                let rtspendpos = null;
                if (IsDescribe === true) {
                    rtspendpos = PreceiveMsg.lastIndexOf("\r\n");
                    IsDescribe = false
                } else {
                    rtspendpos = PreceiveMsg.search("\r\n\r\n");

                }
                let rtspstartpos = PreceiveMsg.search("RTSP");
                if (rtspstartpos !== -1) {
                    if (rtspendpos !== -1) {
                        let RTSPResArray = PreceiveUint8.subarray(rtspstartpos, rtspendpos + RTSP_INTERLEAVE_LENGTH);
                        PreceiveUint8 = PreceiveUint8.subarray(rtspendpos + RTSP_INTERLEAVE_LENGTH);
                        let receiveMsg = String.fromCharCode.apply(null, RTSPResArray);
                        RTSPResHandler(receiveMsg);
                        dataLength = PreceiveUint8.length;
                    } else {
                        dataLength = PreceiveUint8.length;
                        return
                    }
                } else {
                    PreceiveUint8 = new Uint8Array;
                    return
                }
            } else { //$表示RTP和RTCP
                //console.log('RTP开始');
                //console.log(PreceiveUint8.length)
                // if(PreceiveUint8.length == 4) {
                //    console.log(PreceiveUint8)
                // }
                lastStreamTime = Date.now();
                rtspinterleave = PreceiveUint8.subarray(0, RTSP_INTERLEAVE_LENGTH);
                //console.log(rtspinterleave)
                RTPPacketTotalSize = rtspinterleave[2] * 256 + rtspinterleave[3];
                if (RTPPacketTotalSize + RTSP_INTERLEAVE_LENGTH <= PreceiveUint8.length) {
                    rtpheader = PreceiveUint8.subarray(RTSP_INTERLEAVE_LENGTH, 16);
                    rtpPacketArray = PreceiveUint8.subarray(16, RTPPacketTotalSize + RTSP_INTERLEAVE_LENGTH);
                    //rtpCallback(rtspinterleave, rtpheader, rtpPacketArray);
                    workerManager.parseRtpData(rtspinterleave, rtpheader, rtpPacketArray);
                    PreceiveUint8 = PreceiveUint8.subarray(RTPPacketTotalSize + RTSP_INTERLEAVE_LENGTH);
                    //console.log('PreceiveUint8.length:  ' + PreceiveUint8.length)
                    dataLength = PreceiveUint8.length;
                } else {
                    dataLength = PreceiveUint8.length;
                    //console.count('11111111111')
                    //console.log(PreceiveUint8)
                    return
                }
            }
        }
    }

    /**
     * 将字符串转为arrayBuffer
     * @param string
     */
    function StringToU8Array(string) {
        CSeq++;
        //console.log(string)
        let stringLength = string.length;
        let outputUint8Array = new Uint8Array(new ArrayBuffer(stringLength));
        for (let i = 0; i < stringLength; i++) {
            outputUint8Array[i] = string.charCodeAt(i);
        }
        //console.log(outputUint8Array)
        return outputUint8Array;
        //return string;
    }

    /**
     * 处理收到的RTSP信令，解析后发送下一条
     * @param stringMessage
     * @constructor
     */
    function RTSPResHandler(stringMessage) {
        //console.log(stringMessage)
        //let seekPoint = stringMessage.search("CSeq: ") + 5;
        let rtspResponseMsg = parseRtsp(stringMessage);
//console.log(rtspResponseMsg)
        if (rtspResponseMsg.ResponseCode === RTSP_STATE.UNAUTHORIZED && Authentication === "\r\n") { //需要鉴权
            if(currentState === "Describe") {
                IsDescribe = false;
                describekey = false;
            }
            //console.log(rtspResponseMsg)
            SendRtspCommand(formDigest(rtspResponseMsg));
            Authentication = "\r\n";

        } else if (rtspResponseMsg.ResponseCode === RTSP_STATE.OK) { //服务器端返回成功
            switch (currentState) {
                case 'Options':
                    currentState = "Describe";
                    SendRtspCommand(CommandConstructor("DESCRIBE", null));
                    break;
                case "Describe":
                    rtspSDPData = parseDescribeResponse(stringMessage);
                    if (typeof rtspResponseMsg.ContentBase !== "undefined") {
                        rtspSDPData.ContentBase = rtspResponseMsg.ContentBase
                    }
                    //console.log(rtspSDPData.Sessions)
                    for (let idx = 0; idx < rtspSDPData.Sessions.length; idx++) {
                        let sdpInfoObj = {};
                        if (rtspSDPData.Sessions[idx].CodecMime === "H264" ) { //暂时只支持H264
                            sdpInfoObj.codecName = rtspSDPData.Sessions[idx].CodecMime;
                            sdpInfoObj.trackID = rtspSDPData.Sessions[idx].ControlURL;
                            sdpInfoObj.ClockFreq = rtspSDPData.Sessions[idx].ClockFreq;
                            sdpInfoObj.Port = parseInt(rtspSDPData.Sessions[idx].Port);
                            if (typeof rtspSDPData.Sessions[idx].Framerate !== "undefined") {
                                sdpInfoObj.Framerate = parseInt(rtspSDPData.Sessions[idx].Framerate)
                            }
                            if(typeof rtspSDPData.Sessions[idx].SPS !== "undefined") {
                                sdpInfoObj.SPS = rtspSDPData.Sessions[idx].SPS;
                            }
                            SDPinfo.push(sdpInfoObj)
                        } else {
                            console.log("Unknown codec type:", rtspSDPData.Sessions[idx].CodecMime, rtspSDPData.Sessions[idx].ControlURL)
                        }
                    }
                    setupSDPIndex = 0;
                    currentState = "Setup";
                    //console.log(SDPinfo[setupSDPIndex])
                    SendRtspCommand(CommandConstructor("SETUP", SDPinfo[setupSDPIndex].trackID, setupSDPIndex));
                    //SendRtspCommand(CommandConstructor("SETUP", 'track1'));
                    break;
                case "Setup":
                    sessionID = rtspResponseMsg.SessionID;
                    //多路流(如音频流)
                    //在Describe中暂时只解析H264视频流，因此SDPinfo.length始终为1
                    if (setupSDPIndex < SDPinfo.length) {
                        SDPinfo[setupSDPIndex].RtpInterlevedID = rtspResponseMsg.RtpInterlevedID;
                        SDPinfo[setupSDPIndex].RtcpInterlevedID = rtspResponseMsg.RtcpInterlevedID;
                        setupSDPIndex += 1;
                        if (setupSDPIndex !== SDPinfo.length) {
                            SendRtspCommand(CommandConstructor("SETUP", SDPinfo[setupSDPIndex].trackID, setupSDPIndex));
                        } else {
                            workerManager.sendSdpInfo(SDPinfo);
                            currentState = "Play";
                            SendRtspCommand(CommandConstructor("PLAY"));
                        }
                    }

                    sessionID = rtspResponseMsg.SessionID;
                    //开始播放后，发送GET_PARAMETER进行保活
                    clearInterval(getParameterInterval);
                    getParameterInterval = setInterval(function () {
                        SendRtspCommand(CommandConstructor("GET_PARAMETER", null))
                    }, SEND_GETPARM_INTERVAL);

                    getStreamInterval = setInterval(()=>{
                        if(!getBitStream()) {
                            console.log('超时！');
                            noStreamCallback && noStreamCallback();
                        }
                    }, 5000);
                    break;
                case "Play":

                    break;
                default:
                    console.log('暂不支持的信令');
                    break;
            }
        } else if (rtspResponseMsg.ResponseCode === RTSP_STATE.NOTSERVICE) { //服务不可用

        } else if (rtspResponseMsg.ResponseCode === RTSP_STATE.NOTFOUND) { //Not Found

        }
    }

    /**
     * 发送rtsp信令
     * @param sendMessage
     * @constructor
     */
    function SendRtspCommand(sendMessage) {
        //console.log(sendMessage)
        if (websocket !== null && websocket.readyState === WebSocket.OPEN) {
            if (describekey === false) {
                let describeCmd = sendMessage.search("DESCRIBE");
                if (describeCmd !== -1) {
                    IsDescribe = true;
                    describekey = true;
                }
            }
            //console.log(sendMessage)
            websocket.send(StringToU8Array(sendMessage))
        } else {
            console.log('websocket未连接')
        }
    }

    /**
     * 组装RTSP信令
     * @param method
     * @param trackID
     * @returns {*}
     * @constructor
     */
    function CommandConstructor(method, trackID, interleaved) {
        let sendMessage;
        switch (method) {
            case"OPTIONS":
            case"TEARDOWN":
            case"SET_PARAMETERS":
            case"DESCRIBE":
                //TODO: 保活
                sendMessage = method + " " + rtspURL + " RTSP/1.0\r\nCSeq: " + CSeq + "\r\n" + Authentication;
                break;
            case"SETUP":
                //console.log(trackID)
                //TODO 多trackID的时候测试一下
                sendMessage = method + " " + rtspURL + "/" + trackID + " RTSP/1.0\r\nCSeq: " + CSeq + Authentication + "Transport:RTP/AVP/TCP;unicast;interleaved=" + 2 * interleaved + "-" + (2 * interleaved + 1) + "\r\n";
                if(sessionID == 0) {
                    sendMessage += "\r\n";
                } else {
                    sendMessage += "Session: " + sessionID + "\r\n\r\n";
                }
                break;
            case"PLAY":
                sendMessage = method + " " + rtspURL + " RTSP/1.0\r\nCSeq: " + CSeq + "\r\nSession: " + sessionID + "\r\n" + "Range: npt=0.000-\r\n" + Authentication;
                break;
            case"PAUSE":
                sendMessage = method + " " + rtspURL + " RTSP/1.0\r\nCSeq: " + CSeq + "\r\nSession: " + sessionID + "\r\n\r\n";
                break;
            case"GET_PARAMETER":
                sendMessage = method + " " + rtspURL + " RTSP/1.0\r\nCSeq: " + CSeq + "\r\nSession: " + sessionID + "\r\n"  + Authentication;
                break;
            default:
                console.log('暂不支持的RTSP信令');
        }
        //console.log(sendMessage);
        return sendMessage;
    }

    /**
     * 解析RTSP信令
     * @param message1
     */
    function parseRtsp(message1) {
        let RtspResponseData = {};
        let cnt = 0, cnt1 = 0, ttt = null, LineTokens = null;
        let message = null;
        if (message1.search("Content-Type: application/sdp") !== -1) {
            let messageTok = message1.split("\r\n\r\n");
            message = messageTok[0]
        } else {
            message = message1
        }
        let TokenziedResponseLines = message.split("\r\n");
        let ResponseCodeTokens = TokenziedResponseLines[0].split(" ");
        if (ResponseCodeTokens.length > 2) {
            RtspResponseData.ResponseCode = parseInt(ResponseCodeTokens[1]);
            RtspResponseData.ResponseMessage = ResponseCodeTokens[2]
        }
        if (RtspResponseData.ResponseCode === RTSP_STATE.OK) {
            for (cnt = 1; cnt < TokenziedResponseLines.length; cnt++) {
                LineTokens = TokenziedResponseLines[cnt].split(":");
                if (LineTokens[0] === "Public") {
                    RtspResponseData.MethodsSupported = LineTokens[1].split(",")
                } else if (LineTokens[0] === "CSeq") {
                    RtspResponseData.CSeq = parseInt(LineTokens[1])
                } else if (LineTokens[0] === "Content-Type") {
                    RtspResponseData.ContentType = LineTokens[1];
                    if (RtspResponseData.ContentType.search("application/sdp") !== -1) {
                        RtspResponseData.SDPData = parseDescribeResponse(message1)
                    }
                } else if (LineTokens[0] === "Content-Length") {
                    RtspResponseData.ContentLength = parseInt(LineTokens[1])
                } else if (LineTokens[0] === "Content-Base") {
                    let ppos = TokenziedResponseLines[cnt].search("Content-Base:");
                    if (ppos !== -1) {
                        RtspResponseData.ContentBase = TokenziedResponseLines[cnt].substr(ppos + 13)
                    }
                } else if (LineTokens[0] === "Session") {
                    let SessionTokens = LineTokens[1].split(";");
                    //RtspResponseData.SessionID = parseInt(SessionTokens[0])
                    //console.log(SessionTokens[0])
                    RtspResponseData.SessionID = SessionTokens[0].trim();
                } else if (LineTokens[0] === "Transport") {
                    let TransportTokens = LineTokens[1].split(";");
                    for (cnt1 = 0; cnt1 < TransportTokens.length; cnt1++) {
                        let tpos = TransportTokens[cnt1].search("interleaved=");
                        if (tpos !== -1) {
                            let interleaved = TransportTokens[cnt1].substr(tpos + 12);
                            let interleavedTokens = interleaved.split("-");
                            if (interleavedTokens.length > 1) {
                                RtspResponseData.RtpInterlevedID = parseInt(interleavedTokens[0]);
                                RtspResponseData.RtcpInterlevedID = parseInt(interleavedTokens[1])
                            }
                        }
                    }
                } else if (LineTokens[0] === "RTP-Info") {
                    LineTokens[1] = TokenziedResponseLines[cnt].substr(9);
                    let RTPInfoTokens = LineTokens[1].split(",");
                    RtspResponseData.RTPInfoList = [];
                    for (cnt1 = 0; cnt1 < RTPInfoTokens.length; cnt1++) {
                        let RtpTokens = RTPInfoTokens[cnt1].split(";");
                        let RtpInfo = {};
                        for (let cnt2 = 0; cnt2 < RtpTokens.length; cnt2++) {
                            let poss = RtpTokens[cnt2].search("url=");
                            if (poss !== -1) {
                                RtpInfo.URL = RtpTokens[cnt2].substr(poss + 4)
                            }
                            poss = RtpTokens[cnt2].search("seq=");
                            if (poss !== -1) {
                                RtpInfo.Seq = parseInt(RtpTokens[cnt2].substr(poss + 4))
                            }
                        }
                        RtspResponseData.RTPInfoList.push(RtpInfo)
                    }
                }
            }
        } else if (RtspResponseData.ResponseCode === RTSP_STATE.UNAUTHORIZED) {
            for (cnt = 1; cnt < TokenziedResponseLines.length; cnt++) {
                LineTokens = TokenziedResponseLines[cnt].split(":");
                if (LineTokens[0] === "CSeq") {
                    RtspResponseData.CSeq = parseInt(LineTokens[1])
                } else if (LineTokens[0] === "WWW-Authenticate") {
                    let AuthTokens = LineTokens[1].split(",");
                    for (cnt1 = 0; cnt1 < AuthTokens.length; cnt1++) {
                        let pos = AuthTokens[cnt1].search("Digest realm=");
                        if (pos !== -1) {
                            ttt = AuthTokens[cnt1].substr(pos + 13);
                            let realmtok = ttt.split('"');
                            RtspResponseData.Realm = realmtok[1]
                        }
                        pos = AuthTokens[cnt1].search("nonce=");
                        if (pos !== -1) {
                            ttt = AuthTokens[cnt1].substr(pos + 6);
                            let noncetok = ttt.split('"');
                            RtspResponseData.Nonce = noncetok[1]
                        }
                    }
                }
            }
        }
        return RtspResponseData
    }

    /**
     * 解析Describe信令
     * @param message1
     */
    function parseDescribeResponse(message1) {
        //console.log(message1)
        let SDPData = {};
        let Sessions = [];
        SDPData.Sessions = Sessions;
        let message = null;
        if (message1.search("Content-Type: application/sdp") !== -1) {
            let messageTok = message1.split("\r\n\r\n");
            message = messageTok[1]
        } else {
            message = message1
        }
        let TokenziedDescribe = message.split("\r\n");
        let mediaFound = false;
        for (let cnt = 0; cnt < TokenziedDescribe.length; cnt++) {
            let SDPLineTokens = TokenziedDescribe[cnt].split("=");
            if (SDPLineTokens.length > 0) {
                switch (SDPLineTokens[0]) {
                    case"a":
                        let aLineToken = SDPLineTokens[1].split(":");
                        if (aLineToken.length > 1) {
                            if (aLineToken[0] === "control") {
                                let pos = TokenziedDescribe[cnt].search("control:");
                                if (mediaFound === true) {
                                    if (pos !== -1) {
                                        SDPData.Sessions[SDPData.Sessions.length - 1].ControlURL = TokenziedDescribe[cnt].substr(pos + 8)
                                    }
                                } else {
                                    if (pos !== -1) {
                                        SDPData.BaseURL = TokenziedDescribe[cnt].substr(pos + 8)
                                    }
                                }
                            } else if (aLineToken[0] === "rtpmap") {
                                //console.log(aLineToken)
                                let rtpmapLine = aLineToken[1].split(" ");
                                //console.log(rtpmapLine)
                                SDPData.Sessions[SDPData.Sessions.length - 1].PayloadType = rtpmapLine[0];
                                let MimeLine = rtpmapLine[1].split("/");
                                SDPData.Sessions[SDPData.Sessions.length - 1].CodecMime = MimeLine[0];
                                if (MimeLine.length > 1) {
                                    SDPData.Sessions[SDPData.Sessions.length - 1].ClockFreq = MimeLine[1]
                                }
                            } else if (aLineToken[0] === "framesize") {
                                let framesizeLine = aLineToken[1].split(" ");
                                if (framesizeLine.length > 1) {
                                    let framesizeinf = framesizeLine[1].split("-");
                                    SDPData.Sessions[SDPData.Sessions.length - 1].Width = framesizeinf[0];
                                    SDPData.Sessions[SDPData.Sessions.length - 1].Height = framesizeinf[1]
                                }
                            } else if (aLineToken[0] === "framerate") {
                                SDPData.Sessions[SDPData.Sessions.length - 1].Framerate = aLineToken[1]
                            } else if (aLineToken[0] === "fmtp") {
                                let sessLine = TokenziedDescribe[cnt].split(" ");
                                if (sessLine.length < 2) {
                                    continue
                                }
                                for (let ii = 1; ii < sessLine.length; ii++) {
                                    let sessToken = sessLine[ii].split(";");
                                    let sessprmcnt = 0;
                                    for (sessprmcnt = 0; sessprmcnt < sessToken.length; sessprmcnt++) {
                                        let ppos = sessToken[sessprmcnt].search("mode=");
                                        if (ppos !== -1) {
                                            SDPData.Sessions[SDPData.Sessions.length - 1].mode = sessToken[sessprmcnt].substr(ppos + 5)
                                        }
                                        ppos = sessToken[sessprmcnt].search("config=");
                                        if (ppos !== -1) {
                                            SDPData.Sessions[SDPData.Sessions.length - 1].config = sessToken[sessprmcnt].substr(ppos + 7);
                                            AACCodecInfo.config = SDPData.Sessions[SDPData.Sessions.length - 1].config;
                                            AACCodecInfo.clockFreq = SDPData.Sessions[SDPData.Sessions.length - 1].ClockFreq;
                                            AACCodecInfo.bitrate = SDPData.Sessions[SDPData.Sessions.length - 1].Bitrate
                                        }
                                        ppos = sessToken[sessprmcnt].search("sprop-vps=");
                                        if (ppos !== -1) {
                                            SDPData.Sessions[SDPData.Sessions.length - 1].VPS = sessToken[sessprmcnt].substr(ppos + 10)
                                        }
                                        ppos = sessToken[sessprmcnt].search("sprop-sps=");
                                        if (ppos !== -1) {
                                            SDPData.Sessions[SDPData.Sessions.length - 1].SPS = sessToken[sessprmcnt].substr(ppos + 10)
                                        }
                                        ppos = sessToken[sessprmcnt].search("sprop-pps=");
                                        if (ppos !== -1) {
                                            SDPData.Sessions[SDPData.Sessions.length - 1].PPS = sessToken[sessprmcnt].substr(ppos + 10)
                                        }
                                        ppos = sessToken[sessprmcnt].search("sprop-parameter-sets=");
                                        if (ppos !== -1) {
                                            let SPSPPS = sessToken[sessprmcnt].substr(ppos + 21);
                                            let SPSPPSTokenized = SPSPPS.split(",");
                                            if (SPSPPSTokenized.length > 1) {
                                                SDPData.Sessions[SDPData.Sessions.length - 1].SPS = SPSPPSTokenized[0];
                                                SDPData.Sessions[SDPData.Sessions.length - 1].PPS = SPSPPSTokenized[1]
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    case"m":
                        let mLineToken = SDPLineTokens[1].split(" ");
                        let Session = {};
                        Session.Type = mLineToken[0];
                        Session.Port = mLineToken[1];
                        Session.Payload = mLineToken[3];
                        SDPData.Sessions.push(Session);
                        mediaFound = true;
                        break;
                    case"b":
                        if (mediaFound === true) {
                            let bLineToken = SDPLineTokens[1].split(":");
                            SDPData.Sessions[SDPData.Sessions.length - 1].Bitrate = bLineToken[1]
                        }
                        break
                }
            }
        }
        return SDPData
    };

    function formDigest(message) {
        let {Nonce, Realm} = message;
        //Realm = '54c415830ec4';
        //Nonce = 'fb01c51948704e59eb5a474b33caff8b';
        let user = {
            username: username,
            password: password,
        }
        let hex1 = hex_md5(user.username + ":" + Realm + ":" + user.password);
        let hex2 = hex_md5(currentState.toUpperCase() + ":" + rtspURL);
        let responce = hex_md5(hex1 + ":" + Nonce + ":" + hex2);
        Authentication = 'Authorization: Digest username="' + user.username + '", realm="' + Realm + '", nonce="' + Nonce + '",uri="' + rtspURL + '", response="' + responce + '"\r\n' + "Accept: application/sdp\r\n" + '\r\n';

        return  currentState.toUpperCase() + " " + rtspURL + " RTSP/1.0\r\nCSeq: " + CSeq + "\r\n" + Authentication;
    }


    function getBitStream() {
        if(lastStreamTime === null) {
            lastStreamTime = Date.now();
        } else {
            //console.log(Date.now() - lastStreamTime)
            return Date.now() - lastStreamTime < 5000;
        }
    }
}

export default WebSocketServer;
