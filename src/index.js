import { CACHE_CONFIG, config } from './config.js';
import doveRunnerAes from '././wmt/doveRunnerAes.js';
import akamaiWmt from '././wmt/akamaiWmt.js';
import wmUtil from '././watermark-util/wmUtil.js';

/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */


/**
 * Check if the requested prefix folder matches the configured watermark path
 * @param {string} reqPrefixFolder - The prefix folder from the request URL
 * @returns {boolean} True if the prefix folder requires watermark processing
 */
const checkWatermarkPath = (reqPrefixFolder) => {
	const { prefixFolder } = config;
	if (Array.isArray(prefixFolder)) {
		return prefixFolder.includes(reqPrefixFolder);
	} else {
		return prefixFolder === reqPrefixFolder;
	}
}

/**
 * Determine the correct MIME type based on file extension
 * Supports HLS (m3u8, ts), MP4, and DASH (mpd, m4s) streaming formats
 * @param {string} path - The file path to analyze
 * @returns {string|null} The appropriate MIME type or null if not a streaming file
 */
const getContentType = (path) => {
	if (path.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
	if (path.endsWith('.ts')) return 'video/mp2t';
	if (path.endsWith('.mp4')) return 'video/mp4';
	if (path.endsWith('.m4s')) return 'video/iso.segment';
	if (path.endsWith('.mpd')) return 'application/dash+xml';
	return null;
}

/**
 * Check if the path is cacheable based on file extension
 * @param {string} path - The file path to check
 * @returns {boolean} True if the file extension is cacheable
 */
const isCacheable = (path) => {
	return CACHE_CONFIG.cacheableExtensions.some(ext => path.endsWith(ext));
}

/**
 * Generate a cache key URL based on finalRequestPath
 * @param {Request} request - The original request
 * @param {string} finalRequestPath - The resolved path for caching
 * @returns {string} Cache key URL
 */
const getCacheKey = (request, finalRequestPath) => {
	const url = new URL(request.url);
	// Use finalRequestPath as the cache key path
	return `${url.origin}${finalRequestPath}`;
}

/**
 * Try to get response from cache
 * @param {string} cacheKey - The cache key URL
 * @returns {Promise<Response|null>} Cached response or null
 */
const getFromCache = async (cacheKey) => {
	if (!CACHE_CONFIG.enabled) return null;

	const cache = caches.default;
	// Use a Request object to ensure consistent cache key semantics
	const cacheRequest = new Request(cacheKey, { method: 'GET' });
	console.log('Cache LOOKUP:', cacheRequest.url);
	const cachedResponse = await cache.match(cacheRequest);

	if (cachedResponse) {
		console.log('Cache HIT:', cacheKey);
		// Return a clone so we don't consume the cached body stream
		return cachedResponse.clone();
	}

	console.log('Cache MISS:', cacheKey);
	return null;
}

/**
 * Store response in cache
 * @param {string} cacheKey - The cache key URL
 * @param {Response} response - The response to cache
 * @param {Object}ctx - Execution context for waitUntil
 */
const storeInCache = (cacheKey, response, ctx) => {
	if (!CACHE_CONFIG.enabled) return;

	const cache = caches.default;

	// Clone the response so the body stream can be used for caching without affecting the client response
	const responseToCache = response.clone();

	// Ensure headers are mutable by copying them
	const headers = new Headers(responseToCache.headers);
	headers.set('Cache-Control', `public, max-age=${CACHE_CONFIG.ttl}`);

	const cacheResponse = new Response(responseToCache.body, {
		status: responseToCache.status,
		headers,
	});

	const cacheRequest = new Request(cacheKey, { method: 'GET' });
	ctx.waitUntil(cache.put(cacheRequest, cacheResponse));
	console.log('Cache PUT:', cacheRequest.url);
}

/**
 * Generate HTTP response by fetching the object from R2 bucket
 * Handles conditional requests, range requests, and sets appropriate headers for streaming
 * @param {string} finalRequestPath - The final path to fetch from R2 bucket
 * @param {Object} reqHeaders - Request headers for conditional (If-Match, If-None-Match) and range requests
 * @param {Object} env - Environment bindings containing R2 bucket (FWM_BUCKER) and other resources
 * @returns {Promise<Response>} HTTP response with the requested object or error
 */
const generateResponse = async (finalRequestPath, reqHeaders, env) => {
	const key = finalRequestPath.slice(1); // Remove leading slash for R2 key

	// Build R2 get options.
	// IMPORTANT: Only pass `range` when the request actually has a Range header.
	// If we always pass `range: reqHeaders`, some environments may treat it as a range request
	// and return 206 even when the client did not send a Range header.
	const rangeHeader = reqHeaders.get('range');
	const r2Options = {
		onlyIf: reqHeaders,
	};
	if (rangeHeader) {
		r2Options.range = reqHeaders;
	}

	const object = await env.FWM_BUCKER.get(key, r2Options);

	if (object === null) {
		return new Response("Object Not Found", { status: 404 });
	}

	// Prepare response headers with object metadata
	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);

	// Set Content-Type for streaming files
	const contentType = getContentType(key);
	if (contentType) {
		headers.set("content-type", contentType);
	}

	// Allow CORS for HLS playback
	headers.set("access-control-allow-origin", "*");

	// Handle conditional requests (304 Not Modified)
	if (!("body" in object)) {
		return new Response(null, {
			status: 304,
			headers,
		});
	}

	// Handle range requests
	const status = rangeHeader && object.range ? 206 : 200;
	if (object.range) {
		headers.set("content-range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
	}

	return new Response(object.body, {
		status,
		headers,
	});
}


/**
 * Cloudflare Worker main export
 * Handles watermarked content delivery with two methods:
 * 1. Akamai WMT (wmt: prefix)
 * 2. DoveRunner AES encryption (configured prefix folders)
 */
export default {
	/**
	 * Main fetch handler for incoming HTTP requests
	 * @param {Request} request - The incoming HTTP request
	 * @param {Object} env - Environment bindings (R2, KV, etc.)
	 * @param {Object} ctx - Execution context
	 * @returns {Promise<Response>} HTTP response
	 */
	async fetch(request, env, ctx) {
		// Handle GET and HEAD requests
		if (request.method === 'GET' || request.method === 'HEAD') {
			try {
				let finalRequestPath;
				const url = new URL(request.url);
				let arrUri = url.pathname.split('/');
				const prefixFolder = arrUri[1]; // Extract first path segment

				// Route 1: Akamai Watermark Technology
				if (prefixFolder.startsWith('wmt:')) {
					// Using akamaiWmt
					finalRequestPath = await akamaiWmt.getContentUrl(url.pathname, arrUri, config);
				} else {
					// Route 2: DoveRunner AES encryption
					// Using doveRunnerAes
					if (checkWatermarkPath(prefixFolder)) {
						// remove revoke token
						const { modifiedArrUri, hasRevokeToken } = wmUtil.removeRevokeToken(arrUri);
						arrUri = modifiedArrUri;
						const requestPath = '/' + arrUri.slice(1).join('/');

						finalRequestPath = await doveRunnerAes.getContentUrl(requestPath, arrUri, prefixFolder, config, hasRevokeToken);
					}
				}
				console.log('finalRequestPath : ', finalRequestPath)

				// Return 404 if no valid path was resolved
				if (!finalRequestPath) {
					return new Response("Not Found", { status: 404 });
				}

				// Generate cache key based on finalRequestPath
				const cacheKey = getCacheKey(request, finalRequestPath);

				// Check if this path is cacheable and not a range request
				const hasRangeHeader = request.headers.has('range');
				const shouldCache = isCacheable(finalRequestPath) && !hasRangeHeader;

				// Try to get from cache first (only for cacheable, non-range requests)
				if (shouldCache) {
					const cachedResponse = await getFromCache(cacheKey);
					if (cachedResponse) {
						// Add cache status header for debugging
						const response = new Response(cachedResponse.body, cachedResponse);
						response.headers.set('X-Cache-Status', 'HIT');
						if (request.method === 'HEAD') {
							return new Response(null, response);
						}
						return response;
					}
				}

				// Fetch from R2 bucket
				const response = await generateResponse(finalRequestPath, request.headers, env);

				// Store in cache if cacheable and response is successful
				if (shouldCache && response.status === 200) {
					// Add cache status header
					const responseWithHeader = new Response(response.clone().body, response);
					responseWithHeader.headers.set('X-Cache-Status', 'MISS');

					// Store in cache asynchronously
					storeInCache(cacheKey, response, ctx);

					if (request.method === 'HEAD') {
						return new Response(null, responseWithHeader);
					}
					return responseWithHeader;
				}

				if (request.method === 'HEAD') {
					return new Response(null, response);
				}
				return response;
			} catch (e) {
				// Handle any errors during processing
				return new Response(e.message, {
					status: 400
				});
			}
		}

		// Reject non-GET/HEAD requests
		return new Response("Method Not Allowed", {
			status: 405,
			headers: {
				Allow: "GET, HEAD",
			},
		});
	},
};
