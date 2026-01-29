# DoveRunner Forensic Watermark CDN Embedder Sample for Cloudflare Workers

This project serves as a sample implementation for embedding forensic watermarks using **Cloudflare Workers**.
It provides the basic structure and logic required to deploy watermark embedding functionality at the edge.

For more information, refer to the [Cloudflare Workers](https://developers.cloudflare.com/workers/).

## Configuration
### Configure src/config.js
Update `config.js` with your specific settings:

```javascript
export const config = {
    "aesKey": "YOUR_DOVERUNER_SITE_KEY",
    "type" : "unlabeled_a_variant",
    "availableInterval": 60000,
    "prefixFolder": ["folder1", "folder2"],
    "wmtPublicKey": "YOUR_PUBLIC_KEY", // PEM format public key for Akamai WMT
    "wmtPassword": "YOUR_PASSWORD" // Password for WMT token generation/verification
}
```

**wmt_type**: Indicates whether the issued token format is AES-encrypted or JWT. This corresponds to the specification provided when requesting the watermark token.
- [Watermark Token Request Specification](https://docs.doverunner.com/content-security/forensic-watermarking/embedding/session-manager/#api-data-json-format)

| Key | wmt_type | Description |
| :--- | :--- | :--- |
| `aesKey` | aes | The Site Key issued by the DoveRunner ContentSecurity Service. |
| `type` | aes, jwt | The [Watermark File Folder Structure](#watermark-file-folder-structure). Default: `unlabeled_a_variant`. |
| `availableInterval` | aes, jwt | Token validity interval in seconds (0 for infinite). |
| `prefixFolder` | aes | The top-level folder containing watermark files. Corresponds to `prefix_folder` in the [Watermark Token Request Specification](https://docs.doverunner.com/content-security/forensic-watermarking/embedding/session-manager/#api-data-json-format). |
| `wmtPublicKey` | jwt | PEM format public key for Akamai WMT. |
| `wmtPassword` | jwt | Password for WMT token generation/verification. |

### Configure wrangler.jsonc
Update the `wrangler.jsonc` file with your specific settings:

```jsonc
{
  "name": "doverunner-fwm-cdn-embedder",
  "main": "src/index.js",
  "compatibility_date": "2024-01-01",

  // R2 bucket binding
  "r2_buckets": [
    {
      "binding": "FWM_BUCKER",
      "bucket_name": "your-watermark-bucket-name"
    }
  ],

  // Custom routes (optional)
  "routes": [
    {
      "pattern": "cdn.yourdomain.com/*",
      "zone_name": "yourdomain.com"
    }
  ]
}
```

**Key Configuration Options:**

- `name`: Your worker's name (must be unique in your account)
- `main`: Entry point file path
- `compatibility_date`: Cloudflare Workers compatibility date
- `r2_buckets`: R2 bucket bindings for content storage
- `routes`: (Optional) Custom domain routes for production


## Watermark File Folder Structure

### directory_prefix

- Distinguishes A/B files based on folders.

#### Example

```text
/wm-contents/output_path/cid/{0/1}/dash/stream.mpd
/wm-contents/output_path/cid/{0/1}/dash/video/0/seg-125.m4s
/wm-contents/output_path/cid/{0/1}/hls/master.m3u8
/wm-contents/output_path/cid/{0/1}/hls/video/0/0/stream.m3u8
/wm-contents/output_path/cid/{0/1}/hls/video/0/0/segment-125.ts
```

### unlabeled_a_variant

- A/B files exist in the same folder and are distinguished by filenames.

#### Example

```text
/wm-contents/output_path/cid/dash/stream.mpd
/wm-contents/output_path/cid/dash/video/0/seg-125.m4s
/wm-contents/output_path/cid/dash/video/0/b.seg-125.m4s
/wm-contents/output_path/cid/hls/master.m3u8
/wm-contents/output_path/cid/hls/video/0/0/stream.m3u8
/wm-contents/output_path/cid/hls/video/0/0/segment-125.ts
/wm-contents/output_path/cid/hls/video/0/0/b.segment-125.ts
```

## Usage

The Workers intercepts client requests and routes them based on the URL structure:

1.  **Akamai WMT**: If the path starts with `wmt:`, it uses `akamaiWmt.js` to verify the token and rewrite the path.
2.  **DoveRunner AES**: If the path matches one of the `prefixFolder` entries, it uses `doveRunnerAes.js` to decrypt the watermark data and generate the appropriate content path.

## Deployment

### Prerequisites
Before deploying, ensure you have:
- A **Cloudflare account** with Workers enabled
- **Cloudflare R2 bucket** created for storing watermarked content

### Step 1: Install Wrangler CLI

Install Wrangler CLI to interact with Cloudflare Workers. For detailed installation instructions, please refer to the [Wrangler Installation Guide](https://developers.cloudflare.com/workers/wrangler/install-and-update/).

### Step 2: Deploy to Cloudflare Workers

#### Development Deployment

Test your worker locally before deploying:

```bash
npm run dev
# Or
wrangler dev
```

This starts a local development server at `http://localhost:8787/`

#### Production Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
# Or
wrangler deploy
```

After successful deployment, you'll receive a worker URL like:
```
https://doverunner-fwm-cdn-embedder.your-subdomain.workers.dev
```

### Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [DoveRunner Forensic Watermarking Embedding Documentation](https://docs.doverunner.com/content-security/forensic-watermarking/embedding/)

