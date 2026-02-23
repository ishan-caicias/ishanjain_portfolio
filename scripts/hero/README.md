# Hero DSO Image Fetcher

Automated pipeline to fetch deep-sky object images from Wikimedia Commons via Wikidata with strict license filtering and proper attribution tracking.

## Overview

This script downloads high-quality astronomical images for hero deep-sky objects (galaxies, nebulae, clusters) from Wikimedia Commons, validates their licenses, and generates attribution metadata for website credits.

## Requirements

- **Node.js**: 18+ (tested on 24.x)
- **Network**: Internet connection for API calls
- **Disk Space**: ~100-200 MB for images

## Usage

### Basic Commands

```bash
# Normal run (resumable, skips existing files)
npm run fetch-hero-dso

# Force overwrite all existing files
npm run fetch-hero-dso -- --force

# Dry run (API calls only, no downloads)
npm run fetch-hero-dso -- --dry-run
```

### Command-Line Options

- **`--dry-run`**: Performs API lookups and license validation without downloading files or writing to disk (except console output)
- **`--force`**: Overwrites existing image and attribution files. Default behavior skips already-downloaded entries for resumability.

## How It Works

### 1. Image Resolution

For each DSO in `hero-dso-list.json`:

1. **Wikidata Lookup**: Queries Wikidata SPARQL for the P18 (image) property
2. **Fallback Search**: If no P18, searches Wikimedia Commons using `preferredQuery`
3. **Best Match**: Selects the top search result

### 2. License Validation

Fetches image metadata (`extmetadata`) and validates license using **strict allowlist**:

#### ✅ Allowed Licenses

- Public Domain (PD-*)
- CC0 (Creative Commons Zero)
- CC BY (any version)

#### 🚫 Rejected Licenses

Automatically rejects licenses containing:

- **SA / ShareAlike** - Copyleft restriction (detected via `BY-SA` in LicenseShortName, `/by-sa/` in LicenseUrl, or `sharealike` in UsageTerms)
- **NC / NonCommercial** - No commercial use restrictions
- **ND / NoDerivatives** - No derivative work restrictions
- **All rights reserved**
- **Permission required**
- **Fair use**
- **Restricted**
- Missing/unknown license metadata

**Note:** CC BY-SA detection is precise - substring "sa" alone does NOT trigger rejection. Only explicit ShareAlike indicators are rejected.

Rejected entries are logged to `scripts/hero/rejected.json` with full details.

### 3. Image Download

- Downloads thumbnail at **768px width** (or full image if smaller)
- Prefers `.webp` format, falls back to `.jpg`/`.png`
- Saves to `public/hero-dso/<id>.webp`

### 4. Manifest Generation

After all downloads complete, generates **`public/hero-dso/manifest.json`**:

```json
{
  "M31": {
    "src": "/hero-dso/M31.webp"
  },
  "M42": {
    "src": "/hero-dso/M42.jpg"
  }
}
```

**Note:** Attribution files (`.attribution.json`) are gitignored and not referenced in the manifest. They're only used during script execution to generate `credits.json`.

This enables deterministic runtime loading without guessing file extensions.

### 5. Attribution Tracking

For each successfully downloaded image, creates:

**`public/hero-dso/<id>.attribution.json`**:
```json
{
  "id": "M42",
  "label": "Orion Nebula",
  "fileTitle": "File:Orion Nebula - Hubble 2006 mosaic.jpg",
  "imageDescriptionUrl": "https://commons.wikimedia.org/wiki/File:...",
  "licenseShortName": "CC BY-SA 4.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
  "artist": "NASA, ESA, Hubble",
  "credit": "Hubble Space Telescope",
  "attributionRequired": true,
  "source": "wikidata-p18"
}
```

### 6. Credits Generation

Consolidates all attributions into **`public/hero-dso/credits.json`** for the website Credits page.

**Important:** Both `manifest.json` and `credits.json` are written atomically (via temp files + rename) to prevent corruption on failure. They must be **committed to git** after updates, as they're deployed with the site.

## Rate Limits

- **Concurrency**: 3 simultaneous downloads (configurable via `CONCURRENCY_LIMIT`)
- **User-Agent**: Identifies as `HeroDSOFetcher/1.0 (https://ishanjain.dev)` for respectful API usage
- **No explicit rate limiting**: Wikimedia APIs are generally permissive for educational/non-commercial use

**Best Practice**: Run during off-peak hours for large batches. For 100 objects, expect ~10-15 minutes runtime.

## File Structure

```
scripts/hero/
├── README.md                       # This file
├── hero-dso-list.json              # 80+ DSO entries (Messier, NGC, IC)
├── fetch-hero-dso-images.ts        # Main fetcher script
└── rejected.json                   # License-rejected entries (generated)

public/hero-dso/
├── M42.webp                        # Downloaded images
├── M42.attribution.json            # Per-image attribution
├── NGC7000.webp
├── NGC7000.attribution.json
└── ...

src/generated/
└── hero-dso-credits.json           # Consolidated credits for website
```

## Output

### Console Summary

```
📊 SUMMARY
==================================================
Total:      95
✅ Success:  72
⏭️  Skipped:  10
🚫 Rejected: 8
❌ Unresolved: 5
⚠️  Errors:   0
==================================================
```

- **Success**: Downloaded and validated
- **Skipped**: Already exists (resumable behavior)
- **Rejected**: Failed license validation
- **Unresolved**: No image found (Wikidata or search)
- **Errors**: Download or API failures

### Rejected Entries

See `scripts/hero/rejected.json` for full details on license rejections:

```json
[
  {
    "id": "NGC1499",
    "label": "California Nebula",
    "fileTitle": "File:NGC1499.jpg",
    "licenseShortName": "CC BY-NC-SA 3.0",
    "reason": "License contains restrictive term: \"nc\""
  }
]
```

## Integration with Website

### Credits Page

The Credits page reads `src/generated/hero-dso-credits.json` and displays:

- DSO ID and label
- Image description link (Wikimedia Commons)
- License name and link
- Artist/author attribution
- Credit/source information

### AR Overlay

`CosmicAROverlay.tsx` checks if a hero image exists for the selected object:

```typescript
const heroImagePath = `/hero-dso/${selectedObject.id}.webp`;
// If exists, show image + "Credits" link
// Else, show procedural stats
```

## Safety Features

### Non-Destructive

- **Only writes to**:
  - `public/hero-dso/*`
  - `src/generated/hero-dso-credits.json`
  - `scripts/hero/rejected.json`
- **Never deletes** existing files (even with `--force`, only overwrites)

### Resumability

- Default behavior skips existing files
- Can safely re-run after interruption
- Use `--force` only when intentional refresh needed

### Error Handling

- Network failures logged, script continues
- Invalid JSON responses caught and logged
- Missing metadata treated as license rejection (safe default)

## Troubleshooting

### "No image found" (Unresolved)

- Wikidata may not have P18 property for this object
- Search query may be too specific/generic
- **Solution**: Adjust `preferredQuery` in `hero-dso-list.json`

### "License rejected"

- Image has restrictive license (NC, ND, etc.)
- **Solution**: Find alternative image manually or accept lower count

### Download failures

- Network timeout or rate limiting
- **Solution**: Re-run script (resumable), or use `--dry-run` to test first

### TypeScript errors

- Ensure `tsx` is installed: `npm install --save-dev tsx`
- Check Node version: `node --version` (should be 18+)

## License Philosophy

**Why so strict?**

This portfolio is educational/non-commercial *now*, but may be used in commercial contexts later (demos, client work, etc.). By enforcing CC0/CC-BY/CC-BY-SA only, we:

- Avoid future legal complications
- Ensure derivative works are allowed (website modifications)
- Maintain commercial flexibility
- Respect attribution requirements (tracked in credits)

## Maintenance

### Adding New DSOs

Edit `hero-dso-list.json`:

```json
{
  "id": "M104",
  "label": "Sombrero Galaxy",
  "preferredQuery": "Messier 104"
}
```

Run fetcher:

```bash
npm run fetch-hero-dso
```

### Updating Existing Images

Use `--force` to re-download:

```bash
npm run fetch-hero-dso -- --force
```

**Warning**: This re-downloads ALL images, not just one. For selective updates, manually delete the specific `.webp` and `.attribution.json` files first.

## Credits

- **Wikidata**: https://www.wikidata.org
- **Wikimedia Commons**: https://commons.wikimedia.org
- **License metadata**: Extracted via MediaWiki API `extmetadata`

All downloaded images are attributed according to their original licenses. See the website Credits page for full attribution list.
