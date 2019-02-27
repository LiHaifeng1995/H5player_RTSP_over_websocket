import WebSocketServer from './websocketServer.js';

class Player {
    constructor(option) {
        this.ws = null;
        this.options = option;
        this.events = {
            error: ()=>{}
        };
    }

    init() {
        //console.log('init');
        this.ws = new WebSocketServer(this.options);
        this.ws.init();
    }

    connect() {
        for(let i in this.events) {
            this.ws.setCallBack(i, this.events[i]);
        }
        this.ws.connect();
    }

    play() {
        //console.log('player')
    }

    pause() {
        //console.log('pause')
    }

    close() {
        this.ws.close();
        //console.log('close1')
    }

    /**
     * 绘制额外信息
     * @param obj
     */
    updateInfo(obj) {
        this.ws.updateInfo(obj);
    }

    /**
     * 自定义事件
     * 目前支持如下事件
     * [error] websocket连接失败
     * [noStream] 收不到码流
     *
     * @param event 事件名
     * @param callback 事件响应函数
     */
    on(event, callback) {
        this.events[event] = callback;
    }
}

export default Player;

