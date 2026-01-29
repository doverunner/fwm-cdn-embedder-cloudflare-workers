export const config = {
	"aesKey": "{Your DoveRunner Site Key}",
    "type" : "unlabeled_a_variant",
    "availableInterval": 60000,
    "prefixFolder": ["dldzkdpsxmdnjrtm", "wm-contents"],
    "wmtPublicKey": "{Your DoveRunner Akamai Public Key}",
    "wmtPassword": "{Your DoveRunner Akamai Key Password}"
}

// Cache configuration
export const CACHE_CONFIG = {
	enabled: true,
	ttl: 3600, // 1 hour in seconds
	cacheableExtensions: ['.m3u8', '.ts', '.mp4', '.m4s', '.mpd'],
};
