import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAW_DIR = path.join(__dirname, '../public/assets/dbd-perks-raw');
const OUT_DIR = path.join(__dirname, '../public/assets/dbd-perks');
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'dbd_perks.json');

async function downloadFile(url, destPath) {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
    return true; // Already downloaded
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 500) {
          fs.writeFileSync(destPath, buf);
          return true;
        }
      }
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, attempt * 1200));
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 600));
    }
  }
  return false;
}

function enhancePerkImages(slugs) {
  if (!slugs || slugs.length === 0) return;

  const pyScript = path.join(__dirname, `temp_enhance_${Date.now()}.py`);
  const pyCode = `
import os
import sys

# Force UTF-8 stdout for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from PIL import Image, ImageFilter, ImageEnhance

raw_dir = r"${RAW_DIR.replace(/\\/g, '/')}"
out_dir = r"${OUT_DIR.replace(/\\/g, '/')}"
slugs = ${JSON.stringify(slugs)}

for slug in slugs:
    raw_path = os.path.join(raw_dir, f"{slug}.png")
    out_path = os.path.join(out_dir, f"{slug}.png")
    if not os.path.exists(raw_path):
        continue
    try:
        with Image.open(raw_path) as img:
            img = img.convert('RGBA')
            # Super-sample Lanczos upscale to 512x512
            upscaled = img.resize((512, 512), resample=Image.Resampling.LANCZOS)
            
            # Split RGBA to process color and alpha independently
            r, g, b, a = upscaled.split()
            rgb = Image.merge('RGB', (r, g, b))
            
            # Line art sharpening
            sharpened_rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.8, percent=140, threshold=2))
            sharpened_a = a.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=2))
            
            # Subtle contrast enhancement
            enhancer = ImageEnhance.Contrast(sharpened_rgb)
            final_rgb = enhancer.enhance(1.06)
            
            final_img = Image.merge('RGBA', (*final_rgb.split(), sharpened_a))
            final_img.save(out_path, 'PNG', optimize=True)
            print(f"[OK] Enhanced 512x512: {slug}")
    except Exception as e:
        print(f"Error enhancing {slug}: {e}")
`;

  fs.writeFileSync(pyScript, pyCode, 'utf8');
  try {
    execSync(`python "${pyScript}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('Python enhancement error:', err);
  } finally {
    try {
      if (fs.existsSync(pyScript)) fs.unlinkSync(pyScript);
    } catch (_) {}
  }
}

export async function syncDbdPerks() {
  console.log('[DBD Perks Scraper] 🌐 Fetching live perk data via MediaWiki API...');

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const apiUrl = 'https://deadbydaylight.wiki.gg/api.php?action=parse&page=Perks&format=json&prop=text';
  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'SolocastWidget/1.0 (https://github.com)'
    }
  });

  if (!res.ok) {
    throw new Error(`MediaWiki API request failed: HTTP ${res.status}`);
  }

  const json = await res.json();
  const html = json.parse?.text?.['*'];

  if (!html) {
    throw new Error('No parsed HTML returned by MediaWiki API');
  }

  const tables = html.match(/<table[\s\S]*?<\/table>/g);
  if (!tables || tables.length < 3) {
    throw new Error('Could not locate perk tables in Wiki HTML');
  }

  const newPerksToDownload = [];

  function parsePerkTable(tableHtml, role) {
    const perks = [];
    const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/g) || [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      // Icon (Convert thumbnail e.g. /images/thumb/Icon.png/96px-Icon.png to full-res /images/Icon.png)
      const imgMatch = row.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
      let iconUrl = imgMatch ? imgMatch[1] : '';
      if (iconUrl.includes('/thumb/')) {
        iconUrl = iconUrl.replace(/\/thumb\/([^\/]+)\/\d+px-.*$/, (m, f) => '/' + f);
      }
      if (iconUrl.startsWith('/')) {
        iconUrl = 'https://deadbydaylight.wiki.gg' + iconUrl;
      }

      // th tags: th[0] is icon, th[1] is name, th[2] is character
      const ths = row.match(/<th[\s\S]*?<\/th>/g) || [];
      const name = ths[1] ? ths[1].replace(/<[^>]+>/g, '').trim() : '';
      let character = 'All';
      if (ths[2]) {
        character = ths[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'All';
        if (character.toLowerCase().includes('all')) character = 'All (General)';
      }

      // Description in td
      const tds = row.match(/<td[\s\S]*?<\/td>/g) || [];
      let description = '';
      if (tds[0]) {
        description = tds[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }

      if (name) {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const localFile = path.join(OUT_DIR, `${slug}.png`);

        let perkIcon = `/assets/dbd-perks/${slug}.png`;
        let needsDownload = false;

        if (!fs.existsSync(localFile)) {
          needsDownload = true;
          // Fallback temporarily to iconUrl if not downloaded yet
          perkIcon = iconUrl || `/assets/dbd-perks/${slug}.png`;
        }

        const perkObj = {
          id: slug,
          name,
          role, // 'survivor' | 'killer'
          character,
          icon: perkIcon,
          description
        };

        if (needsDownload && iconUrl) {
          newPerksToDownload.push({ slug, iconUrl, perkObj });
        }

        perks.push(perkObj);
      }
    }
    return perks;
  }

  const survivorPerks = parsePerkTable(tables[1], 'survivor');
  const killerPerks = parsePerkTable(tables[2], 'killer');

  // If any new perks were discovered that don't have a 512x512 local image yet
  if (newPerksToDownload.length > 0) {
    console.log(`\n🆕 Found ${newPerksToDownload.length} new perk(s) without local images! Downloading & upscaling to 512x512...`);
    if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true });

    const downloadedSlugs = [];
    for (const item of newPerksToDownload) {
      const rawPath = path.join(RAW_DIR, `${item.slug}.png`);
      const ok = await downloadFile(item.iconUrl, rawPath);
      if (ok) {
        downloadedSlugs.push(item.slug);
      } else {
        console.warn(`⚠️ Could not download image for ${item.slug}, keeping fallback URL.`);
      }
    }

    if (downloadedSlugs.length > 0) {
      enhancePerkImages(downloadedSlugs);
      for (const item of newPerksToDownload) {
        const localFile = path.join(OUT_DIR, `${item.slug}.png`);
        if (fs.existsSync(localFile)) {
          item.perkObj.icon = `/assets/dbd-perks/${item.slug}.png`;
        }
      }
    }
  } else {
    console.log(`✅ All ${survivorPerks.length + killerPerks.length} perks have local 512x512 assets.`);
  }

  const data = {
    updatedAt: new Date().toISOString(),
    total: survivorPerks.length + killerPerks.length,
    survivorCount: survivorPerks.length,
    killerCount: killerPerks.length,
    survivor: survivorPerks,
    killer: killerPerks
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');

  console.log(`🎉 [DBD Perks Scraper] Successfully synced ${data.total} perks to ${DATA_FILE}`);
  console.log(`   - Survivor: ${survivorPerks.length}`);
  console.log(`   - Killer: ${killerPerks.length}`);

  return data;
}

// Run directly if invoked from CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  syncDbdPerks().catch(console.error);
}
