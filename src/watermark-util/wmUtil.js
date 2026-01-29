import watermarkUtil from './index.js';

const getSequenceNumberByPrefix = (fileName, prefix, formatName) => {
    if (!fileName.startsWith(prefix)) {
        console.log(`!! unknown .${formatName} fileName: ${fileName} (it must start with ${prefix})`);
        return -1;
    }

    const seqNumber = getValidNumber(fileName.substring(prefix.length));
    if (seqNumber < 0) {
        console.log(`!! unknown .${formatName} fileName: ${fileName} (it must be end with integer)`);
    }

    return seqNumber;
}

const getSequenceNumber = (fileName, formatName) => {
    const regExp = /.*[_-]\d/;
    if (!regExp.test(fileName)) {
        console.log(`!! unknown .${formatName} fileName: ${fileName}` );
        return -1;
    }

    let sepIdx = fileName.lastIndexOf('_');

    if (sepIdx === -1) {
        sepIdx = fileName.lastIndexOf('-');
    }

    const seqNumber = getValidNumber(fileName.substring(sepIdx+1));
    if (seqNumber < 0) {
        console.log(`!! unknown .${formatName} fileName: ${fileName} (it must be end with integer)`);
    }

    return seqNumber;
}

const getValidNumber = (str) => {
    const regExp = /^-?\d*$/;
    if (regExp.test(str)) {
		return parseInt(str);
    } else {
        return -1;
    }
}

const toWatermarkBinary = (str, gop) =>{
    let fullBin = '100010000';
    let result = '';

    if (130 === str.length) {
        fullBin = watermarkUtil.hexToUtf8(str);
    } else {
        fullBin = fullBin + (Array
            .from(str)
            .reduce((acc, char) => acc.concat(parseInt(char, 16).toString(2)), [])
            .map(bin => '0'.repeat(4 - bin.length) + bin)
            .join(''));
    }
    console.log('fullBin : ', fullBin);

    if (60 === gop) {
        result += fullBin;
    } else if (30 === gop) {
        for (let j=0; j<fullBin.length; j++) {
            result += fullBin.charAt(j);
            result += fullBin.charAt(j);
        }
    }

    return result;
}

const makeWatermarkFlag = (watermark, startNum, tsNum, gop) => {
    let index = -1;
    const accCount = 60;
    const skipBit = 4;

    // 8 bits -> 2 hex characters
    let maxSkipTs = skipBit * (accCount / gop) + startNum;
    let mark = '0';
    if (tsNum >= maxSkipTs) {
        let watermarkBin = toWatermarkBinary(watermark, gop);
        // 6.ts index 0  64
        index = tsNum - maxSkipTs;
        index = index % watermarkBin.length;
        mark = watermarkBin.charAt( index );
    }
    console.log({watermark:watermark, gop:gop, maxSkipTs:maxSkipTs, startNum:startNum, tsNum:tsNum, index:index, mark:mark});
    return mark;
}

const makeWatermarkPathByDir = (contentPath, seq, wm=0) => {
    let responseUrl = "";
    const pathArr = contentPath.split('/');
    const pathArrLength = pathArr.length;
    for (let i=1; i<pathArrLength; i++) {
        if (i === (pathArrLength-seq)) {
            responseUrl += '/' + wm;
        }
        responseUrl += '/'+ pathArr[i];
    }
    return responseUrl;
}

const makeWatermarkPathFile = (path, fileName, wm='0') => {
    if ('1' === wm) {
        return path + 'b.' + fileName;
    }else{
        return path + fileName;
    }
}

const removeRevokeToken = (arrUri) => {
    const watermarkData = arrUri[2].split('.');
    const hasRevokeToken = watermarkData.length >= 2;

    if (hasRevokeToken) {
        arrUri[2] = watermarkData[1];
    }
    return {
        modifiedArrUri:arrUri,
        hasRevokeToken
    };
};

export default {
    getSequenceNumberByPrefix,
    getSequenceNumber,
    getValidNumber,
    makeWatermarkFlag,
    makeWatermarkPathByDir,
    makeWatermarkPathFile,
    removeRevokeToken
}
