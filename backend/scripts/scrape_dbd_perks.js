import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function syncDbdPerks() {
  console.log('[DBD Perks Scraper] 🌐 Fetching live perk data via MediaWiki API...');
  
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

  function parsePerkTable(tableHtml, role) {
    const perks = [];
    const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/g) || [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      // Icon
      const imgMatch = row.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
      let iconUrl = imgMatch ? imgMatch[1] : '';
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
        perks.push({
          id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          name,
          role, // 'survivor' | 'killer'
          character,
          icon: iconUrl,
          description
        });
      }
    }
    return perks;
  }

  const survivorPerks = parsePerkTable(tables[1], 'survivor');
  const killerPerks = parsePerkTable(tables[2], 'killer');

  const data = {
    updatedAt: new Date().toISOString(),
    total: survivorPerks.length + killerPerks.length,
    survivorCount: survivorPerks.length,
    killerCount: killerPerks.length,
    survivor: survivorPerks,
    killer: killerPerks
  };

  const outDir = path.join(__dirname, '../data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'dbd_perks.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');

  console.log(`✅ [DBD Perks Scraper] Successfully synced ${data.total} perks to ${outPath}`);
  console.log(`   - Survivor: ${survivorPerks.length}`);
  console.log(`   - Killer: ${killerPerks.length}`);

  return data;
}

// Run directly if invoked from CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  syncDbdPerks().catch(console.error);
}
