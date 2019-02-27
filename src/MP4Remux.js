let _dtsBase;
let _types = [];
let datas = {};

_types = {
    avc1: [], avcC: [], btrt: [], dinf: [],
    dref: [], esds: [], ftyp: [], hdlr: [],
    mdat: [], mdhd: [], mdia: [], mfhd: [],
    minf: [], moof: [], moov: [], mp4a: [],
    mvex: [], mvhd: [], sdtp: [], stbl: [],
    stco: [], stsc: [], stsd: [], stsz: [],
    stts: [], tfdt: [], tfhd: [], traf: [],
    trak: [], trun: [], trex: [], tkhd: [],
    vmhd: [], smhd: []
};

class MP4Remux {
    constructor() {

    }

    init() {
        for (let name in _types) {
            _types[name] = [
                name.charCodeAt(0),
                name.charCodeAt(1),
                name.charCodeAt(2),
                name.charCodeAt(3)
            ];
        }

        _dtsBase = 0;

        datas.FTYP = new Uint8Array([
            0x69, 0x73, 0x6F, 0x6D, // major_brand: isom
            0x0, 0x0, 0x0, 0x1,  // minor_version: 0x01
            0x69, 0x73, 0x6F, 0x6D, // isom
            0x61, 0x76, 0x63, 0x31  // avc1
        ]);

        datas.STSD_PREFIX = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x01  // entry_count
        ]);

        datas.STTS = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00  // entry_count
        ]);

        datas.STSC = datas.STCO = datas.STTS;

        datas.STSZ = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // sample_size
            0x00, 0x00, 0x00, 0x00  // sample_count
        ]);

        datas.HDLR_VIDEO = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // pre_defined
            0x76, 0x69, 0x64, 0x65, // handler_type: 'vide'
            0x00, 0x00, 0x00, 0x00, // reserved: 3 * 4 bytes
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x56, 0x69, 0x64, 0x65,
            0x6F, 0x48, 0x61, 0x6E,
            0x64, 0x6C, 0x65, 0x72, 0x00 // name: VideoHandler
        ]);

        datas.HDLR_AUDIO = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // pre_defined
            0x73, 0x6F, 0x75, 0x6E, // handler_type: 'soun'
            0x00, 0x00, 0x00, 0x00, // reserved: 3 * 4 bytes
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x53, 0x6F, 0x75, 0x6E,
            0x64, 0x48, 0x61, 0x6E,
            0x64, 0x6C, 0x65, 0x72, 0x00 // name: SoundHandler
        ]);

        datas.DREF = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x01, // entry_count
            0x00, 0x00, 0x00, 0x0C, // entry_size
            0x75, 0x72, 0x6C, 0x20, // type 'url '
            0x00, 0x00, 0x00, 0x01  // version(0) + flags
        ]);

        // Sound media header
        datas.SMHD = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00  // balance(2) + reserved(2)
        ]);

        // video media header
        datas.VMHD = new Uint8Array([
            0x00, 0x00, 0x00, 0x01, // version(0) + flags
            0x00, 0x00,             // graphicsmode: 2 bytes
            0x00, 0x00, 0x00, 0x00, // opcolor: 3 * 2 bytes
            0x00, 0x00
        ]);
    }

    initSegment(meta) {
        let ftyp = box(_types.ftyp, datas.FTYP);
        let moov = Moov(meta);
        let seg = new Uint8Array(ftyp.byteLength + moov.byteLength);
        seg.set(ftyp, 0);
        seg.set(moov, ftyp.byteLength);
        return seg;
    }

    mediaSegment(sequenceNumber, track, data) {
        let moof = Moof(sequenceNumber, track);
        let frameData = mdat(data);
        let seg = new Uint8Array(moof.byteLength + frameData.byteLength);
        seg.set(moof, 0);
        seg.set(frameData, moof.byteLength);
        return seg
    }
}

//组装initSegment

function Moov(meta) {
    let mvhd = Mvhd(meta.timescale, meta.duration);
    let trak = Trak(meta);
    let mvex = Mvex(meta);

    return box(_types.moov, mvhd, trak, mvex);
}

//组装moov
function Mvhd(timescale, duration) {
    return box(_types.mvhd, new Uint8Array([
        0x00, 0x00, 0x00, 0x00,    // version(0) + flags
        0x00, 0x00, 0x00, 0x00,    // creation_time
        0x00, 0x00, 0x00, 0x00,    // modification_time
        (timescale >>> 24) & 0xFF, // timescale: 4 bytes
        (timescale >>> 16) & 0xFF,
        (timescale >>>  8) & 0xFF,
        (timescale) & 0xFF,
        (duration >>> 24) & 0xFF,  // duration: 4 bytes
        (duration >>> 16) & 0xFF,
        (duration >>>  8) & 0xFF,
        (duration) & 0xFF,
        0x00, 0x01, 0x00, 0x00,    // Preferred rate: 1.0
        0x01, 0x00, 0x00, 0x00,    // PreferredVolume(1.0, 2bytes) + reserved(2bytes)
        0x00, 0x00, 0x00, 0x00,    // reserved: 4 + 4 bytes
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x01, 0x00, 0x00,    // ----begin composition matrix----
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x01, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x40, 0x00, 0x00, 0x00,    // ----end composition matrix----
        0x00, 0x00, 0x00, 0x00,    // ----begin pre_defined 6 * 4 bytes----
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,    // ----end pre_defined 6 * 4 bytes----
        0xFF, 0xFF, 0xFF, 0xFF     // next_track_ID
    ]));
}

function Trak(meta) {
    return box(_types.trak, Tkhd(meta), Mdia(meta));
}

function Mvex(meta) {
    return box(_types.mvex, trex(meta));
}

//组装trak
function Tkhd(meta) {
    let trackId = meta.id;
    let duration = meta.duration;
    let width = meta.width;
    let height = meta.height;

    return box(_types.tkhd, new Uint8Array([
        0x00, 0x00, 0x00, 0x07,   // version(0) + flags
        0x00, 0x00, 0x00, 0x00,   // creation_time
        0x00, 0x00, 0x00, 0x00,   // modification_time
        (trackId >>> 24) & 0xFF,  // track_ID: 4 bytes
        (trackId >>> 16) & 0xFF,
        (trackId >>>  8) & 0xFF,
        (trackId) & 0xFF,
        0x00, 0x00, 0x00, 0x00,   // reserved: 4 bytes
        (duration >>> 24) & 0xFF, // duration: 4 bytes
        (duration >>> 16) & 0xFF,
        (duration >>>  8) & 0xFF,
        (duration) & 0xFF,
        0x00, 0x00, 0x00, 0x00,   // reserved: 2 * 4 bytes
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,   // layer(2bytes) + alternate_group(2bytes)
        0x00, 0x00, 0x00, 0x00,   // volume(2bytes) + reserved(2bytes)
        0x00, 0x01, 0x00, 0x00,   // ----begin composition matrix----
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x01, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x40, 0x00, 0x00, 0x00,   // ----end composition matrix----
        (width >>> 8) & 0xFF,     // width and height
        (width) & 0xFF,
        0x00, 0x00,
        (height >>> 8) & 0xFF,
        (height) & 0xFF,
        0x00, 0x00
    ]));
}

function Mdia(meta) {
    return box(_types.mdia, mdhd(meta), hdlr(meta), minf(meta));
}

//组装mdia
function mdhd(meta) {
    let timescale = meta.timescale;
    let duration = meta.duration;

    return box(_types.mdhd, new Uint8Array([
        0x00, 0x00, 0x00, 0x00,    // version(0) + flags
        0x00, 0x00, 0x00, 0x00,    // creation_time
        0x00, 0x00, 0x00, 0x00,    // modification_time
        (timescale >>> 24) & 0xFF, // timescale: 4 bytes
        (timescale >>> 16) & 0xFF,
        (timescale >>>  8) & 0xFF,
        (timescale) & 0xFF,
        (duration >>> 24) & 0xFF,  // duration: 4 bytes
        (duration >>> 16) & 0xFF,
        (duration >>>  8) & 0xFF,
        (duration) & 0xFF,
        0x55, 0xC4,                // language: und (undetermined)
        0x00, 0x00                 // pre_defined = 0
    ]));
}

function hdlr(meta) {
    let data = null;

    if (meta.type === 'audio') {
        data = datas.HDLR_AUDIO;
    } else {
        data = datas.HDLR_VIDEO;
    }

    return box(_types.hdlr, data);
}

function minf(meta) {
    let xmhd = null;

    if (meta.type === 'audio') {
        xmhd = box(_types.smhd, datas.SMHD);
    } else {
        xmhd = box(_types.vmhd, datas.VMHD);
    }

    return box(_types.minf, xmhd, dinf(), stbl(meta));
}

//组装minf
function dinf() {
    return box(_types.dinf, box(_types.dref, datas.DREF));
}

function stbl(meta) {
    let result = box(_types.stbl,   // type: stbl
        stsd(meta),                   // Sample Description Table
        box(_types.stts, datas.STTS), // Time-To-Sample
        box(_types.stsc, datas.STSC), // Sample-To-Chunk
        box(_types.stsz, datas.STSZ), // Sample size
        box(_types.stco, datas.STCO)  // Chunk offset
    );

    return result;
}

//组装stbl
function stsd(meta) {
    if (meta.type === 'audio') {
        return box(_types.stsd, datas.STSD_PREFIX, mp4a(meta));
    } else {
        return box(_types.stsd, datas.STSD_PREFIX, avc1(meta));
    }
}

//组装stsd
function mp4a(meta) {
    let channelCount = meta.channelCount;
    let sampleRate = meta.audioSampleRate;

    let data = new Uint8Array([
        0x00, 0x00, 0x00, 0x00,    // reserved(4)
        0x00, 0x00, 0x00, 0x01,    // reserved(2) + data_reference_index(2)
        0x00, 0x00, 0x00, 0x00,    // reserved: 2 * 4 bytes
        0x00, 0x00, 0x00, 0x00,
        0x00, channelCount,        // channelCount(2)
        0x00, 0x10,                // sampleSize(2)
        0x00, 0x00, 0x00, 0x00,    // reserved(4)
        (sampleRate >>> 8) & 0xFF, // Audio sample rate
        (sampleRate) & 0xFF,
        0x00, 0x00
    ]);

    return box(_types.mp4a, data, esds(meta));
}

function avc1(meta) {
    let width = meta.width;
    let height = meta.height;

    let sps = meta.sps || [], pps = meta.pps || [], sequenceParameterSets = [], pictureParameterSets = [];
    for (let i = 0; i < sps.length; i++) {
        sequenceParameterSets.push((sps[i].byteLength & 65280) >>> 8);
        sequenceParameterSets.push(sps[i].byteLength & 255);
        sequenceParameterSets = sequenceParameterSets.concat(Array.prototype.slice.call(sps[i]))
    }
    for (let i = 0; i < pps.length; i++) {
        pictureParameterSets.push((pps[i].byteLength & 65280) >>> 8);
        pictureParameterSets.push(pps[i].byteLength & 255);
        pictureParameterSets = pictureParameterSets.concat(Array.prototype.slice.call(pps[i]))
    }

    //Todo: 待测，如果视频有问题，修改这里
    // let data = new Uint8Array([
    //     0x00, 0x00, 0x00, 0x00, // reserved(4)
    //     0x00, 0x00, 0x00, 0x01, // reserved(2) + data_reference_index(2)
    //     0x00, 0x00, 0x00, 0x00, // pre_defined(2) + reserved(2)
    //     0x00, 0x00, 0x00, 0x00, // pre_defined: 3 * 4 bytes
    //     0x00, 0x00, 0x00, 0x00,
    //     0x00, 0x00, 0x00, 0x00,
    //     (width >>> 8) & 0xFF,   // width: 2 bytes
    //     (width) & 0xFF,
    //     (height >>> 8) & 0xFF,  // height: 2 bytes
    //     (height) & 0xFF,
    //     0x00, 0x48, 0x00, 0x00, // horizresolution: 4 bytes
    //     0x00, 0x48, 0x00, 0x00, // vertresolution: 4 bytes
    //     0x00, 0x00, 0x00, 0x00, // reserved: 4 bytes
    //     0x00, 0x01,             // frame_count
    //     0x0A,                   // strlen
    //     0x78, 0x71, 0x71, 0x2F, // compressorname: 32 bytes
    //     0x66, 0x6C, 0x76, 0x2E,
    //     0x6A, 0x73, 0x00, 0x00,
    //     0x00, 0x00, 0x00, 0x00,
    //     0x00, 0x00, 0x00, 0x00,
    //     0x00, 0x00, 0x00, 0x00,
    //     0x00, 0x00, 0x00, 0x00,
    //     0x00, 0x00, 0x00,
    //     0x00, 0x18,             // depth
    //     0xFF, 0xFF              // pre_defined = -1
    // ]);

    let data = new Uint8Array(
        [0, 0, 0, 0,
            0, 0, 0, 1,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            (65280 & width) >> 8,
            255 & width,
            (65280 & height) >> 8,
            255 & height,
            0, 72, 0, 0,
            0, 72, 0, 0,
            0, 0, 0, 0,
            0, 1, 19, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 24, 17, 17]);

    return box(_types.avc1, data, box(_types.avcC, new Uint8Array([1, meta.profileIdc, meta.profileCompatibility, meta.levelIdc, 255].concat([sps.length]).concat(sequenceParameterSets).concat([pps.length]).concat(pictureParameterSets))));
}

//组装mp4a
function esds(meta) {
    let config = meta.config;
    let configSize = config.length;
    let data = new Uint8Array([
        0x00, 0x00, 0x00, 0x00, // version 0 + flags

        0x03,                   // descriptor_type
        0x17 + configSize,      // length3
        0x00, 0x01,             // es_id
        0x00,                   // stream_priority

        0x04,                   // descriptor_type
        0x0F + configSize,      // length
        0x40,                   // codec: mpeg4_audio
        0x15,                   // stream_type: Audio
        0x00, 0x00, 0x00,       // buffer_size
        0x00, 0x00, 0x00, 0x00, // maxBitrate
        0x00, 0x00, 0x00, 0x00, // avgBitrate

        0x05                    // descriptor_type
    ].concat(
        [configSize]
    ).concat(
        config
    ).concat(
        [0x06, 0x01, 0x02]      // GASpecificConfig
    ));

    return box(_types.esds, data);
}

//组装mvex
function trex(meta) {
    var trackId = meta.id;
    var data = new Uint8Array([
        0x00, 0x00, 0x00, 0x00,  // version(0) + flags
        (trackId >>> 24) & 0xFF, // track_ID
        (trackId >>> 16) & 0xFF,
        (trackId >>>  8) & 0xFF,
        (trackId) & 0xFF,
        0x00, 0x00, 0x00, 0x01,  // default_sample_description_index
        0x00, 0x00, 0x00, 0x00,  // default_sample_duration
        0x00, 0x00, 0x00, 0x00,  // default_sample_size
        0x00, 0x01, 0x00, 0x01   // default_sample_flags
    ]);

    return box(_types.trex, data);
}

//组装mediaSegment
function Moof(sequenceNumber, track) {
    return box(_types.moof, mfhd(sequenceNumber), traf(track));
}

function mdat(data) {
    return box(_types.mdat, data);
}

//组装moof
function mfhd(sequenceNumber) {
    var data = new Uint8Array([
        0x00, 0x00, 0x00, 0x00,
        (sequenceNumber >>> 24) & 0xFF, // sequence_number: int32
        (sequenceNumber >>> 16) & 0xFF,
        (sequenceNumber >>>  8) & 0xFF,
        (sequenceNumber) & 0xFF
    ]);

    return box(_types.mfhd, data);
}

function traf(track) {
    //console.log(track)
    var trackFragmentHeader = null, trackFragmentDecodeTime = null, trackFragmentRun = null, dataOffset = null;
    trackFragmentHeader = box(_types.tfhd, new Uint8Array([0, 2, 0, 0, 0, 0, 0, 1]));
    trackFragmentDecodeTime = box(_types.tfdt,
        new Uint8Array([
            0, 0, 0, 0,
            track.baseMediaDecodeTime >>> 24 & 255,
            track.baseMediaDecodeTime >>> 16 & 255,
            track.baseMediaDecodeTime >>> 8 & 255,
            track.baseMediaDecodeTime & 255
        ]));
    dataOffset = 16 + 16 + 8 + 16 + 8 + 8;
    trackFragmentRun = trun(track, dataOffset);
    return box(_types.traf, trackFragmentHeader, trackFragmentDecodeTime, trackFragmentRun)
}

//组装traf
function trun(track, offset) {
    if (track.type === "audio") {
        return audioTrun(track, offset)
    }
    return videoTrun(track, offset)
}

//组装trun
function videoTrun(track, _offset) {
    var bytes = null, samples = null, sample = null, i = 0;
    var offset = _offset;
    samples = track.samples || [];
    if (samples[0].frameDuration === null) {
        offset += 8 + 12 + 4 + 4 * samples.length;
        bytes = trunHeader(samples, offset);
        for (i = 0; i < samples.length; i++) {
            sample = samples[i];
            bytes = bytes.concat([(sample.size & 4278190080) >>> 24, (sample.size & 16711680) >>> 16, (sample.size & 65280) >>> 8, sample.size & 255])
        }
    } else {
        offset += 8 + 12 + 4 + 4 * samples.length + 4 * samples.length;
        bytes = trunHeader1(samples, offset);
        for (i = 0; i < samples.length; i++) {
            sample = samples[i];
            bytes = bytes.concat([(sample.frameDuration & 4278190080) >>> 24, (sample.frameDuration & 16711680) >>> 16, (sample.frameDuration & 65280) >>> 8, sample.frameDuration & 255, (sample.size & 4278190080) >>> 24, (sample.size & 16711680) >>> 16, (sample.size & 65280) >>> 8, sample.size & 255])
        }
    }
    return box(_types.trun, new Uint8Array(bytes))
}

function audioTrun(track, _offset) {
    var bytes = null, samples = null, sample = null, i = 0;
    var offset = _offset;
    samples = track.samples || [];
    offset += 8 + 12 + 8 * samples.length;
    bytes = trunHeader(samples, offset);
    for (i = 0; i < samples.length; i++) {
        sample = samples[i];
        bytes = bytes.concat([(sample.duration & 4278190080) >>> 24, (sample.duration & 16711680) >>> 16, (sample.duration & 65280) >>> 8, sample.duration & 255, (sample.size & 4278190080) >>> 24, (sample.size & 16711680) >>> 16, (sample.size & 65280) >>> 8, sample.size & 255])
    }
    return box(_types.trun, new Uint8Array(bytes))
}

//组装videoTurn
function trunHeader(samples, offset) {
    return [0, 0, 2, 5, (samples.length & 4278190080) >>> 24, (samples.length & 16711680) >>> 16, (samples.length & 65280) >>> 8, samples.length & 255, (offset & 4278190080) >>> 24, (offset & 16711680) >>> 16, (offset & 65280) >>> 8, offset & 255, 0, 0, 0, 0]
}

function trunHeader1(samples, offset) {
    return [0, 0, 3, 5, (samples.length & 4278190080) >>> 24, (samples.length & 16711680) >>> 16, (samples.length & 65280) >>> 8, samples.length & 255, (offset & 4278190080) >>> 24, (offset & 16711680) >>> 16, (offset & 65280) >>> 8, offset & 255, 0, 0, 0, 0]
}

/**
 *
 * @param type
 * @returns {Uint8Array}
 */
function box(type, ...items) {
    let size = 8;
    //Todo: 测试一下这里
    //let arrs = Array.prototype.slice.call(arguments, 1);
    let arrs = [];
    arrs.push(...items);
    for (let i = 0; i < arrs.length; i++) {
        size += arrs[i].byteLength;
    }

    let data = new Uint8Array(size);
    let pos = 0;

    // set size
    data[pos++] = size >>> 24 & 0xFF;
    data[pos++] = size >>> 16 & 0xFF;
    data[pos++] = size >>> 8 & 0xFF;
    data[pos++] = size & 0xFF;

    // set type
    data.set(type, pos);
    pos += 4;

    // set data
    for (let i = 0; i < arrs.length; i++) {
        data.set(arrs[i], pos);
        pos += arrs[i].byteLength;
    }

    return data;
}

// let mp4Remux = new MP4Remux();
// mp4Remux.init();

export default MP4Remux;