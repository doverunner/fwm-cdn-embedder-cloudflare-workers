import {EmbedderException} from '../exception/embedderException.js';
import watermarkUtil from '../watermark-util/index.js';
import mediaConvertModule from '../watermark-util/mediaConvertModule.js';
import unlabeledAVariantModule from '../watermark-util/unlabeledAVariantModule.js';
import directoryPrefixModule from '../watermark-util/directoryPrefixModule.js';

const getContentUrl = async (requestPath, arrUri, prefixFolder, config, hasRevokeToken) => {
    let watermarkData = arrUri[2];

    let decWatermarkData = await watermarkUtil.aesDecrypt(watermarkData, config.aesKey);
    console.log('decrypt WatermarkData : ' + decWatermarkData);

    /*
    decWatermarkData format
    {
        "watermark_data": <watermark data>,
        "streaming_format": <dash/hls>,
        "gop":60,
        "timestamp": < YYYY-mm-ddThh:mm:ssZ >,
        "revoke_flag": <true,false>
    }
     */

    let watermarkInfo = JSON.parse(decWatermarkData);
    const watermark = watermarkUtil.base64ToHex(watermarkInfo.watermark_data);
    const timeStamp = watermarkInfo.timestamp;
    const streamingFormat = watermarkInfo.streaming_format;
    const revokeFlag = watermarkInfo.revoke_flag;

    // Check revoke flag - if revoke_flag is true but revoke_token was not present, deny access
    if (revokeFlag && !hasRevokeToken) {
        throw new EmbedderException('Access denied: revoke_flag is true but revoke_token was not provided');
    }

    if (watermarkUtil.checkTimeStamp(timeStamp, config.availableInterval)) {
        let fwmModule;

        const cfgType = config.type.toLowerCase();
        if ('aws' === cfgType) {
            //Used AWS MediaConvert Service
            fwmModule = mediaConvertModule;
        } else if ('directory_prefix' === cfgType) {
            //composing type : directory_prefix
            fwmModule = directoryPrefixModule;
        } else {
            //composing type : unlabeled_a_variant
            fwmModule = unlabeledAVariantModule;
        }

        const contentPath = requestPath.substring(arrUri[2].length + 2 + prefixFolder.length);

        return fwmModule.createWatermarkUrl(contentPath, watermark, prefixFolder, streamingFormat);
    } else {
        throw new EmbedderException('The watermarkToken usage period has expired.');
    }

}

export default { getContentUrl }
