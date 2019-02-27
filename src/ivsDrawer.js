class IvsDrawer {
    constructor(canvas) {
        this.canvas = canvas;
        this.context = canvas.getContext('2d');
    }

    cover(video) {
        console.log('cover')
        let offsetLeft = 0, //canvas和video同级时
            offsetTop = 0,
            //offsetLeft = getOffsetRect(video).left, //canvas为body的子元素时，根据DOM文档定位
            //offsetTop = getOffsetRect(video).top,
            videoHeight = video.videoHeight,
            videoWidth = video.videoWidth,
            width = video.getBoundingClientRect().width || videoWidth,
            height = video.getBoundingClientRect().height || videoHeight;
        this.canvas.style.position = 'absolute';

        //this.canvas.style.top = offsetTop +'px';

        //this.canvas.style.height = height +'px';

        let tempHeight = width * videoHeight / videoWidth;
        if (tempHeight > height) { // 如果缩放后的高度大于标签宽度，则按照height缩放width
            this.canvas.height = height;
            this.canvas.style.top = offsetTop + 'px';
            //w/height = videoWidth / videoHeight;
            this.canvas.width = videoWidth / videoHeight * height;
            this.canvas.style.left = offsetLeft + (width - videoWidth / videoHeight * height) / 2 + 'px';
        } else {
            this.canvas.width = width;
            this.canvas.style.left = offsetLeft + 'px';
            //width/h = videoWidth / videoHeight;
            this.canvas.height = width * videoHeight / videoWidth;
            this.canvas.style.top = offsetTop + (height - width * videoHeight / videoWidth) / 2 + 'px';
        }
    }


    draw(data, time) {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.beginPath();
        data.map((content, k) => {
            //console.log(content.id)
            switch (content.type) {
                case 'rect':
                    this.context.strokeStyle = '#00ff00';
                    if(!content.quality) {
                        this.context.strokeStyle = '#ff0000';
                    }
                    this.context.lineWidth = 1;//线条的宽度

                    let rect = this._toRealCoordinate(content.rect[0], content.rect[1]);
                    rect.push.apply(rect, this._toRealCoordinate(content.rect[2], content.rect[3]));
                    this._drawRect(rect);

                    this.context.font = 'bold 20px Arial';
                    this.context.textAlign = 'left';
                    this.context.textBaseline = 'bottom';
                    this.context.fillStyle = '#00ff00';
                    // this._drawText(content.id, rect[0], rect[1]);
                    // if (content.text) {
                    //     this._drawText(content.text, rect[0], rect[1] - 20);
                    // }
                    if(content.text !== undefined) {
                        this._drawText(content.text, rect[0], rect[1]);
                    }
                    this.context.stroke();
                    //console.log('绘制 ', time)
                    break;
                case 'text':
                    break;
                default:
                    console.log('unknown ivs type: ', content.type)
                    break;
            }
        });
    }

    clearCanvas() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    terminate() {
        this.clearCanvas();
        this.canvas.width = 0;
        this.canvas.height = 0;
    }

    _drawRect(rect) {
        //console.log(rect)
        this.context.rect(rect[0], rect[1], rect[2], rect[3]);
    }

    _drawText(text, x, y) {
        this.context.fillText(text, x, y);
    }

    /**
     * 8191坐标系转真实坐标
     * @param x 8191坐标系 x坐标
     * @param y 8191坐标系 y坐标
     * @returns {number[]} 数组
     * @private
     */
    _toRealCoordinate(x, y) {
        return [parseInt(x * this.canvas.width / 8191), parseInt(y * this.canvas.height / 8191)];
    }
}

/**
 * 获取元素相对于dom文档的坐标
 * @param elem
 * @returns {{top: number, left: number}}
 */
function getOffsetRect(elem) {
    let box = elem.getBoundingClientRect();
    let body = document.body;
    let docElem = document.documentElement;
    let scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop;
    let scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft;
    let clientTop = docElem.clientTop || body.clientTop || 0;
    let clientLeft = docElem.clientLeft || body.clientLeft || 0;
    let top = box.top + scrollTop - clientTop;
    let left = box.left + scrollLeft - clientLeft;
    return {top: Math.round(top), left: Math.round(left)}
}

export default IvsDrawer;
