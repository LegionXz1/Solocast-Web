import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '../data/dbd_perks.json');
const RAW_DIR = path.join(__dirname, '../public/assets/dbd-perks-raw');
const OUT_DIR = path.join(__dirname, '../public/assets/dbd-perks');

async function downloadFile(url, destPath) {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
    return true; // Already downloaded
  }
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  };

  for (let attempt = 1; attempt <= 4; attempt++) {
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
        console.log(`[RateLimited 429] waiting ${attempt * 1200}ms before retry for ${url}...`);
        await new Promise(r => setTimeout(r, attempt * 1200));
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 600));
    }
  }
  return false;
}

async function main() {
  console.log('🚀 Starting DBD Perks Download & AI Enhancement Pipeline...');

  if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true });
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const perkData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const allPerks = [...perkData.survivor, ...perkData.killer];
  console.log(`Total perks to process: ${allPerks.length}`);

  // Step 1: Download in managed concurrent batches
  console.log('\n📥 Step 1/3: Downloading raw perk textures from wiki.gg...');
  const BATCH_SIZE = 6;
  let downloadedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < allPerks.length; i += BATCH_SIZE) {
    const batch = allPerks.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (perk) => {
      const slug = perk.id;
      const rawDest = path.join(RAW_DIR, `${slug}.png`);
      
      // Ensure we use the clean full-res URL
      let sourceUrl = perk.icon;
      if (sourceUrl.includes('/thumb/')) {
        sourceUrl = sourceUrl.replace(/\/thumb\/([^\/]+)\/\d+px-.*$/, (m, f) => '/' + f);
      }
      if (!sourceUrl.startsWith('http')) {
        sourceUrl = 'https://deadbydaylight.wiki.gg' + sourceUrl;
      }

      const ok = await downloadFile(sourceUrl, rawDest);
      if (ok) {
        downloadedCount++;
      } else {
        console.warn(`❌ Failed downloading: ${perk.name} (${sourceUrl})`);
        failedCount++;
      }
    }));

    if ((i + BATCH_SIZE) % 30 === 0 || i + BATCH_SIZE >= allPerks.length) {
      console.log(`   Downloaded ${Math.min(i + BATCH_SIZE, allPerks.length)} / ${allPerks.length}...`);
    }
    // Small courtesy pause between batches
    await new Promise(r => setTimeout(r, 80));
  }

  console.log(`✅ Download complete: ${downloadedCount} succeeded, ${failedCount} failed.`);

  // Step 2: Run Python enhancement script
  console.log('\n✨ Step 2/3: Running Super-Resolution & Clarity Enhancement to 512x512...');
  const pyScript = path.join(__dirname, 'enhance_perk_images.py');
  
  const pyCode = `
import os
import glob
from PIL import Image, ImageFilter, ImageEnhance

raw_dir = r"${RAW_DIR.replace(/\\/g, '/')}"
out_dir = r"${OUT_DIR.replace(/\\/g, '/')}"

files = glob.glob(os.path.join(raw_dir, "*.png"))
print(f"Processing {len(files)} perk icons with Lanczos 512x512 + Unsharp Mask...")

processed = 0
for fpath in files:
    try:
        fname = os.path.basename(fpath)
        out_path = os.path.join(out_dir, fname)
        
        with Image.open(fpath) as img:
            img = img.convert('RGBA')
            
            # Super-sample Lanczos upscale to 512x512 (Ultra HD line art)
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
            processed += 1
    except Exception as e:
        print(f"Error processing {fpath}: {e}")

print(f"✅ Successfully enhanced {processed} perk images to 512x512!")
`;
  fs.writeFileSync(pyScript, pyCode, 'utf8');

  try {
    execSync(`python "${pyScript}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('Python enhancement error:', err);
  }

  // Step 3: Update dbd_perks.json to point to local assets
  console.log('\n📝 Step 3/3: Updating dbd_perks.json with local /assets/dbd-perks/ URLs...');
  let updatedInJson = 0;
  for (const role of ['survivor', 'killer']) {
    for (const perk of perkData[role]) {
      const localFile = path.join(OUT_DIR, `${perk.id}.png`);
      if (fs.existsSync(localFile)) {
        perk.icon = `/assets/dbd-perks/${perk.id}.png`;
        updatedInJson++;
      }
    }
  }

  perkData.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(perkData, null, 2), 'utf8');
  console.log(`🎉 Done! Updated ${updatedInJson} perks in ${DATA_FILE} to local 512x512 high-res assets!`);

  // Clean up raw temp dir and pyScript
  try {
    if (fs.existsSync(pyScript)) fs.unlinkSync(pyScript);
    console.log('🧹 Cleaned up temporary build scripts.');
  } catch(e) {}
}

main().catch(console.error);
