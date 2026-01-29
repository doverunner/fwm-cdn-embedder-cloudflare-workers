import {EmbedderException} from '../exception/embedderException.js';
import unlabeledAVariantModule from '../watermark-util/unlabeledAVariantModule.js';
import watermarkUtil from '../watermark-util/index.js';

const getContentUrl = async (requestPath, arrUri, config) => {
    if (!config.wmtPublicKey || !config.wmtPassword) {
        throw new EmbedderException('Please set wmtPublicKey or wmtPassword in config.js.');
    }
    if ('unlabeled_a_variant' !== config.type.toLowerCase()) {
        throw new EmbedderException('AkamaiWmt support only unlabeled_a_variant.');
    }

    const jwt = arrUri[1].substring(4);

    const watermark = await parsingToken(jwt, config.wmtPublicKey, config.wmtPassword);

    if (!watermark) {
        throw new EmbedderException('Fail to parsing akamai token.');
    }

    const contentPath = requestPath.substring(arrUri[1].length + 1);
    return unlabeledAVariantModule.createWatermarkUrl(contentPath, watermark);
}

/**
 * parses akamai wmt token and returns watermarkData.
 * @param jwt :wmt:{xxx}
 * @param wmtPublicKey akamai public key issued by doveRunner. wmtPublicKey in the config.js file.
 * @param passwd akamai password issued by doveRunner. wmtPassword in the config.js file.
 * @returns {Promise<string>} watermark data
 */
const parsingToken = async (jwt, wmtPublicKey, passwd) => {
    const skipBit = 4;

    if (!await tokenVerify(jwt, wmtPublicKey)) {
        throw new EmbedderException('akamaiWmt.parsingToken: Jwt is invalid.');
    }

    try {
        const payload = getPayloadFromJwt(jwt);

        const aesKey = await watermarkUtil.sha256Digest(passwd);
        const aesIv = watermarkUtil.base64ToBytes(payload['wmidivb64']);

        let binWatermarkData = await watermarkUtil.aesDecrypt(payload['wmidctb64'], aesKey, aesIv);
        binWatermarkData = binWatermarkData.replace(/A/gi, '0').replace(/B/gi, '1');
        binWatermarkData = binWatermarkData.substring(skipBit) + binWatermarkData.substring(0, skipBit);
        console.log('binWatermarkData : ', binWatermarkData);

        return watermarkUtil.utf8ToHex(binWatermarkData);
    } catch (e) {
        console.error('akamaiWmt.parsingToken.error.message: %s', e.message);
        throw new EmbedderException('Fail to parsing akamai token.');
    }
}

const getSecuredInputFromJwt = (jwt) => jwt.split('.', 2).join('.');

const getSignatureFromJwt = (jwt) => jwt.split('.')[2];

const getPayloadFromJwt = (jwt) => JSON.parse(watermarkUtil.base64Decode(jwt.split('.')[1]));

/**
 * jwt token verification - rsa256
 * @param jwt
 * @param wmtPublicKey
 * @returns {Promise<boolean>|boolean}
 */
const tokenVerify = async (jwt, wmtPublicKey) => {
    try {
        const signature = watermarkUtil.base64ToBytes(getSignatureFromJwt(jwt));
        const data = new TextEncoder().encode(getSecuredInputFromJwt(jwt));

        // PEM to DER conversion
        const pemHeader = '-----BEGIN PUBLIC KEY-----';
        const pemFooter = '-----END PUBLIC KEY-----';
        let pemContents = wmtPublicKey;

        if (wmtPublicKey.includes(pemHeader)) {
            pemContents = wmtPublicKey.substring(
                wmtPublicKey.indexOf(pemHeader) + pemHeader.length,
                wmtPublicKey.indexOf(pemFooter)
            );
        }

        const binaryDer = watermarkUtil.base64ToBytes(pemContents.replace(/\s/g, ''));

        const cryptoKey = await crypto.subtle.importKey(
            'spki',
            binaryDer,
            {
                name: 'RSASSA-PKCS1-v1_5',
                hash: 'SHA-256'
            },
            false,
            ['verify']
        );

        return await crypto.subtle.verify(
            'RSASSA-PKCS1-v1_5',
            cryptoKey,
            signature,
            data
        );
    } catch (e) {
		console.error('tokenVerify error: %s', e.message);
        return false;
    }
}

export default { getContentUrl };
