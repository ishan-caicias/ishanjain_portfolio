#!/usr/bin/env node
/**
 * Hero DSO Image Fetcher
 *
 * Fetches hero deep-sky object images from Wikimedia Commons via Wikidata
 * with strict license filtering and proper attribution tracking.
 *
 * Usage:
 *   npm run fetch-hero-dso           # Normal run (resumable)
 *   npm run fetch-hero-dso -- --force   # Overwrite existing files
 *   npm run fetch-hero-dso -- --dry-run # API calls only, no downloads
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// TYPES
// ============================================

interface DSOEntry {
  id: string;
  label: string;
  preferredQuery: string;
}

interface WikidataImageResult {
  fileTitle?: string;
  imageUrl?: string;
  thumbUrl?: string;
  source: 'wikidata-p18' | 'wikimedia-search' | 'none';
}

interface ExtMetadata {
  LicenseShortName?: { value: string };
  LicenseUrl?: { value: string };
  UsageTerms?: { value: string };
  Artist?: { value: string };
  Credit?: { value: string };
  AttributionRequired?: { value: string };
  ImageDescription?: { value: string };
  ObjectName?: { value: string };
}

interface ImageInfo {
  url: string;
  thumburl?: string;
  descriptionurl: string;
  extmetadata?: ExtMetadata;
}

interface LicenseCheckResult {
  allowed: boolean;
  reason?: string;
}

interface Attribution {
  id: string;
  label: string;
  fileTitle: string;
  imageDescriptionUrl?: string;
  licenseShortName?: string;
  licenseUrl?: string;
  artist?: string;
  credit?: string;
  attributionRequired?: boolean;
  source?: string;
}

interface RejectedEntry {
  id: string;
  label?: string;
  fileTitle?: string;
  licenseShortName?: string;
  usageTerms?: string;
  licenseUrl?: string;
  reason: string;
}

interface FetchStats {
  total: number;
  success: number;
  skipped: number;
  rejected: number;
  unresolved: number;
  errors: number;
}

interface ManifestEntry {
  src: string;
}

type Manifest = Record<string, ManifestEntry>;

// ============================================
// CONFIGURATION
// ============================================

const CONCURRENCY_LIMIT = 3;
const THUMBNAIL_WIDTH = 768;
const USER_AGENT = 'HeroDSOFetcher/1.0 (https://ishanjain.dev; educational/portfolio use)';

const PATHS = {
  heroList: path.join(__dirname, 'hero-dso-list.json'),
  outputDir: path.join(__dirname, '../../public/hero-dso'),
  creditsFile: path.join(__dirname, '../../public/hero-dso/credits.json'),
  manifestFile: path.join(__dirname, '../../public/hero-dso/manifest.json'),
  rejectedFile: path.join(__dirname, 'rejected.json'),
};

// ============================================
// COMMAND LINE ARGS
// ============================================

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');

if (isDryRun) {
  console.log('🔍 DRY RUN MODE: API calls only, no file writes\n');
}

// ============================================
// LICENSE VALIDATION
// ============================================

/**
 * Checks if a license is allowed (public domain, CC0, CC-BY only)
 * Rejects CC BY-SA, NC, ND, and restrictive licenses
 */
function isLicenseAllowed(extmetadata?: ExtMetadata): LicenseCheckResult {
  if (!extmetadata) {
    return { allowed: false, reason: 'LICENSE_NOT_ALLOWED_BY_POLICY: No license metadata found' };
  }

  const licenseName = extmetadata.LicenseShortName?.value?.toLowerCase() || '';
  const usageTerms = extmetadata.UsageTerms?.value?.toLowerCase() || '';
  const licenseUrl = extmetadata.LicenseUrl?.value?.toLowerCase() || '';

  // Check for CC BY-SA / ShareAlike specifically
  if (
    licenseName.includes('by-sa') ||
    licenseName.includes('sharealike') ||
    licenseUrl.includes('/by-sa/') ||
    usageTerms.includes('sharealike')
  ) {
    return {
      allowed: false,
      reason: 'LICENSE_NOT_ALLOWED_BY_POLICY: CC BY-SA / ShareAlike (copyleft restriction)'
    };
  }

  // Check for other restrictive terms (NC, ND, etc.)
  const restrictivePatterns = [
    { pattern: 'nc', desc: 'NonCommercial' },
    { pattern: 'noncommercial', desc: 'NonCommercial' },
    { pattern: 'non-commercial', desc: 'NonCommercial' },
    { pattern: 'nd', desc: 'NoDerivatives' },
    { pattern: 'noderivatives', desc: 'NoDerivatives' },
    { pattern: 'no derivatives', desc: 'NoDerivatives' },
    { pattern: 'noderivs', desc: 'NoDerivatives' },
    { pattern: 'all rights reserved', desc: 'All rights reserved' },
    { pattern: 'restricted', desc: 'Restricted use' },
    { pattern: 'permission required', desc: 'Permission required' },
    { pattern: 'fair use', desc: 'Fair use only' },
  ];

  const combinedText = `${licenseName} ${usageTerms} ${licenseUrl}`;

  for (const { pattern, desc } of restrictivePatterns) {
    if (combinedText.includes(pattern)) {
      return {
        allowed: false,
        reason: `LICENSE_NOT_ALLOWED_BY_POLICY: Contains ${desc}`
      };
    }
  }

  // Explicit allowlist check (ONLY PD, CC0, CC BY)
  const allowedPatterns = [
    /^public domain/i,
    /^pd[-\s]/i,
    /^cc0/i,
    /^cc[- ]by[- ]?\d\.?\d?$/i,   // CC BY (any version) - exact match, no SA/NC/ND
  ];

  const isAllowed = allowedPatterns.some(pattern => pattern.test(licenseName));

  if (!isAllowed && licenseName) {
    return {
      allowed: false,
      reason: `LICENSE_NOT_ALLOWED_BY_POLICY: "${licenseName}" not in allowlist (PD, CC0, CC BY only)`
    };
  }

  if (!licenseName) {
    return { allowed: false, reason: 'LICENSE_NOT_ALLOWED_BY_POLICY: License name missing or empty' };
  }

  return { allowed: true };
}

// ============================================
// CONCURRENCY HELPER
// ============================================

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const executing: Set<Promise<void>> = new Set();

  for (let i = 0; i < items.length; i++) {
    const promise = fn(items[i], i)
      .then(result => {
        results[i] = result;
      })
      .finally(() => {
        executing.delete(promise);
      });

    executing.add(promise);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  // Wait for all remaining promises to complete
  await Promise.all(Array.from(executing));
  return results;
}

// ============================================
// WIKIDATA & WIKIMEDIA API
// ============================================

/**
 * Fetch image from Wikidata P18 property or fallback to Wikimedia search
 */
async function fetchImageForDSO(dso: DSOEntry): Promise<WikidataImageResult> {
  // Try Wikidata first
  const wikidataResult = await fetchFromWikidata(dso.preferredQuery);
  if (wikidataResult.fileTitle) {
    return { ...wikidataResult, source: 'wikidata-p18' };
  }

  // Fallback to Wikimedia Commons search
  const searchResult = await searchWikimediaCommons(dso.preferredQuery);
  if (searchResult.fileTitle) {
    return { ...searchResult, source: 'wikimedia-search' };
  }

  return { source: 'none' };
}

/**
 * Query Wikidata for image (P18 property)
 */
async function fetchFromWikidata(query: string): Promise<Partial<WikidataImageResult>> {
  try {
    const sparql = `
      SELECT ?item ?image WHERE {
        ?item rdfs:label "${query}"@en.
        OPTIONAL { ?item wdt:P18 ?image. }
      }
      LIMIT 1
    `;

    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    const response = await fetchJSON(url, { headers: { 'User-Agent': USER_AGENT } });

    if (response.results?.bindings?.[0]?.image?.value) {
      const imageUrl = response.results.bindings[0].image.value;
      const filename = decodeURIComponent(imageUrl.split('/').pop() || '').replace(/_/g, ' ');
      return { fileTitle: `File:${filename}`, imageUrl };
    }
  } catch (err) {
    // Silently skip Wikidata errors, will fallback to search
  }

  return {};
}

/**
 * Search Wikimedia Commons for best matching file
 */
async function searchWikimediaCommons(query: string): Promise<Partial<WikidataImageResult>> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srnamespace: '6', // File namespace
      srlimit: '3',
      format: 'json',
      origin: '*', // CORS support
    });

    const url = `https://commons.wikimedia.org/w/api.php?${params}`;
    const response = await fetchJSON(url, { headers: { 'User-Agent': USER_AGENT } });
    const results = response.query?.search || [];

    if (results.length > 0) {
      // Prefer results with "Hubble", "ESO", "NASA" in title (higher quality)
      const priorityMatch = results.find((r: any) =>
        /hubble|eso|nasa|jwst/i.test(r.title)
      );
      const bestMatch = priorityMatch || results[0];
      return { fileTitle: bestMatch.title };
    }
  } catch (err) {
    // Silently skip search errors
  }

  return {};
}

/**
 * Fetch image info with extmetadata from Commons (with retry logic)
 */
async function fetchImageInfo(fileTitle: string, retries = 2): Promise<ImageInfo | null> {
  const params = new URLSearchParams({
    action: 'query',
    titles: fileTitle,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',  // Use pipe separator, not comma
    iiurlwidth: THUMBNAIL_WIDTH.toString(),
    format: 'json',
    formatversion: '2',  // Use formatversion=2 for cleaner response structure
  });

  const url = `https://commons.wikimedia.org/w/api.php?${params}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchJSONWithStatus(url, { headers: { 'User-Agent': USER_AGENT } });

      // With formatversion=2, pages is an array
      const page = response.data?.query?.pages?.[0];

      if (!page) {
        console.error(`  ❌ No page data in response for ${fileTitle}`);
        return null;
      }

      const imageinfo = page.imageinfo?.[0];

      if (!imageinfo) {
        console.error(`  ❌ No imageinfo in response for ${fileTitle}`);
        return null;
      }

      return imageinfo;
    } catch (err: any) {
      const isRetryable = err.statusCode === 429 || (err.statusCode >= 500 && err.statusCode < 600);

      if (isRetryable && attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s
        console.warn(`  ⚠️  HTTP ${err.statusCode}, retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error(`  ❌ Failed to fetch image info (HTTP ${err.statusCode || 'error'})`);
      console.error(`  URL: ${url}`);
      if (err.responseText) {
        console.error(`  Response: ${err.responseText.substring(0, 200)}`);
      }
      return null;
    }
  }

  return null;
}

// ============================================
// HTTP HELPERS
// ============================================

function fetchJSON(url: string, options: { headers?: Record<string, string> } = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: options.headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`JSON parse error: ${(err as Error).message}`));
        }
      });
    }).on('error', reject);
  });
}

function fetchJSONWithStatus(url: string, options: { headers?: Record<string, string> } = {}): Promise<{ statusCode: number; data: any; responseText: string }> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: options.headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const statusCode = res.statusCode || 0;

        if (statusCode !== 200) {
          const error: any = new Error(`HTTP ${statusCode}`);
          error.statusCode = statusCode;
          error.responseText = data;
          reject(error);
          return;
        }

        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode, data: parsed, responseText: data });
        } catch (err) {
          const error: any = new Error(`JSON parse error: ${(err as Error).message}`);
          error.statusCode = statusCode;
          error.responseText = data;
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(destination);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      // Only try to delete if file was actually created
      if (fs.existsSync(destination)) {
        try {
          fs.unlinkSync(destination);
        } catch (unlinkErr) {
          // Ignore cleanup errors
        }
      }
      reject(err);
    });
  });
}

// ============================================
// FILE OPERATIONS
// ============================================

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Atomic write: write to temp file, then rename
 * Prevents clobbering existing files on failure
 */
function atomicWrite(filePath: string, content: string): void {
  const tempPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    // Clean up temp file on failure
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw err;
  }
}

// ============================================
// MAIN PROCESSING
// ============================================

async function processDSO(
  dso: DSOEntry,
  stats: FetchStats,
  attributions: Attribution[],
  rejected: RejectedEntry[],
  manifest: Manifest
): Promise<void> {
  const attrFile = path.join(PATHS.outputDir, `${dso.id}.attribution.json`);

  // Check for existing files (any image extension)
  const possibleExts = ['.webp', '.jpg', '.jpeg', '.png'];
  let existingImageFile: string | null = null;

  for (const ext of possibleExts) {
    const testFile = path.join(PATHS.outputDir, `${dso.id}${ext}`);
    if (fileExists(testFile)) {
      existingImageFile = testFile;
      break;
    }
  }

  // Skip if already downloaded (unless --force)
  if (!isForce && existingImageFile && fileExists(attrFile)) {
    console.log(`  ⏭️  Skipped (already exists)`);
    stats.skipped++;

    // Load existing attribution for credits and add to manifest
    if (fileExists(attrFile)) {
      const existing = JSON.parse(fs.readFileSync(attrFile, 'utf-8'));
      attributions.push(existing);

      // Add to manifest
      const ext = path.extname(existingImageFile);
      manifest[dso.id] = {
        src: `/hero-dso/${dso.id}${ext}`
      };
    }
    return;
  }

  console.log(`\n🔍 ${dso.id}: ${dso.label}`);

  // Step 1: Find image
  const imageResult = await fetchImageForDSO(dso);

  if (!imageResult.fileTitle) {
    console.log(`  ❌ No image found`);
    stats.unresolved++;
    return;
  }

  console.log(`  📄 Found: ${imageResult.fileTitle} (${imageResult.source})`);

  // Step 2: Get image info with metadata
  const imageInfo = await fetchImageInfo(imageResult.fileTitle);

  if (!imageInfo) {
    console.log(`  ❌ Failed to fetch image info`);
    stats.errors++;
    return;
  }

  // Step 3: License validation
  const licenseCheck = isLicenseAllowed(imageInfo.extmetadata);

  if (!licenseCheck.allowed) {
    console.log(`  🚫 License rejected: ${licenseCheck.reason}`);
    rejected.push({
      id: dso.id,
      label: dso.label,
      fileTitle: imageResult.fileTitle,
      licenseShortName: imageInfo.extmetadata?.LicenseShortName?.value,
      usageTerms: imageInfo.extmetadata?.UsageTerms?.value,
      licenseUrl: imageInfo.extmetadata?.LicenseUrl?.value,
      reason: licenseCheck.reason || 'Unknown',
    });
    stats.rejected++;
    return;
  }

  const licenseName = imageInfo.extmetadata?.LicenseShortName?.value || 'Unknown';
  console.log(`  ✅ License: ${licenseName}`);

  // Step 4: Download image
  const downloadUrl = imageInfo.thumburl || imageInfo.url;

  if (!isDryRun) {
    try {
      ensureDir(PATHS.outputDir);

      // Determine file extension from URL
      const urlExt = path.extname(new URL(downloadUrl).pathname);
      const targetExt = urlExt.match(/\.(webp|jpg|jpeg|png)$/i) ? urlExt : '.jpg';
      const finalImageFile = path.join(PATHS.outputDir, `${dso.id}${targetExt}`);

      await downloadFile(downloadUrl, finalImageFile);
      console.log(`  💾 Downloaded: ${path.basename(finalImageFile)}`);

      // Step 5: Save attribution
      const attribution: Attribution = {
        id: dso.id,
        label: dso.label,
        fileTitle: imageResult.fileTitle,
        imageDescriptionUrl: imageInfo.descriptionurl,
        licenseShortName: imageInfo.extmetadata?.LicenseShortName?.value,
        licenseUrl: imageInfo.extmetadata?.LicenseUrl?.value,
        artist: imageInfo.extmetadata?.Artist?.value?.replace(/<[^>]*>/g, ''), // Strip HTML
        credit: imageInfo.extmetadata?.Credit?.value?.replace(/<[^>]*>/g, ''),
        attributionRequired: imageInfo.extmetadata?.AttributionRequired?.value === 'true',
        source: imageResult.source,
      };

      fs.writeFileSync(attrFile, JSON.stringify(attribution, null, 2));
      attributions.push(attribution);

      // Add to manifest with actual extension
      manifest[dso.id] = {
        src: `/hero-dso/${dso.id}${targetExt}`
      };

      stats.success++;
    } catch (err) {
      console.error(`  ❌ Download failed: ${(err as Error).message}`);
      stats.errors++;
    }
  } else {
    // DRY RUN: Still populate manifest and attributions for testing
    console.log(`  [DRY RUN] Would download: ${downloadUrl}`);

    // Determine file extension from URL
    const urlExt = path.extname(new URL(downloadUrl).pathname);
    const targetExt = urlExt.match(/\.(webp|jpg|jpeg|png)$/i) ? urlExt : '.jpg';

    // Add to manifest (dry-run)
    manifest[dso.id] = {
      src: `/hero-dso/${dso.id}${targetExt}`
    };

    // Add attribution (dry-run)
    const attribution: Attribution = {
      id: dso.id,
      label: dso.label,
      fileTitle: imageResult.fileTitle,
      imageDescriptionUrl: imageInfo.descriptionurl,
      licenseShortName: imageInfo.extmetadata?.LicenseShortName?.value,
      licenseUrl: imageInfo.extmetadata?.LicenseUrl?.value,
      artist: imageInfo.extmetadata?.Artist?.value?.replace(/<[^>]*>/g, ''),
      credit: imageInfo.extmetadata?.Credit?.value?.replace(/<[^>]*>/g, ''),
      attributionRequired: imageInfo.extmetadata?.AttributionRequired?.value === 'true',
      source: imageResult.source,
    };
    attributions.push(attribution);

    stats.success++;
  }
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  console.log('🚀 Hero DSO Image Fetcher\n');

  // Load DSO list
  const dsoList: DSOEntry[] = JSON.parse(fs.readFileSync(PATHS.heroList, 'utf-8'));
  console.log(`📋 Loaded ${dsoList.length} DSO entries\n`);

  const stats: FetchStats = {
    total: dsoList.length,
    success: 0,
    skipped: 0,
    rejected: 0,
    unresolved: 0,
    errors: 0,
  };

  const attributions: Attribution[] = [];
  const rejected: RejectedEntry[] = [];
  const manifest: Manifest = {};

  // Process with concurrency limit
  await runWithConcurrency(
    dsoList,
    CONCURRENCY_LIMIT,
    async (dso) => await processDSO(dso, stats, attributions, rejected, manifest)
  );

  // Save rejected list
  if (!isDryRun && rejected.length > 0) {
    fs.writeFileSync(PATHS.rejectedFile, JSON.stringify(rejected, null, 2));
    console.log(`\n🚫 Rejected entries saved to: ${PATHS.rejectedFile}`);
  }

  // Generate credits file (in public/hero-dso/) - atomic write
  if (attributions.length > 0) {
    if (!isDryRun) {
      ensureDir(PATHS.outputDir);
      atomicWrite(PATHS.creditsFile, JSON.stringify(attributions, null, 2));
      console.log(`\n📝 Credits generated: ${PATHS.creditsFile}`);
    } else {
      console.log(`\n📝 [DRY RUN] Would generate credits: ${attributions.length} entries`);
    }
  } else if (!isDryRun && !fileExists(PATHS.creditsFile)) {
    // Ensure empty placeholder exists if no credits
    ensureDir(PATHS.outputDir);
    atomicWrite(PATHS.creditsFile, '[]');
  }

  // Generate manifest file (in public/hero-dso/) - atomic write
  if (Object.keys(manifest).length > 0) {
    if (!isDryRun) {
      ensureDir(PATHS.outputDir);
      atomicWrite(PATHS.manifestFile, JSON.stringify(manifest, null, 2));
      console.log(`📦 Manifest generated: ${PATHS.manifestFile} (${Object.keys(manifest).length} entries)`);
    } else {
      console.log(`📦 [DRY RUN] Would generate manifest: ${Object.keys(manifest).length} entries`);
    }
  } else if (!isDryRun && !fileExists(PATHS.manifestFile)) {
    // Ensure empty placeholder exists if no manifest entries
    ensureDir(PATHS.outputDir);
    atomicWrite(PATHS.manifestFile, '{}');
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total:      ${stats.total}`);
  console.log(`✅ Success:  ${stats.success}`);
  console.log(`⏭️  Skipped:  ${stats.skipped}`);
  console.log(`🚫 Rejected: ${stats.rejected}`);
  console.log(`❌ Unresolved: ${stats.unresolved}`);
  console.log(`⚠️  Errors:   ${stats.errors}`);
  console.log('='.repeat(50));

  if (isDryRun) {
    console.log('\n💡 This was a dry run. No files were written.');
  }
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
