# Logo Optimization for datacenterHawk ArcGIS Maps

## Overview

This directory contains tools for optimizing company logos for use in the datacenterHawk application, specifically for ArcGIS PictureMarkerSymbol rendering on maps.

**Problem:** Original approach (SVG-wrapped WebP) created 30KB+ files that were inefficient for map rendering and didn't scale well across multiple UI sizes.

**Solution:** Two specialized tools for different logo types - vector SVG for simple logos, optimized raster for complex logos.

---

## Context: How Logos Are Used in app-site

### Multiple Size Requirements

Company logos appear at different sizes throughout the application:

- **24px × 24px** - ArcGIS map markers (`stores/companies.js:351`), AG Grid cells, power icons
- **32px × 32px** - Company sidebar (`CompaniesSidebar.vue:37`), activity cards, dashboards
- **100px+** - Facility profiles (`facilityProfile/ProfileInfo.vue:19`), company pages

### ArcGIS Implementation

**Location:** `app-site/stores/companies.js` (lines 344-355)

```javascript
generatePictureSymbols(name, logo) {
  return {
    value: name,
    symbol: {
      type: 'picture-marker',
      url: logo?.includes('cmsstatic') ? `${cmsDomain}${logo}` : `${logo}`,
      width: '24px',
      height: '24px',
    },
  };
}
```

**How it works:**
1. Logos fetched from CMS API: `/companies/colocation/icons` and `/companies/hyperscale/icons`
2. Cached in localStorage (`stores/companies.js:28`)
3. Used in `UniqueValueRenderer` with one PictureMarkerSymbol per company
4. Dynamically updated via watchers (`stores/arcgisLayer.js:740-771`)
5. Users can toggle visualization modes (`components/map/VisualizationMenu.vue`)

**Performance characteristics:**
- 100+ unique company logos
- Potentially 1000+ facility markers visible at once
- Each logo = separate HTTP request (unavoidable with PictureMarkerSymbol)
- HTTP/2 multiplexing helps with parallel loading
- Browser + localStorage caching crucial

---

## Research Findings

### What Doesn't Work

❌ **SVG-wrapped WebP (original v1 approach):**
- File size: ~30KB per logo (2.5-3MB for 100 logos)
- Fixed resolution raster inside SVG wrapper
- Pixelated when scaled beyond embedded size
- No browser caching benefits (data URLs)
- Decoding overhead (base64 → WebP → render)

### Performance Bottleneck Analysis

The real bottleneck is **NOT file format** - it's the architectural constraint:

- ArcGIS PictureMarkerSymbol requires individual URLs (no sprite sheet support)
- 100+ logos = 100+ HTTP requests
- Already mitigated with localStorage caching
- Format differences (SVG vs PNG vs WebP) are negligible at 24px (100-300KB total)

**However, multi-size usage (24px, 32px, 100px) makes format choice important:**
- Vector SVG: Perfect quality at all sizes from single file
- Raster: Need multiple files or accept pixelation when scaled

### File Size Reality Check

At 24px × 24px:

| Format | File Size | Quality at 24px | Quality at 100px | Best For |
|--------|-----------|-----------------|------------------|----------|
| **Vector SVG** | 500B - 5KB | Excellent | Perfect | Simple logos, icons, shapes |
| **Vector SVG (complex)** | 50KB - 1MB+ | Excellent | Perfect | ❌ Creates huge files for text |
| **WebP (85%)** | 1-3KB | Excellent | ❌ Pixelated | Text-heavy logos, photos |
| **PNG (optimized)** | 2-5KB | Excellent | ❌ Pixelated | Compatibility fallback |
| **SVG-wrapped WebP** | 30KB+ | Good | ❌ Pixelated | ❌ Worst of both worlds |

---

## Tools in This Directory

### 1. logo-converter-v2.html (Vector SVG)

**Purpose:** Convert raster logos (PNG/JPG) to true vector SVG paths

**Technology:**
- ImageTracer.js for bitmap tracing
- SVGO for optimization

**Controls:**
- Color Palette Size (2-16, default: 6)
- Path Simplification (0-1, default: 0.2)
- Scale (0.5-2x, default: 1.0)

**Output:** Optimized SVG with vector paths (no embedded rasters)

**Target:** <5KB per logo

**When to use:**
- ✅ Simple logos with solid colors
- ✅ Geometric shapes and icons
- ✅ Logos needed at multiple sizes (24px, 32px, 100px+)
- ✅ When quality must be perfect at any zoom level

**When NOT to use:**
- ❌ Text-heavy logos (creates large files)
- ❌ Complex gradients or photos
- ❌ When output file size exceeds 10KB

**Tips for best results:**
- Start with 6 colors, reduce to 4 if file is too large
- Use clean logos on transparent/white background
- Lower path simplification (0.1-0.3) for more detail
- Check file size indicator (green <5KB, yellow <10KB, red >10KB)

---

### 2. logo-optimizer-raster.html (Raster WebP/PNG)

**Purpose:** Create optimized fixed-size raster images for map markers

**Technology:**
- Native Canvas API for resizing
- WebP/PNG encoding with quality control

**Controls:**
- Output Size (24px, 32px, 48px, 64px)
- Quality (60-100%, default: 85%)
- Format (WebP or PNG)

**Output:** Crisp raster image at exact pixel dimensions

**Target:** 1-3KB per logo (24px WebP at 85%)

**When to use:**
- ✅ Text-heavy logos (like "Global Switch", "3S GRUPA PLAY")
- ✅ Complex designs where SVG creates huge files
- ✅ When you only need one size (24px for maps)
- ✅ Photos or gradients

**When NOT to use:**
- ❌ When logos need to scale to 100px+ without pixelation
- ❌ Simple geometric logos (SVG is better)

**Tips for best results:**
- Use WebP format for smallest file size (browser support excellent)
- 85% quality is sweet spot (visual quality vs file size)
- For retina displays, create 48px version
- PNG fallback for older browser compatibility

---

## Decision Matrix: Which Format to Use?

### For Your app-site Specifically

Since logos are used at **24px, 32px, AND 100px**, here's the recommended approach:

#### Strategy A: Vector-First (Best Quality)

1. Try vector SVG conversion (logo-converter-v2.html)
2. If file size <10KB → use SVG ✅
3. If file size >10KB → use Strategy B

**Pros:** Perfect quality at all sizes from single file
**Cons:** Some logos create large files

#### Strategy B: Hybrid Approach (Best File Size)

1. **For maps (24px):** Use raster optimizer → WebP at 24px
2. **For UI (32px):** Same WebP scaled up (acceptable quality loss)
3. **For profiles (100px):** Keep original high-res PNG/JPG

**Pros:** Smallest total file size (1-3KB per logo)
**Cons:** Need multiple files, slight pixelation at 32px

#### Strategy C: Size-Specific Rasters (Balanced)

Create 3 versions of each logo:
- 24px WebP for maps
- 32px WebP for UI elements
- 100px PNG for profiles

**Pros:** Crisp at every size, small files
**Cons:** 3× file management overhead

### Recommendation

**For 100+ company logos, use Strategy B (Hybrid):**

1. Batch process all logos through `logo-optimizer-raster.html`:
   - Output: 24px WebP at 85% quality
   - Result: 1-3KB per logo = 100-300KB total

2. Update CMS to serve these optimized 24px WebP files

3. For facility profiles (100px), serve original high-res logos

**Why:**
- Smallest file size (critical for 100+ logos)
- Perfect quality at map marker size (most common usage)
- Acceptable quality when scaled to 32px (< 5% larger)
- Original logos available for large sizes

**File size comparison:**
- Current (SVG-wrapped WebP): 3MB for 100 logos
- Vector SVG (if all work): 500KB for 100 logos
- **Raster WebP at 24px: 150KB for 100 logos** ⭐

---

## Implementation Checklist

### Phase 1: Audit Current Logos

- [ ] Export all company logos from CMS
- [ ] Test 5-10 representative logos with both tools
- [ ] Measure file sizes and quality
- [ ] Determine vector vs raster ratio

### Phase 2: Batch Processing

- [ ] Set up consistent naming convention: `{companyName}_24px_optimized.webp`
- [ ] Process all logos through appropriate tool
- [ ] Quality check: view at 24px, 32px, 100px
- [ ] Validate file sizes (target: <5KB each)

### Phase 3: CMS Integration

- [ ] Upload optimized logos to CMS
- [ ] Update logo URLs in database
- [ ] Set proper cache headers: `Cache-Control: public, max-age=31536000`
- [ ] Enable gzip/brotli compression on CDN
- [ ] Test API endpoints return new URLs

### Phase 4: app-site Updates

No code changes needed! Current implementation already supports:
- ✅ PNG, WebP, SVG via PictureMarkerSymbol
- ✅ External CMS URLs
- ✅ LocalStorage caching

Just verify:
- [ ] Logos load correctly on map
- [ ] Browser DevTools Network tab shows proper caching
- [ ] Performance is improved (measure map load time)

### Phase 5: Monitoring

- [ ] Track bundle size (should not increase)
- [ ] Monitor API response times
- [ ] User feedback on logo quality
- [ ] Check mobile performance

---

## Best Practices

### For Logo Source Files

1. **Prefer clean, high-contrast logos**
   - Transparent backgrounds work best
   - Solid colors vectorize better than gradients
   - Minimum 100px × 100px source resolution

2. **Avoid problematic formats**
   - Don't use logos with heavy drop shadows
   - Avoid very thin lines (<2px at 24px scale)
   - Skip logos with complex textures

3. **Organize systematically**
   - Consistent naming: `CompanyName_Logo.png`
   - Keep originals in separate folder
   - Version control optimized outputs

### For ArcGIS Performance

1. **Optimize beyond file format**
   - Enable HTTP/2 on CMS server
   - Use CDN with edge caching
   - Implement service worker for offline caching
   - Preload top 20 most common logos

2. **Consider lazy loading**
   - Load logos for visible map extent only
   - Dynamically add uniqueValueInfos as needed
   - Unload logos when out of view

3. **Use level of detail (LOD)**
   - At low zoom: colored dots (no logos)
   - At medium zoom: simple icon set
   - At high zoom: full company logos

### For Maintenance

1. **Document logo processing workflow**
   - Keep settings used for each logo
   - Track which logos are vector vs raster
   - Version control this CLAUDE.md file

2. **Standardize quality gates**
   - Max file size: 5KB (ideal), 10KB (acceptable)
   - Visual check at 24px, 32px, 100px
   - Verify transparency preserved

3. **Plan for updates**
   - New company onboarding process
   - Logo update/refresh procedure
   - Backup originals before processing

---

## Technical Reference

### ArcGIS PictureMarkerSymbol Documentation

**Supported formats:**
- PNG (best compatibility)
- JPG (no transparency)
- GIF (limited colors)
- SVG (vector, but rendering can be slow)
- BMP (large files, avoid)
- WebP (modern, excellent compression)

**Size constraints:**
- Recommended: 16-64px
- Maximum: 200px (performance degrades)
- Uses standard `<img>` tags internally

**Performance notes:**
- Each unique symbol = separate image element
- Browser image cache helps significantly
- Data URLs bypass cache (avoid)
- SVG paths render slower than rasters at small sizes

### File Format Specifications

**WebP:**
- Lossy compression: 25-35% smaller than JPEG
- Supports transparency (unlike JPEG)
- Browser support: 97%+ (all modern browsers)
- MIME type: `image/webp`

**PNG:**
- Lossless compression
- Full transparency support
- Larger files than WebP
- Universal browser support
- MIME type: `image/png`

**SVG:**
- Vector format (resolution-independent)
- XML-based, text format
- Can be gzipped (70-80% reduction)
- Rendering performance varies by complexity
- MIME type: `image/svg+xml`

### Caching Strategy

**HTTP headers for logo files:**
```
Cache-Control: public, max-age=31536000, immutable
Content-Type: image/webp (or image/png, image/svg+xml)
Content-Encoding: gzip (or br for brotli)
```

**localStorage structure (already implemented):**
```javascript
{
  "companyIcons": [
    { "name": "Equinix", "logo": "/path/to/equinix_24px_optimized.webp" },
    { "name": "Digital Realty", "logo": "/path/to/digitalrealty_24px_optimized.webp" }
  ]
}
```

---

## Troubleshooting

### Common Issues

**Problem:** Vector SVG creates huge files (>100KB)

**Solution:**
- Reduce color count to 4-6
- Increase path simplification to 0.4-0.6
- If still too large, switch to raster optimizer
- Text-heavy logos almost always better as raster

---

**Problem:** Raster logos look pixelated at 32px

**Solution:**
- Create 32px version instead of 24px
- Increase quality to 90-95%
- Use 2x size (48px) and scale down with CSS
- Consider vector SVG for critical logos

---

**Problem:** Logos don't load on map

**Solution:**
- Check MIME type is correct (`image/webp` or `image/png`)
- Verify CORS headers on CMS server
- Check browser console for network errors
- Confirm localStorage cache is populated
- Test logo URL directly in browser

---

**Problem:** Map rendering is slow with logos

**Solution:**
- Reduce number of visible markers (clustering)
- Implement lazy loading for logos
- Use simpler visualization at low zoom
- Profile with Chrome DevTools Performance tab
- Check if logos are being re-downloaded (cache issue)

---

**Problem:** File size increased instead of decreased

**Solution:**
- **For vector SVG:** Logo too complex, use raster instead
- Reduce color count dramatically (try 3-4 colors)
- Check if original was already optimized
- Some logos inherently better as raster (text, photos)

---

## Quick Reference

### File Size Targets

| Logo Type | Format | Target Size | Acceptable Max |
|-----------|--------|-------------|----------------|
| Simple icon | Vector SVG | 1-3KB | 5KB |
| Complex logo | Vector SVG | 3-8KB | 10KB |
| Text logo | Raster WebP | 1-3KB | 5KB |
| Photo/gradient | Raster WebP | 2-5KB | 8KB |

### Quality Settings

| Use Case | Format | Size | Quality |
|----------|--------|------|---------|
| Map markers | WebP | 24px | 85% |
| UI elements | WebP | 32px | 85-90% |
| Profiles | PNG | 100px | 100% |
| Retina maps | WebP | 48px | 90% |

### Processing Time Estimates

- Vector SVG conversion: 2-5 seconds per logo
- Raster optimization: <1 second per logo
- Batch 100 logos (raster): ~2-3 minutes
- Batch 100 logos (vector): ~5-10 minutes

---

## Version History

- **v1** (original): SVG-wrapped WebP (30KB per logo, inefficient)
- **v2** (current): Dual approach - vector SVG for simple logos, raster WebP for complex
- **Tools created:** 2025-01-04

---

## Support & Resources

**Tools location:** `/Users/hoyoung/Documents/4 Archive/datacenterHawk/map_logo/`

**app-site codebase:** `/Users/hoyoung/Documents/1 Projects/datacenterHawk/_codebase/app-site/`

**Key files:**
- `stores/companies.js` - Logo fetching and PictureMarkerSymbol generation
- `stores/arcgisLayer.js` - Layer rendering and symbol management
- `components/map/VisualizationMenu.vue` - Visualization mode switching

**External resources:**
- [ArcGIS JS API - PictureMarkerSymbol](https://developers.arcgis.com/javascript/latest/api-reference/esri-symbols-PictureMarkerSymbol.html)
- [ImageTracer.js documentation](https://github.com/jankovicsandras/imagetracerjs)
- [WebP format specification](https://developers.google.com/speed/webp)

---

## Contact

For questions or issues with logo optimization, refer to this document or the main technical context at:
`/Users/hoyoung/Documents/1 Projects/datacenterHawk/_codebase/TECHNICAL_CONTEXT.md`
