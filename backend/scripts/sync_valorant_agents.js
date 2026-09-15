import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'valorant_agents.json');

export async function syncValorantAgents() {
  console.log('[Valorant Sync] 🌐 Fetching playable agents from Valorant API...');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Fetch playable characters with English data (universal standard in Valorant)
  const res = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
  if (!res.ok) {
    throw new Error(`Failed to fetch Valorant agents: HTTP ${res.status}`);
  }

  const json = await res.json();
  const rawAgents = json.data || [];

  console.log(`[Valorant Sync] Received ${rawAgents.length} agents.`);

  const agents = rawAgents.map((a) => {
    return {
      uuid: a.uuid,
      id: a.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      name: a.displayName,
      developerName: a.developerName,
      description: a.description || '',
      role: a.role ? {
        id: a.role.displayName.toLowerCase(),
        name: a.role.displayName,
        description: a.role.description || '',
        icon: a.role.displayIcon || ''
      } : {
        id: 'initiator',
        name: 'Initiator',
        description: '',
        icon: ''
      },
      icon: a.displayIcon || '',
      iconSmall: a.displayIconSmall || '',
      bustPortrait: a.bustPortrait || '',
      fullPortrait: a.fullPortrait || a.fullPortraitV2 || a.bustPortrait || a.displayIcon || '',
      background: a.background || '',
      backgroundGradientColors: a.backgroundGradientColors || ['ff4655ff', '0f1923ff', 'ece8e1ff'],
      abilities: (a.abilities || []).map((ab) => ({
        slot: ab.slot,
        name: ab.displayName,
        description: ab.description || '',
        icon: ab.displayIcon || ''
      }))
    };
  });

  // Sort alphabetically by name
  agents.sort((a, b) => a.name.localeCompare(b.name));

  // Count by role
  const roleCounts = {};
  agents.forEach(a => {
    const r = a.role.name;
    roleCounts[r] = (roleCounts[r] || 0) + 1;
  });

  const payload = {
    updatedAt: new Date().toISOString(),
    total: agents.length,
    roles: roleCounts,
    agents
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✅ [Valorant Sync] Successfully saved ${agents.length} agents to ${DATA_FILE}`);
  console.log('   Roles breakdown:', roleCounts);

  return payload;
}

// Run directly if invoked from CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  syncValorantAgents().catch(console.error);
}
