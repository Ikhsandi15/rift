export const ROLES = {
  vanguard: { name: 'Vanguard', element: 'ember', icon: '🔥', color: '#ff6b55', archetype: 'Frontline · Bruiser', hp: 130, stamina: 5, attack: 15, defense: 13, passive: 'Cinder Heart', skill: 'Comet Break', skillText: 'Menerjang dan memberi damage besar. Serangan berikutnya melemahkan armor Rift.', lore: 'Dibesarkan di kota bara Khar, Vanguard menjaga api mercusuar yang menuntun pengungsi melewati kabut Rift.' },
  tideweaver: { name: 'Tideweaver', element: 'tide', icon: '🌊', color: '#55c9ef', archetype: 'Support · Control', hp: 105, stamina: 6, attack: 11, defense: 11, passive: 'Undertow', skill: 'Moonwell', skillText: 'Memulihkan vitalitas dan menandai musuh; serangan berikutnya lebih mudah mengenai.', lore: 'Para Tideweaver membaca arus memori di Teluk Luruh. Mereka tahu Rift bukan sekadar retakan ruang—ia mengingat.' },
  mosswarden: { name: 'Mosswarden', element: 'moss', icon: '🌿', color: '#83d68a', archetype: 'Tank · Sustain', hp: 155, stamina: 5, attack: 10, defense: 18, passive: 'Old Growth', skill: 'Root Bastion', skillText: 'Menanam perisai akar yang menyerap pukulan dan memulihkan sedikit HP.', lore: 'Mosswarden lahir dari kebun yang tumbuh di atas reruntuhan. Mereka berjanji tak akan membiarkan perang lama berakar lagi.' },
  arcanist: { name: 'Rift Arcanist', element: 'arcane', icon: '✦', color: '#b38aff', archetype: 'Burst · Spellblade', hp: 95, stamina: 6, attack: 18, defense: 8, passive: 'Fracture Sight', skill: 'Prism Lance', skillText: 'Menembakkan pecahan cahaya yang menembus pertahanan dan memicu chain damage.', lore: 'Arcanist pertama membuka Rift demi mencari jawaban. Yang kembali membawa peta bintang yang tidak pernah ada.' },
  gearling: { name: 'Gearling', element: 'tech', icon: '⚙️', color: '#f6bd55', archetype: 'Engineer · Utility', hp: 115, stamina: 6, attack: 12, defense: 12, passive: 'Salvage Protocol', skill: 'Clockwork Swarm', skillText: 'Melepas drone mini yang mengganggu musuh dan memberi satu kesempatan serangan ekstra.', lore: 'Dibangun dari jam kota yang berhenti saat Rift pertama terbuka. Gearling mencari potongan mekanisme yang hilang—termasuk detak jantungnya.' },
  wisp_scout: { name: 'Wisp Scout', element: 'gale', icon: '🪽', color: '#a9d4ff', archetype: 'Scout · Mobility', hp: 100, stamina: 7, attack: 14, defense: 9, passive: 'Slipstream', skill: 'Afterimage Dash', skillText: 'Menghindar lalu menyerang dari sisi terbuka. Timing tepat membatalkan serangan musuh.', lore: 'Para Wisp Scout mengikuti jalur angin yang hanya muncul sebelum fajar. Mereka mengantar pesan di antara dunia yang hampir terpisah.' }
};

export const ENEMIES = [
  { id: 'riftling', name: 'Riftling', icon: '◉', hp: 46, attack: 10, defense: 3, xp: 32, gold: 16, lore: 'Bayangan kecil yang tertinggal setiap kali Rift bernapas.' },
  { id: 'scrap_hound', name: 'Scrap Hound', icon: '⌁', hp: 72, attack: 14, defense: 6, xp: 55, gold: 25, lore: 'Pemulung mekanis yang mengunyah serpihan dunia.' },
  { id: 'hollow_knight', name: 'Hollow Knight', icon: '♜', hp: 104, attack: 18, defense: 10, xp: 82, gold: 38, lore: 'Penjaga tanpa nama dari benteng yang tidak tercatat di peta.' }
];
export const BOSS = { id: 'bell_warden', name: 'Bell Warden', icon: '⟡', hp: 190, attack: 22, defense: 13, xp: 180, gold: 95, lore: 'Penjaga lonceng yang membunyikan jam bagi dua dunia sekaligus.' };
export const QUESTS = [
  { id: 'first_steps', title: 'A Spark in the Dark', objective: 'Selesaikan satu latihan.', reward: { xp: 25, gold: 15 }, text: 'Cahaya kecil cukup untuk menemukan jalan pertama.' },
  { id: 'first_rift', title: 'Close the Fracture', objective: 'Menangkan satu encounter.', reward: { xp: 45, gold: 28 }, text: 'Rift tidak tertutup oleh keberanian saja—tetapi keberanian membuka langkah pertama.' },
  { id: 'field_notes', title: 'Field Notes', objective: 'Baca kartu avatar publik.', reward: { xp: 18, gold: 10 }, text: 'Setiap kartu menyimpan catatan seorang penjaga.' }
];
export const ITEMS = [
  { id: 'cinder_charm', name: 'Cinder Charm', slot: 'charm', rarity: 'Uncommon', effect: '+2 Attack', lore: 'Hangat walau sudah lama padam.' },
  { id: 'tideglass', name: 'Tideglass Loop', slot: 'charm', rarity: 'Rare', effect: '+8 Max HP', lore: 'Air di dalamnya mengalir ke atas.' },
  { id: 'mosswrap', name: 'Mossbound Wrap', slot: 'armor', rarity: 'Uncommon', effect: '+3 Defense', lore: 'Ditenun dari akar yang menolak mati.' },
  { id: 'rift_compass', name: 'Rift Compass', slot: 'relic', rarity: 'Epic', effect: '+1 XP on victory', lore: 'Jarumnya menunjuk ke tempat yang paling dirindukan.' }
];

export function xpForNext(level) { return 70 + level * 35 + Math.floor(level * level * 2.5); }
