/* Avatar Studio: what can be chosen. The free face parts are numbered options (the drawing lives in the browser); items come from the shop. */
const LOOK = { build: 3, shape: 5, skin: 8, hairStyle: 6, hairColor: 10, eyeStyle: 6, eyeColor: 8, brows: 5, mouth: 6 };
const DEFAULT_LOOK = { build: 1, shape: 0, skin: 2, hairStyle: 1, hairColor: 1, eyeStyle: 0, eyeColor: 0, brows: 0, mouth: 0 };
const STYLES = ['cartoon', 'modern', 'fantasy', 'animal', 'robot'];
const SLOTS = ['top', 'bottom', 'dress', 'outfit', 'shoes', 'hat', 'glasses', 'headphones', 'back', 'wrist', 'neck', 'hands', 'wings', 'mask', 'pet', 'background', 'effect', 'animation', 'style', 'collectible'];
const KIND_SLOT = { tee: 'top', hoodie: 'top', jacket: 'top', shirt: 'top', pants: 'bottom', shorts: 'bottom', dress: 'dress', shoes: 'shoes', costume: 'outfit', seasonal: 'outfit',
  glasses: 'glasses', sunglasses: 'glasses', hat: 'hat', cap: 'hat', headphones: 'headphones', backpack: 'back', watch: 'wrist', necklace: 'neck', wings: 'wings', mask: 'mask',
  cat: 'pet', dog: 'pet', rabbit: 'pet', fox: 'pet', dragon: 'pet', bird: 'pet', dino: 'pet', fantasy: 'pet', panda: 'pet', redpanda: 'pet', hamster: 'pet', penguin: 'pet',
  fashion: 'outfit', headwear: 'hat', footwear: 'shoes', neckwear: 'neck', cape: 'back', gloves: 'hands', facewear: 'mask',
  animation: 'animation', background: 'background', effect: 'effect', style: 'style', collectible: 'collectible' };
const KINDS = Object.keys(KIND_SLOT);
const CATEGORY = (kind) => (['tee', 'hoodie', 'jacket', 'shirt', 'pants', 'shorts', 'dress', 'shoes', 'costume', 'seasonal', 'fashion', 'footwear'].includes(kind) ? 'clothing'
  : ['glasses', 'sunglasses', 'hat', 'cap', 'headphones', 'backpack', 'watch', 'necklace', 'wings', 'mask', 'headwear', 'neckwear', 'cape', 'gloves', 'facewear'].includes(kind) ? 'accessory'
  : ['cat', 'dog', 'rabbit', 'fox', 'dragon', 'bird', 'dino', 'fantasy', 'panda', 'redpanda', 'hamster', 'penguin'].includes(kind) ? 'pet' : 'special');
/* the fashion collections of the shop and their sub-collections (the keys are translated as av.collection.* / av.sub.*) */
const COLLECTIONS = {
  everyday: ['tshirts', 'hoodies', 'jackets', 'jeans', 'dresses', 'sneakers', 'hats', 'accessories', 'work'],
  traditional: ['uzbek', 'japanese', 'korean', 'chinese', 'indian', 'arab', 'african', 'european'],
  sports: ['football', 'basketball', 'racing', 'boxing', 'martial', 'tennis', 'winter', 'water', 'team', 'cycling'],
  formal: ['suits', 'dresses', 'business', 'elegant', 'school'],
  fantasy: ['wizards', 'knights', 'elves', 'dragons', 'magic'],
  historical: ['medieval', 'ancient', 'victorian', 'renaissance', 'viking', 'samurai'],
  futuristic: ['cyberpunk', 'scifi', 'space', 'robot'],
  gaming: ['battle-royale', 'rpg', 'adventure', 'racing-games', 'survival', 'platformer', 'stealth'],
  fandom: ['anime', 'cartoon', 'movies', 'superheroes', 'fantasy-worlds'],
  seasonal: ['winter', 'summer', 'spring', 'autumn', 'halloween', 'christmas', 'nowruz', 'party'],
  streetwear: ['hiphop', 'skate', 'urban'],
  luxury: ['designer', 'premium', 'couture'],
};
/* Gaming skins: one category per game (original, fan-inspired designs; the keys are translated as av.collection.* / av.sub.*) */
const GAMES = {
  cs16: ['ct', 't', 'sas', 'urban-unit', 'arctic', 'ember-cell'], cs2: ['agents', 'special-forces', 'gloves', 'masks', 'military'], minecraft: ['explorers', 'mobs', 'nether', 'diamond'],
  fortnite: ['warriors', 'futuristic', 'astronauts', 'ninjas', 'fantasy-heroes'], pubg: ['military', 'helmets', 'tactical', 'masks', 'costumes'], roblox: ['blocky-outfits', 'roblox-accessories', 'themed'],
  valorant: ['agents', 'tactical-wear', 'agent-accessories'], freefire: ['battle', 'futuristic', 'masks', 'streetwear'], cod: ['soldiers', 'equipment', 'operators'],
  apex: ['scifi-warriors', 'armor', 'legend-costumes'], overwatch: ['heroes', 'hero-suits', 'hero-accessories'], lol: ['champions', 'mages', 'warriors'], dota2: ['heroes', 'armor', 'robes', 'magic-accessories'],
  terraria: ['armor-sets', 'fantasy-costumes', 'adventure'], amongus: ['crew-suits', 'crew-hats', 'funny-accessories'],
};
const GAME_KEYS = Object.keys(GAMES);
/* the shop tab of an item: game skins are listed under their own tab, everything else by its kind */
const categoryOf = (kind, collection) => (GAMES[collection] ? 'games' : CATEGORY(kind));
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const POSES = ['sit', 'play', 'sleep'];
const EARN_TYPES = ['lessons', 'streak', 'xp', 'levels', 'words', 'tokens', 'missions'];
const MAX_AVATARS = 6;
const REWARD_KEYS = ['token_lesson', 'token_topic', 'token_test', 'token_mission', 'token_streak7', 'token_level'];
/* the character level grows with XP (XP itself is never spent) */
const charLevel = (xp) => { const x = Math.max(0, Number(xp) || 0), lv = 1 + Math.floor(Math.sqrt(x / 40)), at = (n) => 40 * (n - 1) * (n - 1); return { level: lv, from: at(lv), next: at(lv + 1), pct: Math.round(100 * (x - at(lv)) / (at(lv + 1) - at(lv))) }; };
module.exports = { GAMES, GAME_KEYS, categoryOf, COLLECTIONS, LOOK, DEFAULT_LOOK, STYLES, SLOTS, KIND_SLOT, KINDS, CATEGORY, RARITIES, POSES, EARN_TYPES, MAX_AVATARS, REWARD_KEYS, charLevel };
