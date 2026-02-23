/**
 * Download HYG and OpenNGC catalogs
 * Downloads astronomical catalogs for star and DSO data
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as zlib from 'zlib';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_DIR = __dirname;

interface DownloadConfig {
  url: string;
  outputPath: string;
  isGzipped?: boolean;
}

/**
 * Download file from URL
 */
async function downloadFile(config: DownloadConfig): Promise<void> {
  const { url, outputPath, isGzipped = false } = config;

  console.log(`📥 Downloading: ${url}`);
  console.log(`📁 Output: ${outputPath}`);

  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      // Follow redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          console.log(`↪️  Redirecting to: ${redirectUrl}`);
          downloadFile({ ...config, url: redirectUrl }).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      let totalBytes = 0;
      const contentLength = parseInt(response.headers['content-length'] || '0', 10);

      response.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (contentLength > 0) {
          const progress = ((totalBytes / contentLength) * 100).toFixed(1);
          process.stdout.write(`\r⏳ Progress: ${progress}% (${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
        }
      });

      if (isGzipped) {
        // Decompress gzip on the fly
        const gunzip = zlib.createGunzip();
        response.pipe(gunzip).pipe(fileStream);
      } else {
        response.pipe(fileStream);
      }

      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`\n✅ Downloaded: ${path.basename(outputPath)}`);
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlinkSync(outputPath);
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log('🌟 Astronomy Catalog Downloader\n');

  // Create output directory
  const dataDir = path.join(SCRIPT_DIR);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  try {
    // Download HYG v4 catalog (gzipped CSV)
    console.log('\n1️⃣  HYG Star Catalog (v4.2)');
    // Try Codeberg first, fallback to GitHub archive
    const hygUrl = 'https://codeberg.org/astronexus/hyg/raw/branch/main/hyg/v4/hygdata_v4.csv.gz';
    const hygOutput = path.join(dataDir, 'hygdata_v4.csv');

    await downloadFile({
      url: hygUrl,
      outputPath: hygOutput,
      isGzipped: true, // Decompress during download
    });

    // Download OpenNGC catalog
    console.log('\n2️⃣  OpenNGC Deep Sky Object Catalog');
    const ngcUrl = 'https://github.com/mattiaverga/OpenNGC/raw/master/NGC.csv';
    const ngcOutput = path.join(dataDir, 'NGC.csv');

    await downloadFile({
      url: ngcUrl,
      outputPath: ngcOutput,
      isGzipped: false,
    });

    console.log('\n✨ All catalogs downloaded successfully!\n');

    // Display file stats
    const hygStats = fs.statSync(hygOutput);
    const ngcStats = fs.statSync(ngcOutput);

    console.log('📊 File Information:');
    console.log(`   HYG: ${(hygStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   NGC: ${(ngcStats.size / 1024).toFixed(2)} KB\n`);

  } catch (error) {
    console.error('\n❌ Download failed:', error);
    process.exit(1);
  }
}

main();
