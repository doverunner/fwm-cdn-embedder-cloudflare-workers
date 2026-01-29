import wmUtil from './wmUtil.js';

const createWatermarkUrl = (contentPath, watermark, prefixFolder = '', streamingFormat = '', gop = 60) => {
    let responseUrl = '';
    let waterInfo = {};
    let seqNumber = -1;

    if ('' !== prefixFolder) {
        responseUrl = `/${prefixFolder}`;
    }

    // file name start index
    const fileNameIdx = contentPath.lastIndexOf('/');

    // file path
    waterInfo.path = contentPath.substring(0, fileNameIdx + 1);
    waterInfo.fileName = contentPath.substring(fileNameIdx + 1);

    // file name (exclude extension) and extension
    const extIdx = waterInfo.fileName.lastIndexOf('.');
    waterInfo.name = waterInfo.fileName.substring(0, extIdx);
    waterInfo.extension = waterInfo.fileName.substring(extIdx + 1);
    waterInfo.markedFileUrl = '';

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
            waterInfo.markedFileUrl = wmUtil.makeWatermarkPathFile(waterInfo.path, waterInfo.fileName, waterInfo.wmFlag);
            break;
        case 'mp4':
        case 'm4s':
            if (waterInfo.name.endsWith('_init')) {
                break;
            }

            seqNumber = wmUtil.getSequenceNumber(waterInfo.name, waterInfo.extension);
            if (seqNumber < 0) {
                break;
            }

            if ('hls' === streamingFormat) {
                startNum = 1;
            }

            waterInfo.wmFlag = wmUtil.makeWatermarkFlag(watermark, startNum, seqNumber, gop);
            waterInfo.markedFileUrl = wmUtil.makeWatermarkPathFile(waterInfo.path, waterInfo.fileName, waterInfo.wmFlag);
            break;
        default:
            break;
    }

    if ('' === waterInfo.markedFileUrl) {
        waterInfo.markedFileUrl = waterInfo.path + waterInfo.fileName;
    }

    return responseUrl + waterInfo.markedFileUrl;
}

export default { createWatermarkUrl }
