import wmUtil from './wmUtil.js';

const createWatermarkUrl = (contentPath, watermark, prefixFolder = '', streamingFormat = '', gop = 60) => {
    let responseUrl = `/${prefixFolder}`;
    let waterInfo = {};

    // file name start index
    waterInfo.fileNameIdx = contentPath.lastIndexOf('/');
    waterInfo.fileName = contentPath.substring(waterInfo.fileNameIdx + 1);

    const extensionIdx = waterInfo.fileName.lastIndexOf('.');
    waterInfo.name = waterInfo.fileName.substring(0, extensionIdx);
    waterInfo.extension = waterInfo.fileName.substring(extensionIdx + 1);

    let seqNumber = -1;
    let startNum = 0;

    switch (waterInfo.extension) {
        case 'ts':
            seqNumber = wmUtil.getSequenceNumber(waterInfo.name, 'ts');
            if (seqNumber < 0) {
                break;
            }

            if ('dash' !== streamingFormat) {
                startNum = 1;
            }

            waterInfo.wmFlag = wmUtil.makeWatermarkFlag(watermark, startNum, seqNumber, gop);

            responseUrl += wmUtil.makeWatermarkPathByDir(contentPath, 2, waterInfo.wmFlag);
            break;
        case 'mp4':
        case 'm4s':
            //init.mp4
            if (waterInfo.fileName.toLowerCase().endsWith('init.mp4')) {
                responseUrl += wmUtil.makeWatermarkPathByDir(contentPath, 2);
            } else {
                seqNumber = wmUtil.getSequenceNumber(waterInfo.name, waterInfo.extension);
                if (seqNumber < 0) {
                    break;
                }

                if ('hls' === streamingFormat) {
                    startNum = 1;
                }

                waterInfo.wmFlag = wmUtil.makeWatermarkFlag(watermark, startNum, seqNumber, gop);
                responseUrl += wmUtil.makeWatermarkPathByDir(contentPath, 2, waterInfo.wmFlag);
            }
            break;
        default:
            responseUrl += wmUtil.makeWatermarkPathByDir(contentPath, 2);
            break;
    }

    return responseUrl;
}

export default { createWatermarkUrl };
