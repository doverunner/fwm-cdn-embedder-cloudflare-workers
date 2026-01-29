import wmUtil from './wmUtil.js';

const createWatermarkUrl = (contentPath, watermark, prefixFolder = '', streamingFormat = '', gop = 60) => {
    let responseUrl = `/${prefixFolder}`;
    let waterInfo = {};

    // file name start index
    waterInfo.fileNameIdx = contentPath.lastIndexOf('/');
    waterInfo.fileName = contentPath.substring(waterInfo.fileNameIdx + 1);

    const extIdx = waterInfo.fileName.lastIndexOf('.');
    waterInfo.name = waterInfo.fileName.substring(0, extIdx);
    waterInfo.extension = waterInfo.fileName.substring(extIdx + 1);

    const prefixPath = contentPath.substring(0, waterInfo.fileNameIdx);

    let startNum = 0;

    switch (waterInfo.extension) {
        case 'mpd':
            responseUrl += wmUtil.makeWatermarkPathByDir(contentPath, 2);
            break;
        case 'm3u8':
            if (-1 < waterInfo.fileName.indexOf('master')) {
                responseUrl += wmUtil.makeWatermarkPathByDir(contentPath, 2);
            } else if ('stream.m3u8' === waterInfo.fileName || 'iframes.m3u8' === waterInfo.fileName) {
                responseUrl += wmUtil.makeWatermarkPathByDir(contentPath, 5);
            } else if ('subtitle.m3u8' === waterInfo.fileName) {
                responseUrl += wmUtil.makeWatermarkPathByDir(contentPath, 4);
            }
            break;
        case 'ts':
            const seqNumber = wmUtil.getSequenceNumber(waterInfo.name, 'ts');
            if (seqNumber < 0) {
                break;
            }

            if ('dash' !== streamingFormat) {
                startNum = 1;
            }

            waterInfo.wmFlag = wmUtil.makeWatermarkFlag(watermark, startNum, seqNumber, gop);
            responseUrl += wmUtil.makeWatermarkPathByDir(contentPath, 5, waterInfo.wmFlag);
            break;
        case 'm4s':
        case 'mp4':
            if (waterInfo.name.endsWith('init')) {
                responseUrl += wmUtil.makeWatermarkPathByDir(contentPath, 5);
            } else if (checkSubtitle(prefixPath)) {
                responseUrl += wmUtil.makeWatermarkPathByDir(contentPath, 4);
            } else {
                const seqNumber = wmUtil.getSequenceNumber(waterInfo.name, waterInfo.extension);
                if (seqNumber < 0) {
                    break;
                }

                if ('hls' === streamingFormat) {
                    startNum = 1;
                }

                waterInfo.wmFlag = wmUtil.makeWatermarkFlag(watermark, startNum, seqNumber, gop);
                responseUrl += wmUtil.makeWatermarkPathByDir(contentPath, 5, waterInfo.wmFlag);
            }
            break;
        case 'vtt':
            responseUrl += wmUtil.makeWatermarkPathByDir(contentPath, 4);
            break;
        case "aac":
            responseUrl += wmUtil.makeWatermarkPathByDir(contentPath, 5);
            break;
        default:
            break;
    }

    if (responseUrl === (`/${prefixFolder}`)) {
        responseUrl += makeDefaultPath(contentPath);
    }

    return responseUrl;
}

/**
 * Create a path by adding /0 in front of the flagFolders path in the contentPath.
 * @param contentPath  excluding the prefix folder path
 * @returns {string} default path
 */
const makeDefaultPath = (contentPath) => {
    const flagFolders = new Set(['dash', 'hls', 'cmaf']);

    let responseUrl = '';
    const pathArr = contentPath.split('/');
    const pathArrLength = pathArr.length;

    for (let i = 1; i < pathArrLength; i++) {
        if (flagFolders.has(pathArr[i])) {
            responseUrl += '/0';
        }
        responseUrl += '/' + pathArr[i];
    }

    return responseUrl;
}

const checkSubtitle = (prefixPath) => {
    let pathArr = prefixPath.split('/');
    let pathArrLength = pathArr.length;

    return 'subtitle' === pathArr[pathArrLength - 2];
}

export default { createWatermarkUrl };
