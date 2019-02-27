//import Map from './Map.js';

let BITWISE0x00000007 = 0x00000007;
let BITWISE0x7 = 0x7;
let BITWISE2 = 2;
let BITWISE3 = 3;
let BITWISE4 = 4;
let BITWISE5 = 5;
let BITWISE6 = 6;
let BITWISE8 = 8;
let BITWISE12 = 12;
let BITWISE15 = 15;
let BITWISE16 = 16;
let BITWISE32 = 32;
let BITWISE64 = 64;
let BITWISE255 = 255;
let BITWISE256 = 256;

function H264SPSParser() {
    let vBitCount = 0;
    let spsMap = null;
    let fps = null;


    function constructor() {
        spsMap = new Map();
    }

    constructor.prototype = {
        parse (pSPSBytes) {
            //console.log("=========================SPS START=========================");
            vBitCount = 0;
            spsMap.clear();

            // forbidden_zero_bit, nal_ref_idc, nal_unit_type
            spsMap.set("forbidden_zero_bit", readBits(pSPSBytes, 1));
            spsMap.set("nal_ref_idc", readBits(pSPSBytes, BITWISE2));
            spsMap.set("nal_unit_type", readBits(pSPSBytes, BITWISE5));

            // profile_idc
            spsMap.set("profile_idc", readBits(pSPSBytes, BITWISE8));
            spsMap.set("profile_compatibility", readBits(pSPSBytes, BITWISE8));

            // spsMap.set("constrained_set0_flag", readBits(pSPSBytes, 1));
            // spsMap.set("constrained_set1_flag", readBits(pSPSBytes, 1));
            // spsMap.set("constrained_set2_flag", readBits(pSPSBytes, 1));
            // spsMap.set("constrained_set3_flag", readBits(pSPSBytes, 1));
            // spsMap.set("constrained_set4_flag", readBits(pSPSBytes, 1));
            // spsMap.set("constrained_set5_flag", readBits(pSPSBytes, 1));
            // spsMap.set("reserved_zero_2bits", readBits(pSPSBytes, 2));

            // level_idc
            spsMap.set("level_idc", readBits(pSPSBytes, BITWISE8));
            spsMap.set("seq_parameter_set_id", ue(pSPSBytes, 0));

            let profileIdc = spsMap.get("profile_idc");
            let BITWISE100 = 100;
            let BITWISE110 = 110;
            let BITWISE122 = 122;
            let BITWISE244 = 244;
            let BITWISE44 = 44;
            let BITWISE83 = 83;
            let BITWISE86 = 86;
            let BITWISE118 = 118;
            let BITWISE128 = 128;
            let BITWISE138 = 138;
            let BITWISE139 = 139;
            let BITWISE134 = 134;

            if ((profileIdc === BITWISE100) || (profileIdc === BITWISE110) ||
                (profileIdc === BITWISE122) || (profileIdc === BITWISE244) ||
                (profileIdc === BITWISE44) || (profileIdc === BITWISE83) ||
                (profileIdc === BITWISE86) || (profileIdc === BITWISE118) ||
                (profileIdc === BITWISE128) || (profileIdc === BITWISE138) ||
                (profileIdc === BITWISE139) || (profileIdc === BITWISE134)) {
                spsMap.set("chroma_format_idc", ue(pSPSBytes, 0));
                if (spsMap.get("chroma_format_idc") === BITWISE3) {
                    spsMap.set("separate_colour_plane_flag", readBits(pSPSBytes, 1));
                }

                spsMap.set("bit_depth_luma_minus8", ue(pSPSBytes, 0));
                spsMap.set("bit_depth_chroma_minus8", ue(pSPSBytes, 0));
                spsMap.set("qpprime_y_zero_transform_bypass_flag", readBits(pSPSBytes, 1));
                spsMap.set("seq_scaling_matrix_present_flag", readBits(pSPSBytes, 1));

                if (spsMap.get("seq_scaling_matrix_present_flag")) {
                    let num = spsMap.get("chroma_format_idc") !== BITWISE3 ? BITWISE8 : BITWISE12;
                    let seqScalingListPresentFlag = new Array(num);
                    for (let i = 0; i < num; i++) {
                        seqScalingListPresentFlag[i] = readBits(pSPSBytes, 1);

                        if (seqScalingListPresentFlag[i]) {
                            let slNumber = i < BITWISE6 ? BITWISE16 : BITWISE64;
                            let lastScale = 8;
                            let nextScale = 8;
                            let deltaScale = 0;

                            for (let j = 0; j < slNumber; j++) {
                                if (nextScale) {
                                    deltaScale = se(pSPSBytes, 0);
                                    nextScale = (lastScale + deltaScale + BITWISE256) % BITWISE256;
                                }
                                lastScale = (nextScale === 0) ? lastScale : nextScale;
                            }
                        }
                    }
                    spsMap.set("seq_scaling_list_present_flag", seqScalingListPresentFlag);
                }
            }
            spsMap.set("log2_max_frame_num_minus4", ue(pSPSBytes, 0));
            spsMap.set("pic_order_cnt_type", ue(pSPSBytes, 0));

            if (spsMap.get("pic_order_cnt_type") === 0) {
                spsMap.set("log2_max_pic_order_cnt_lsb_minus4", ue(pSPSBytes, 0));
            } else if (spsMap.get("pic_order_cnt_type") === 1) {
                spsMap.set("delta_pic_order_always_zero_flag", readBits(pSPSBytes, 1));
                spsMap.set("offset_for_non_ref_pic", se(pSPSBytes, 0));
                spsMap.set("offset_for_top_to_bottom_field", se(pSPSBytes, 0));
                spsMap.set("num_ref_frames_in_pic_order_cnt_cycle", ue(pSPSBytes, 0));
                for (let numR = 0; numR < spsMap.get("num_ref_frames_in_pic_order_cnt_cycle"); numR++) {
                    spsMap.set("num_ref_frames_in_pic_order_cnt_cycle", se(pSPSBytes, 0));
                }
            }
            spsMap.set("num_ref_frames", ue(pSPSBytes, 0));
            spsMap.set("gaps_in_frame_num_value_allowed_flag", readBits(pSPSBytes, 1));
            spsMap.set("pic_width_in_mbs_minus1", ue(pSPSBytes, 0));
            spsMap.set("pic_height_in_map_units_minus1", ue(pSPSBytes, 0));
            spsMap.set("frame_mbs_only_flag", readBits(pSPSBytes, 1));

            if (spsMap.get("frame_mbs_only_flag") === 0) {
                spsMap.set("mb_adaptive_frame_field_flag", readBits(pSPSBytes, 1));
            }
            spsMap.set("direct_8x8_interence_flag", readBits(pSPSBytes, 1));
            spsMap.set("frame_cropping_flag", readBits(pSPSBytes, 1));
            if (spsMap.get("frame_cropping_flag") === 1) {
                spsMap.set("frame_cropping_rect_left_offset", ue(pSPSBytes, 0));
                spsMap.set("frame_cropping_rect_right_offset", ue(pSPSBytes, 0));
                spsMap.set("frame_cropping_rect_top_offset", ue(pSPSBytes, 0));
                spsMap.set("frame_cropping_rect_bottom_offset", ue(pSPSBytes, 0));
            }

            //vui parameters
            spsMap.set("vui_parameters_present_flag", readBits(pSPSBytes, 1));
            if (spsMap.get("vui_parameters_present_flag")) {
                vuiParameters(pSPSBytes);
            }

            //console.log("=========================SPS END=========================");


            return true;
        },
        getSizeInfo () {
            let SubWidthC = 0;
            let SubHeightC = 0;

            if (spsMap.get("chroma_format_idc") === 0) { //monochrome
                SubWidthC = SubHeightC = 0;
            } else if (spsMap.get("chroma_format_idc") === 1) { //4:2:0
                SubWidthC = SubHeightC = BITWISE2;
            } else if (spsMap.get("chroma_format_idc") === BITWISE2) { //4:2:2
                SubWidthC = BITWISE2;
                SubHeightC = 1;
            } else if (spsMap.get("chroma_format_idc") === BITWISE3) { //4:4:4
                if (spsMap.get("separate_colour_plane_flag") === 0) {
                    SubWidthC = SubHeightC = 1;
                } else if (spsMap.get("separate_colour_plane_flag") === 1) {
                    SubWidthC = SubHeightC = 0;
                }
            }

            let PicWidthInMbs = spsMap.get("pic_width_in_mbs_minus1") + 1;

            let PicHeightInMapUnits = spsMap.get("pic_height_in_map_units_minus1") + 1;
            let FrameHeightInMbs = (BITWISE2 - spsMap.get("frame_mbs_only_flag")) * PicHeightInMapUnits;

            let cropLeft = 0;
            let cropRight = 0;
            let cropTop = 0;
            let cropBottom = 0;

            if (spsMap.get("frame_cropping_flag") === 1) {
                cropLeft = spsMap.get("frame_cropping_rect_left_offset");
                cropRight = spsMap.get("frame_cropping_rect_right_offset");
                cropTop = spsMap.get("frame_cropping_rect_top_offset");
                cropBottom = spsMap.get("frame_cropping_rect_bottom_offset");
            }
            let decodeSize = (PicWidthInMbs * BITWISE16) * (FrameHeightInMbs * BITWISE16);
            let width = (PicWidthInMbs * BITWISE16) - (SubWidthC * (cropLeft + cropRight));
            let height = (FrameHeightInMbs * BITWISE16) -
                (SubHeightC * (BITWISE2 - spsMap.get("frame_mbs_only_flag")) * (cropTop + cropBottom));

            let sizeInfo = {
                'width': width,
                'height': height,
                'decodeSize': decodeSize,
            };

            return sizeInfo;
        },
        getSpsValue (key) {
            return spsMap.get(key);
        },
        getCodecInfo () {
            let profileIdc = spsMap.get("profile_idc").toString(BITWISE16);
            let profileCompatibility = spsMap.get("profile_compatibility") < BITWISE15 ?
                "0" + spsMap.get("profile_compatibility").toString(BITWISE16) :
                spsMap.get("profile_compatibility").toString(BITWISE16);

            let levelIdc = spsMap.get("level_idc").toString(BITWISE16);

            //console.log("getCodecInfo = " + (profile_idc + profile_compatibility + level_idc));
            return profileIdc + profileCompatibility + levelIdc;

        },

        getSpsMap() {
            return spsMap;
        },

        getFPS() {
            return fps;
        }
    }

    return new constructor();

    function getBit(base, offset) {
        let offsetData = offset;
        let vCurBytes = (vBitCount + offsetData) >> BITWISE3;
        offsetData = (vBitCount + offset) & BITWISE0x00000007;
        return (((base[(vCurBytes)])) >> (BITWISE0x7 - (offsetData & BITWISE0x7))) & 0x1;
    }

    function readBits(pBuf, vReadBits) {
        let vOffset = 0;
        let vTmp = 0,
            vTmp2 = 0;

        if (vReadBits === 1) {
            vTmp = getBit(pBuf, vOffset);
        } else {
            for (let i = 0; i < vReadBits; i++) {
                vTmp2 = getBit(pBuf, i);
                vTmp = (vTmp << 1) + vTmp2;
            }
        }

        vBitCount += vReadBits;
        return vTmp;
    }

    function ue(base, offset) {
        let zeros = 0,
            vTmp = 0,
            vReturn = 0;
        let vIdx = offset;
        do {
            vTmp = getBit(base, vIdx++);
            if (vTmp === 0) {
                zeros++;
            }
        } while (0 === vTmp);

        if (zeros === 0) {
            vBitCount += 1;
            return 0;
        }

        vReturn = 1 << zeros;

        for (let i = zeros - 1; i >= 0; i--, vIdx++) {
            vTmp = getBit(base, vIdx);
            vReturn |= vTmp << i;
        }

        let addBitCount = (zeros * BITWISE2) + 1;
        vBitCount += addBitCount;

        return (vReturn - 1);
    }

    function se(base, offset) {
        let vReturn = ue(base, offset);

        if (vReturn & 0x1) {
            return (vReturn + 1) / BITWISE2;
        } else {
            return -vReturn / BITWISE2;
        }
    }

    function hrdParameters(pSPSBytes) {
        spsMap.set("cpb_cnt_minus1", ue(pSPSBytes, 0));
        spsMap.set("bit_rate_scale", readBits(pSPSBytes, BITWISE4));
        spsMap.set("cpb_size_scale", readBits(pSPSBytes, BITWISE4));
        let cpdCntMinus1 = spsMap.get("cpb_cnt_minus1");
        let bitRateValueMinus1 = new Array(cpdCntMinus1);
        let cpbSizeValueMinus1 = new Array(cpdCntMinus1);
        let cbrFlag = new Array(cpdCntMinus1);
        //Todo: 原本为i <= cpdCntMinus1，运行到此处时直接停住，原因不明，改为<后正常
        for (let i = 0; i < cpdCntMinus1; i++) {
            bitRateValueMinus1[i] = ue(pSPSBytes, 0);
            cpbSizeValueMinus1[i] = ue(pSPSBytes, 0);
            cbrFlag[i] = readBits(pSPSBytes, 1);
        }
        spsMap.set("bit_rate_value_minus1", bitRateValueMinus1);
        spsMap.set("cpb_size_value_minus1", cpbSizeValueMinus1);
        spsMap.set("cbr_flag", cbrFlag);

        spsMap.set("initial_cpb_removal_delay_length_minus1", readBits(pSPSBytes, BITWISE4));
        spsMap.set("cpb_removal_delay_length_minus1", readBits(pSPSBytes, BITWISE4));
        spsMap.set("dpb_output_delay_length_minus1", readBits(pSPSBytes, BITWISE4));
        spsMap.set("time_offset_length", readBits(pSPSBytes, BITWISE4));
    }

    function vuiParameters(pSPSBytes) {
        spsMap.set("aspect_ratio_info_present_flag", readBits(pSPSBytes, 1));
        if (spsMap.get("aspect_ratio_info_present_flag")) {
            spsMap.set("aspect_ratio_idc", readBits(pSPSBytes, BITWISE8));
            //Extended_SAR
            if (spsMap.get("aspect_ratio_idc") === BITWISE255) {
                spsMap.set("sar_width", readBits(pSPSBytes, BITWISE16));
                spsMap.set("sar_height", readBits(pSPSBytes, BITWISE16));
            }
        }

        spsMap.set("overscan_info_present_flag", readBits(pSPSBytes, 1));
        if (spsMap.get("overscan_info_present_flag")) {
            spsMap.set("overscan_appropriate_flag", readBits(pSPSBytes, 1));
        }
        spsMap.set("video_signal_type_present_flag", readBits(pSPSBytes, 1));
        if (spsMap.get("video_signal_type_present_flag")) {
            spsMap.set("video_format", readBits(pSPSBytes, BITWISE3));
            spsMap.set("video_full_range_flag", readBits(pSPSBytes, 1));
            spsMap.set("colour_description_present_flag", readBits(pSPSBytes, 1));
            if (spsMap.get("colour_description_present_flag")) {
                spsMap.set("colour_primaries", readBits(pSPSBytes, BITWISE8));
                spsMap.set("transfer_characteristics", readBits(pSPSBytes, BITWISE8));
                spsMap.set("matrix_coefficients", readBits(pSPSBytes, BITWISE8));
            }
        }
        spsMap.set("chroma_loc_info_present_flag", readBits(pSPSBytes, 1));
        if (spsMap.get("chroma_loc_info_present_flag")) {
            spsMap.set("chroma_sample_loc_type_top_field", ue(pSPSBytes, 0));
            spsMap.set("chroma_sample_loc_type_bottom_field", ue(pSPSBytes, 0));
        }
        spsMap.set("timing_info_present_flag", readBits(pSPSBytes, 1));
        if (spsMap.get("timing_info_present_flag")) {
            spsMap.set("num_units_in_tick", readBits(pSPSBytes, BITWISE32));
            spsMap.set("time_scale", readBits(pSPSBytes, BITWISE32));
            spsMap.set("fixed_frame_rate_flag", readBits(pSPSBytes, 1));

            fps =  spsMap.get("time_scale") / spsMap.get("num_units_in_tick");
            if(spsMap.get("fixed_frame_rate_flag")) {
                fps = fps / 2;
            }
        }
        spsMap.set("nal_hrd_parameters_present_flag", readBits(pSPSBytes, 1));
        if (spsMap.get("nal_hrd_parameters_present_flag")) {
            hrdParameters(pSPSBytes);
        }
        spsMap.set("vcl_hrd_parameters_present_flag", readBits(pSPSBytes, 1));
        if (spsMap.get("vcl_hrd_parameters_present_flag")) {
            hrdParameters(pSPSBytes);
        }
        if (spsMap.get("nal_hrd_parameters_present_flag") ||
            spsMap.get("vcl_hrd_parameters_present_flag")) {
            spsMap.set("low_delay_hrd_flag", readBits(pSPSBytes, 1));
        }
        spsMap.set("pic_struct_present_flag", readBits(pSPSBytes, 1));
        spsMap.set("bitstream_restriction_flag", readBits(pSPSBytes, 1));
        if (spsMap.get("bitstream_restriction_flag")) {
            spsMap.set("motion_vectors_over_pic_boundaries_flag", readBits(pSPSBytes, 1));
            spsMap.set("max_bytes_per_pic_denom", ue(pSPSBytes, 0));
            spsMap.set("max_bits_per_mb_denom", ue(pSPSBytes, 0));
            spsMap.set("log2_max_mv_length_horizontal", ue(pSPSBytes, 0));
            spsMap.set("log2_max_mv_length_vertical", ue(pSPSBytes, 0));
            spsMap.set("max_num_reorder_frames", ue(pSPSBytes, 0));
            spsMap.set("max_dec_frame_buffering", ue(pSPSBytes, 0));
        }
    }
}



//export default H264SPSParser;