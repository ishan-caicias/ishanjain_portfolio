/**
 * Fetch HYG and OpenNGC catalogs using native fetch
 * Simpler approach that works with modern Node.js
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function downloadFile(url: string, outputPath: string): Promise<void> {
  console.log(`\n📥 Fetching: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentLength = response.headers.get('content-length');
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    throw new Error('Response body is null');
  }

  // Convert Web ReadableStream to Node Readable
  const reader = response.body.getReader();
  const nodeStream = new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
      } else {
        this.push(Buffer.from(value));
      }
    }
  });

  let downloadedBytes = 0;
  nodeStream.on('data', (chunk: Buffer) => {
    downloadedBytes += chunk.length;
    if (totalBytes > 0) {
      const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
      const mb = (downloadedBytes / 1024 / 1024).toFixed(2);
      process.stdout.write(`\r⏳ Progress: ${progress}% (${mb} MB)`);
    }
  });

  const fileStream = createWriteStream(outputPath);
  await pipeline(nodeStream, fileStream);

  console.log(`\n✅ Saved: ${path.basename(outputPath)}`);
}

async function main() {
  console.log('🌟 Astronomy Catalog Fetcher\n');

  try {
    // Use mirror repository (waterbuckit/Stellar has a working copy)
    console.log('1️⃣  HYG Star Catalog (v3)');
    const hygUrl = 'https://raw.githubusercontent.com/waterbuckit/Stellar/master/hygdata_v3.csv';
    const hygOutput = path.join(__dirname, 'hygdata_v3.csv');

    await downloadFile(hygUrl, hygOutput);

    // OpenNGC
    console.log('\n2️⃣  OpenNGC Deep Sky Object Catalog');
    const ngcUrl = 'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/NGC.csv';
    const ngcOutput = path.join(__dirname, 'NGC.csv');

    await downloadFile(ngcUrl, ngcOutput);

    console.log('\n✨ All catalogs downloaded successfully!\n');

    // Display stats
    const hygStats = await fs.stat(hygOutput);
    const ngcStats = await fs.stat(ngcOutput);

    console.log('📊 File Information:');
    console.log(`   HYG v3: ${(hygStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   OpenNGC: ${(ngcStats.size / 1024).toFixed(2)} KB`);

    // Preview first few lines
    const hygData = await fs.readFile(hygOutput, 'utf-8');
    const hygLines = hygData.split('\n').slice(0, 3);
    console.log('\n📄 HYG Preview:');
    hygLines.forEach(line => console.log(`   ${line.substring(0, 100)}...`));

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
