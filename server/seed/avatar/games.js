/* Gaming skins: one category per popular game, with sub-categories. Every item is an ORIGINAL design that hints at the genre and mood of the
   game (tactical squads, blocky worlds, battle-royale heroes, space crews, fantasy champions ...). Nothing is copied from the games: no logos,
   no character names, no exact outfits. The titles are used only to say which game a collection is inspired by. */
const { PAL, PRICE, cap } = require('./fashion');

const NEXT = { common: 'rare', uncommon: 'rare', rare: 'epic', epic: 'legendary', legendary: 'mythic', mythic: 'mythic' };
const KIND = { o: 'fashion', h: 'headwear', f: 'facewear', g: 'gloves', s: 'footwear', b: 'cape', n: 'neckwear' };
/* noun: [English, Uzbek, Russian, gender 0 m / 1 f / 2 n / 3 plural] */
const items = [], key = new Set();
/* entry: [kind, design, game, sub, base rarity, noun, variants 'main/accent[/third][@face][#number]'] */
function add(kind, style, game, sub, base, noun, variants) {
  const [en, uz, ru, g] = noun;
  variants.forEach((vstr, i) => {
    const [pre, num] = vstr.split('#'), [body, face] = pre.split('@'), [m, a, t3] = body.split('/');
    const [hex, cen, cuz, cru] = PAL[m], c2 = PAL[a][0], c3 = t3 ? PAL[t3][0] : '';
    let slug = `gm-${game}-${style}-${m}`; if (key.has(slug)) slug += '-' + a; if (key.has(slug)) slug += '-' + i; key.add(slug);
    const rarity = i === variants.length - 1 && variants.length > 2 ? NEXT[base] : base;
    const art = { v: style, c: hex, c2, ...(c3 ? { c3 } : {}), ...(face ? { e: face } : {}), ...(num ? { n: Number(num) } : {}) };
    items.push({ slug, en: `${cen} ${en}`, uz: `${cuz} ${uz.toLowerCase()}`, ru: `${cap(cru[g])} ${ru}`, kind: KIND[kind], rarity, art, price: PRICE[rarity] || 1800, earn: '', starter: 0, collection: game, subcollection: sub });
  });
}
const N = (en, uz, ru, g = 0) => [en, uz, ru, g];

/* ---------- 1. Counter-Strike 1.6 style: classic squads ---------- */
add('o', 'ct_gear', 'cs16', 'ct', 'common', N('squad tactical gear', 'otryad taktik kiyimi', 'тактическое снаряжение отряда', 2), ['blue/white/navy', 'navy/sky/charcoal', 'sky/white/navy']);
add('h', 'milhelm', 'cs16', 'ct', 'common', N('squad helmet', 'otryad dubulğasi', 'шлем отряда', 0), ['navy/silver', 'blue/white']);
add('s', 'tacboot', 'cs16', 'ct', 'common', N('squad boots', 'otryad etigi', 'ботинки отряда', 3), ['black/silver', 'navy/white']);
add('o', 't_gear', 'cs16', 't', 'common', N('raider gear', 'reydçi kiyimi', 'экипировка рейдера', 2), ['brown/khaki/charcoal', 'charcoal/red/black', 'olive/brown/charcoal']);
add('f', 'balaclava', 'cs16', 't', 'common', N('raider balaclava', 'reydçi niqobi', 'балаклава рейдера', 1), ['black/gray', 'charcoal/red']);
add('h', 'bandanahead', 'cs16', 't', 'common', N('raider headband', 'reydçi bandanasi', 'повязка рейдера', 1), ['red/black', 'brown/white']);
add('o', 'sas_gear', 'cs16', 'sas', 'rare', N('black assault suit', 'qora hujum kostyumi', 'чёрный штурмовой костюм', 0), ['black/gray/charcoal', 'charcoal/olive/black', 'navy/gray/black']);
add('h', 'swathelm', 'cs16', 'sas', 'rare', N('visor assault helmet', 'ŏynali hujum dubulğasi', 'штурмовой шлем с забралом', 0), ['black/blue', 'charcoal/sky']);
add('g', 'tacglove', 'cs16', 'sas', 'common', N('assault gloves', 'hujum qoʻlqoplari'.replace('qoʻl', 'qŏl'), 'штурмовые перчатки', 3), ['black/gray', 'charcoal/olive']);
add('o', 'urban_unit', 'cs16', 'urban-unit', 'rare', N('urban response gear', 'şahar tezkor kiyimi', 'городская экипировка быстрого реагирования', 2), ['navy/gold/charcoal', 'black/white/charcoal', 'charcoal/sky/navy']);
add('h', 'tachelm', 'cs16', 'urban-unit', 'rare', N('response helmet', 'tezkor dubulğa', 'шлем быстрого реагирования', 0), ['navy/white', 'black/gold']);
add('f', 'gasmask', 'cs16', 'urban-unit', 'rare', N('response gas mask', 'tezkor gaz niqobi', 'противогаз спецотряда', 0), ['black/gray', 'navy/silver']);
add('o', 'arctic_gear', 'cs16', 'arctic', 'uncommon', N('snow camo set', 'qor kamuflyaj to‘plami'.replace('to‘p', 'tŏp'), 'зимний камуфляжный комплект', 0), ['white/sky/gray', 'gray/white/silver', 'silver/blue/white']);
add('h', 'bobble', 'cs16', 'arctic', 'common', N('snow hat', 'qor qalpoği', 'зимняя шапка', 1), ['white/gray', 'gray/white']);
add('f', 'gaiterface', 'cs16', 'arctic', 'common', N('snow face gaiter', 'qor yuz yopqiçi', 'снежный бафф', 0), ['white/gray', 'gray/silver']);
add('o', 'ember_raider', 'cs16', 'ember-cell', 'uncommon', N('guerrilla jacket set', 'partizan kurtka to‘plami'.replace('to‘p', 'tŏp'), 'партизанская куртка с брюками', 0), ['red/orange/maroon', 'maroon/gold/black', 'orange/yellow/brown']);
add('f', 'bandanaface', 'cs16', 'ember-cell', 'common', N('guerrilla face scarf', 'partizan yuz şarfi', 'партизанский шарф на лицо', 0), ['red/black', 'orange/black']);
add('h', 'boonie', 'cs16', 'ember-cell', 'common', N('guerrilla bucket hat', 'partizan keng şlyapa', 'партизанская панама', 1), ['olive/black', 'brown/khaki']);

/* ---------- 2. Counter-Strike 2 style: modern agents ---------- */
add('o', 'agent_suit', 'cs2', 'agents', 'rare', N('agent field suit', 'agent dala kostyumi', 'полевой костюм агента', 0), ['navy/lime/charcoal', 'charcoal/orange/black', 'olive/yellow/charcoal', 'black/sky/charcoal']);
add('o', 'agent_coat', 'cs2', 'agents', 'epic', N('long agent coat', 'uzun agent paltosi', 'длинное пальто агента', 2), ['charcoal/sky/black', 'black/lime/charcoal']);
add('h', 'tachelm', 'cs2', 'agents', 'rare', N('agent helmet', 'agent dubulğasi', 'шлем агента', 0), ['charcoal/lime', 'olive/orange']);
add('o', 'special_forces', 'cs2', 'special-forces', 'epic', N('special forces armor kit', 'maxsus kuçlar zirhi', 'броня спецназа', 1), ['charcoal/gray/black', 'olive/khaki/olive', 'black/red/black']);
add('h', 'swathelm', 'cs2', 'special-forces', 'epic', N('special forces visor helmet', 'maxsus kuçlar dubulğasi', 'шлем спецназа с забралом', 0), ['black/sky', 'olive/blue']);
add('s', 'combat', 'cs2', 'special-forces', 'rare', N('combat boots', 'jang etigi', 'боевые ботинки', 3), ['black/white', 'olive/khaki']);
add('g', 'tacglove', 'cs2', 'gloves', 'rare', N('tactical gloves', 'taktik qŏlqoplar', 'тактические перчатки', 3), ['black/lime', 'olive/orange', 'charcoal/sky']);
add('g', 'fullglove', 'cs2', 'gloves', 'rare', N('leather gloves', 'charm qŏlqoplar'.replace('charm', 'çarm'), 'кожаные перчатки', 3), ['brown/black', 'black/red']);
add('g', 'cyberglove', 'cs2', 'gloves', 'epic', N('neon-line gloves', 'neon çiziqli qŏlqoplar', 'перчатки с неоновыми линиями', 3), ['charcoal/lime', 'navy/sky', 'black/pink']);
add('g', 'gauntlet', 'cs2', 'gloves', 'epic', N('armored gauntlets', 'zirhli qŏlqoplar', 'бронированные краги', 3), ['gray/orange', 'charcoal/gold']);
add('f', 'balaclava', 'cs2', 'masks', 'common', N('tactical balaclava', 'taktik niqob', 'тактическая балаклава', 1), ['black/gray', 'olive/black', 'charcoal/lime']);
add('f', 'respirator', 'cs2', 'masks', 'rare', N('filter respirator', 'filtrli respirator', 'респиратор с фильтрами', 0), ['olive/orange', 'black/sky']);
add('f', 'skullmask', 'cs2', 'masks', 'rare', N('skull half-mask', 'bosh suyagi yarim niqobi'.replace('bosh', 'boş'), 'маска-череп', 1), ['white/gray', 'gray/black']);
add('f', 'tacvisor', 'cs2', 'masks', 'epic', N('smoked visor', 'tutunli ŏyna', 'тонированное забрало', 2), ['black/gray', 'charcoal/lime']);
add('f', 'gasmask', 'cs2', 'masks', 'epic', N('gas mask', 'gaz niqobi', 'противогаз', 0), ['olive/gray', 'black/orange']);
add('o', 'fatigues', 'cs2', 'military', 'uncommon', N('digital camo fatigues', 'raqamli kamuflyaj kiyimi', 'цифровой камуфляж', 0), ['olive/khaki/olive', 'gray/black/charcoal', 'sky/navy/gray']);
add('h', 'milhelm', 'cs2', 'military', 'uncommon', N('field helmet', 'dala dubulğasi', 'полевой шлем', 0), ['olive/khaki', 'gray/black']);
add('n', 'dogtag', 'cs2', 'military', 'common', N('ID tags', 'raqam taqinçoqlari', 'жетоны', 3), ['silver/black', 'gold/black']);

/* ---------- 3. Minecraft style: blocky worlds ---------- */
add('o', 'block_hero', 'minecraft', 'explorers', 'common', N('blocky explorer suit', 'kubik tadqiqotçi kiyimi', 'костюм кубического исследователя', 0), ['teal/sky/navy', 'blue/cream/navy', 'brown/gold/olive', 'purple/pink/navy']);
add('h', 'blockhead', 'minecraft', 'explorers', 'rare', N('blocky explorer head', 'kubik tadqiqotçi boşi'.replace('boşi', 'başi'), 'кубическая голова исследователя', 1), ['brown/black@smile', 'cream/charcoal@smile', 'olive/black@grim']);
add('s', 'pixelboot', 'minecraft', 'explorers', 'common', N('blocky boots', 'kubik etik', 'кубические ботинки', 3), ['brown/gray', 'navy/white']);
add('b', 'cubepack', 'minecraft', 'explorers', 'common', N('cube backpack', 'kubik ryukzak', 'кубический рюкзак', 0), ['brown/gold', 'green/yellow']);
add('o', 'block_mob', 'minecraft', 'mobs', 'rare', N('blocky creature suit', 'kubik maxluq kiyimi', 'костюм кубического существа', 0), ['green/lime/olive', 'black/purple/charcoal', 'teal/mint/olive', 'silver/gray/charcoal']);
add('h', 'blockhead', 'minecraft', 'mobs', 'epic', N('blocky creature head', 'kubik maxluq boşi'.replace('boşi', 'başi'), 'кубическая голова существа', 1), ['green/black@grim', 'black/purple@ender', 'teal/black@zombie', 'silver/charcoal@bones']);
add('g', 'blockhand', 'minecraft', 'mobs', 'common', N('blocky hands', 'kubik qŏllar', 'кубические руки', 3), ['green/olive', 'black/purple', 'silver/gray']);
add('o', 'nether_armor', 'minecraft', 'nether', 'epic', N('molten block armor', 'erigan kubik zirh', 'расплавленная кубическая броня', 1), ['maroon/gold/orange', 'black/orange/maroon', 'charcoal/red/orange']);
add('h', 'blockhelm', 'minecraft', 'nether', 'epic', N('molten block helm', 'erigan kubik dubulğa', 'расплавленный кубический шлем', 0), ['maroon/gold', 'black/orange']);
add('s', 'pixelboot', 'minecraft', 'nether', 'rare', N('molten boots', 'erigan etik', 'раскалённые ботинки', 3), ['maroon/orange', 'black/gold']);
add('o', 'diamond_armor', 'minecraft', 'diamond', 'legendary', N('gem-block armor', 'qimmatbaho kubik zirh', 'броня из кубических самоцветов', 1), ['sky/white/teal', 'mint/white/teal', 'lavender/white/purple']);
add('h', 'blockhelm', 'minecraft', 'diamond', 'legendary', N('gem-block helm', 'qimmatbaho kubik dubulğa', 'шлем из самоцветов', 0), ['sky/white', 'mint/white']);
add('b', 'cubepack', 'minecraft', 'diamond', 'epic', N('gem-block backpack', 'qimmatbaho kubik ryukzak', 'рюкзак из самоцветов', 0), ['sky/white', 'teal/white']);

/* ---------- 4. Fortnite style: battle-royale heroes ---------- */
add('o', 'hero_bolt', 'fortnite', 'warriors', 'rare', N('arena warrior suit', 'arena jangçisi kostyumi', 'костюм воина арены', 0), ['yellow/blue/navy', 'orange/sky/charcoal', 'pink/lime/purple']);
add('o', 'paladin', 'fortnite', 'warriors', 'epic', N('battle champion armor', 'jang çempioni zirhi', 'броня чемпиона битвы', 1), ['white/gold/silver', 'purple/gold/silver']);
add('o', 'neon_hero', 'fortnite', 'futuristic', 'epic', N('neon future hero suit', 'neon kelajak qahramoni kostyumi', 'костюм неонового героя будущего', 0), ['purple/sky/navy', 'pink/lime/charcoal', 'teal/yellow/navy', 'black/sky/charcoal']);
add('o', 'space_explorer', 'fortnite', 'astronauts', 'rare', N('orbit astronaut suit', 'orbita astronavt kostyumi', 'костюм астронавта', 0), ['white/orange', 'silver/blue', 'orange/white', 'white/pink']);
add('h', 'spacehelm', 'fortnite', 'astronauts', 'rare', N('orbit helmet', 'orbita dubulğasi', 'шлем астронавта', 0), ['white/orange', 'silver/sky']);
add('b', 'jetpack', 'fortnite', 'astronauts', 'epic', N('rocket pack', 'raketa ryukzagi', 'ракетный ранец', 0), ['silver/orange', 'white/sky']);
add('o', 'ninja', 'fortnite', 'ninjas', 'rare', N('shadow ninja outfit', 'soya nindzya kiyimi', 'костюм теневого ниндзя', 0), ['black/red', 'navy/silver', 'purple/pink']);
add('f', 'ninjamask', 'fortnite', 'ninjas', 'common', N('shadow mask', 'soya niqobi', 'маска тени', 1), ['black/red', 'purple/white', 'navy/silver']);
add('o', 'wizard_robe', 'fortnite', 'fantasy-heroes', 'rare', N('storm mage robe', 'dŏl sehrgari çoponi', 'мантия мага бури', 1), ['blue/sky', 'purple/gold']);
add('o', 'dragon_armor', 'fortnite', 'fantasy-heroes', 'epic', N('dragon rider armor', 'ajdaho chavandozi zirhi'.replace('chav', 'çav'), 'броня наездника дракона', 1), ['green/gold/charcoal', 'red/gold/black', 'blue/silver/navy']);
add('h', 'hornhelm', 'fortnite', 'fantasy-heroes', 'epic', N('horned champion helm', 'shoxli çempion dubulğasi'.replace('shox', 'şox'), 'рогатый шлем чемпиона', 0), ['silver/gold', 'gold/red']);

/* ---------- 5. PUBG style: military battle royale ---------- */
add('o', 'fatigues', 'pubg', 'military', 'common', N('field fatigues', 'dala harbiy kiyimi', 'полевая форма', 1), ['olive/khaki/olive', 'khaki/brown/olive', 'gray/black/charcoal']);
add('o', 'battle_royale', 'pubg', 'military', 'uncommon', N('last-squad combat gear', 'ŏyin jangçi kiyimi', 'боевая экипировка выжившего отряда', 2), ['olive/khaki/brown', 'khaki/olive/olive']);
add('h', 'milhelm', 'pubg', 'helmets', 'common', N('combat helmet lv.1', 'jang dubulğasi (1)', 'боевой шлем ур.1', 0), ['olive/khaki', 'gray/black']);
add('h', 'tachelm', 'pubg', 'helmets', 'rare', N('combat helmet lv.2', 'jang dubulğasi (2)', 'боевой шлем ур.2', 0), ['olive/orange', 'charcoal/lime']);
add('h', 'swathelm', 'pubg', 'helmets', 'epic', N('combat helmet lv.3', 'jang dubulğasi (3)', 'боевой шлем ур.3', 0), ['black/blue', 'olive/sky']);
add('h', 'boonie', 'pubg', 'helmets', 'common', N('field bucket hat', 'dala keng şlyapasi', 'полевая панама', 1), ['olive/black', 'khaki/brown']);
add('o', 'operator_gear', 'pubg', 'tactical', 'epic', N('heavy tactical kit', 'ogʻir taktik toʻplam'.replace('ogʻir', 'ŏğir').replace('toʻplam', 'tŏplam'), 'тяжёлое тактическое снаряжение', 2), ['olive/khaki/charcoal', 'charcoal/orange/black', 'gray/lime/charcoal']);
add('b', 'tacpack', 'pubg', 'tactical', 'uncommon', N('tactical backpack', 'taktik ryukzak', 'тактический рюкзак', 0), ['olive/red', 'khaki/black', 'gray/orange']);
add('s', 'combat', 'pubg', 'tactical', 'common', N('combat boots', 'jang etigi', 'боевые ботинки', 3), ['black/white', 'olive/khaki', 'brown/cream']);
add('f', 'balaclava', 'pubg', 'masks', 'common', N('field balaclava', 'dala niqobi', 'полевая балаклава', 1), ['olive/black', 'black/gray']);
add('f', 'skullmask', 'pubg', 'masks', 'rare', N('bone half-mask', 'suyak yarim niqobi', 'костяная маска', 1), ['white/gray', 'gray/black']);
add('f', 'gasmask', 'pubg', 'masks', 'epic', N('storm gas mask', 'dŏl gaz niqobi', 'противогаз для бури', 0), ['olive/gray', 'black/orange']);
add('o', 'onesie', 'pubg', 'costumes', 'rare', N('party-animal drop costume', 'hayvon kostyumi (tuşuv)'.replace('tuşuv', 'tuşiş'), 'костюм-кигуруми для высадки', 0), ['orange/cream', 'pink/white', 'gray/white']);
add('o', 'ghillie', 'pubg', 'costumes', 'epic', N('forest ghillie suit', 'ŏrmon kamuflyaj kostyumi', 'лесной камуфляж-леший', 0), ['olive/lime/olive', 'green/khaki/olive', 'brown/olive/khaki']);
add('h', 'ghilliehood', 'pubg', 'costumes', 'epic', N('ghillie hood', 'kamuflyaj kapyuşon', 'капюшон-леший', 0), ['olive/lime', 'green/khaki']);

/* ---------- 6. Roblox style: block-style outfits ---------- */
add('o', 'blocky_tee', 'roblox', 'blocky-outfits', 'common', N('block tee outfit', 'kubik futbolka kiyimi', 'комплект с блочной футболкой', 0), ['green/white/navy', 'red/yellow/navy', 'blue/white/charcoal', 'purple/lime/navy']);
add('o', 'block_hero', 'roblox', 'blocky-outfits', 'uncommon', N('block pixel outfit', 'kubik piksel kiyimi', 'пиксельный блочный костюм', 0), ['orange/yellow/brown', 'teal/white/navy', 'pink/white/purple']);
add('o', 'hiphop', 'roblox', 'blocky-outfits', 'uncommon', N('block street set', 'kubik kŏça kiyimi'.replace('kŏça', 'kŏça'), 'блочный уличный комплект', 0), ['black/gold/navy', 'orange/white/charcoal']);
add('h', 'blockhelm', 'roblox', 'roblox-accessories', 'common', N('block helmet', 'kubik dubulğa', 'блочный шлем', 0), ['red/gold', 'blue/white', 'green/yellow']);
add('h', 'bowler', 'roblox', 'roblox-accessories', 'common', N('block bowler hat', 'kubik buşlyapa'.replace('buş', 'boş'), 'блочный котелок', 0), ['black/red', 'brown/gold']);
add('b', 'cubepack', 'roblox', 'roblox-accessories', 'common', N('block backpack', 'kubik ryukzak', 'блочный рюкзак', 0), ['red/white', 'blue/yellow', 'purple/pink']);
add('f', 'pixelshades', 'roblox', 'roblox-accessories', 'common', N('pixel shades', 'piksel ŏynak', 'пиксельные очки', 3), ['black/white', 'blue/yellow', 'pink/white']);
add('g', 'blockhand', 'roblox', 'roblox-accessories', 'common', N('block gloves', 'kubik qŏlqoplar', 'блочные перчатки', 3), ['red/white', 'blue/yellow']);
add('o', 'wizard_robe', 'roblox', 'themed', 'rare', N('block wizard robe', 'kubik sehrgar çoponi', 'блочная мантия волшебника', 1), ['purple/gold', 'blue/silver']);
add('o', 'space_explorer', 'roblox', 'themed', 'rare', N('block astronaut suit', 'kubik astronavt kostyumi', 'блочный костюм астронавта', 0), ['white/orange', 'silver/blue']);
add('o', 'jersey_fb', 'roblox', 'themed', 'uncommon', N('block sports kit', 'kubik sport formasi', 'блочная спортивная форма', 1), ['red/white/black#7', 'blue/yellow/navy#1']);
add('o', 'ninja', 'roblox', 'themed', 'rare', N('block ninja suit', 'kubik nindzya kostyumi', 'блочный костюм ниндзя', 0), ['black/red', 'navy/white']);

/* ---------- 7. Valorant style: agents ---------- */
add('o', 'agent_coat', 'valorant', 'agents', 'epic', N('arc-agent coat', 'agent paltosi', 'пальто агента', 2), ['navy/pink/charcoal', 'black/lime/charcoal', 'purple/sky/black', 'charcoal/orange/black']);
add('o', 'scifi_suit', 'valorant', 'agents', 'rare', N('arc-agent bodysuit', 'agent kostyumi', 'комбинезон агента', 0), ['white/sky', 'navy/lime', 'silver/pink']);
add('o', 'cyber_jacket', 'valorant', 'tactical-wear', 'rare', N('tech tactical jacket', 'texnik taktik kurtka', 'тактическая техно-куртка', 1), ['black/lime/charcoal', 'purple/pink/charcoal', 'charcoal/sky/black']);
add('o', 'agent_suit', 'valorant', 'tactical-wear', 'uncommon', N('tactical agent set', 'taktik agent to‘plami'.replace('to‘p', 'tŏp'), 'тактический комплект агента', 0), ['navy/sky/charcoal', 'olive/yellow/charcoal']);
add('h', 'cloakhood', 'valorant', 'agents', 'rare', N('shadow agent hood', 'soya agent kapyuşoni', 'капюшон теневого агента', 0), ['black/lime', 'charcoal/pink', 'navy/sky']);
add('h', 'tachelm', 'valorant', 'tactical-wear', 'rare', N('tactical agent helmet', 'taktik agent dubulğasi', 'тактический шлем агента', 0), ['charcoal/orange', 'navy/lime']);
add('s', 'cyberboot', 'valorant', 'tactical-wear', 'rare', N('neon-sole boots', 'neon tagli etik', 'ботинки с неоновой подошвой', 3), ['black/lime', 'charcoal/pink', 'navy/sky']);
add('g', 'cyberglove', 'valorant', 'agent-accessories', 'rare', N('agent tech gloves', 'agent texnik qŏlqoplari', 'техно-перчатки агента', 3), ['black/lime', 'charcoal/pink']);
add('f', 'cybereyes', 'valorant', 'agent-accessories', 'epic', N('cyber-eye band', 'kiber kŏz bandi', 'кибер-повязка на глаза', 1), ['black/lime', 'charcoal/pink', 'navy/sky']);
add('f', 'tacvisor', 'valorant', 'agent-accessories', 'rare', N('tactical visor', 'taktik ŏynak', 'тактический визор', 0), ['black/sky', 'charcoal/orange']);

/* ---------- 8. Free Fire style: battle, futuristic, masks, streetwear ---------- */
add('o', 'battle_royale', 'freefire', 'battle', 'uncommon', N('survivor battle gear', 'omon qoluvçi jang kiyimi', 'боевая экипировка выжившего', 2), ['khaki/olive/brown', 'orange/black/charcoal', 'red/black/charcoal']);
add('o', 'survivor', 'freefire', 'battle', 'uncommon', N('survivor parka set', 'omon qoluvçi parka to‘plami'.replace('to‘p', 'tŏp'), 'парка выжившего', 1), ['olive/orange/khaki', 'gray/yellow/charcoal']);
add('b', 'parachute', 'freefire', 'battle', 'common', N('drop parachute pack', 'tuşiş parashyut ryukzagi'.replace('parashyut', 'paraşyut'), 'парашютный ранец', 0), ['red/white', 'blue/yellow', 'orange/black']);
add('o', 'mech_pilot', 'freefire', 'futuristic', 'rare', N('future pilot suit', 'kelajak uçuvçi kostyumi', 'костюм пилота будущего', 0), ['orange/white', 'navy/yellow', 'purple/lime']);
add('o', 'robot_armor', 'freefire', 'futuristic', 'epic', N('chrome robo armor', 'xrom robot zirhi', 'хромированная роботоброня', 1), ['silver/lime/charcoal', 'gold/sky/charcoal', 'black/pink/charcoal']);
add('h', 'visorhelm', 'freefire', 'futuristic', 'rare', N('future visor helmet', 'kelajak ŏynali dubulğa', 'шлем будущего с визором', 0), ['white/sky', 'silver/pink']);
add('f', 'ninjamask', 'freefire', 'masks', 'common', N('street mask', 'kŏça niqobi', 'уличная маска', 1), ['black/red', 'charcoal/lime', 'red/white']);
add('f', 'bandanaface', 'freefire', 'masks', 'common', N('bandana mask', 'bandana niqob', 'маска-бандана', 1), ['red/white', 'black/gray', 'blue/white']);
add('f', 'skullmask', 'freefire', 'masks', 'rare', N('skull mask', 'bosh suyak niqobi'.replace('bosh', 'boş'), 'маска-череп', 1), ['white/gray', 'charcoal/lime']);
add('f', 'gaiterface', 'freefire', 'masks', 'common', N('neck-gaiter mask', 'bŏyin yopqiç niqob', 'маска-бафф', 1), ['black/gray', 'orange/black']);
add('o', 'hiphop', 'freefire', 'streetwear', 'uncommon', N('street hoodie set', 'kŏça hudi to‘plami'.replace('to‘p', 'tŏp'), 'уличный комплект с худи', 0), ['black/gold/navy', 'orange/white/charcoal', 'purple/lime/navy']);
add('o', 'urban_bomber', 'freefire', 'streetwear', 'uncommon', N('street bomber set', 'kŏça bomberi', 'уличный бомбер', 0), ['olive/orange/charcoal', 'red/white/charcoal']);
add('s', 'highsneaker', 'freefire', 'streetwear', 'common', N('street sneakers', 'kŏça krossovkasi', 'уличные кроссовки', 3), ['black/lime', 'orange/white']);
add('n', 'chain', 'freefire', 'streetwear', 'rare', N('street chain', 'kŏça zanjiri', 'уличная цепь', 1), ['gold/gold', 'silver/silver']);

/* ---------- 9. Call of Duty style: operators ---------- */
add('o', 'fatigues', 'cod', 'soldiers', 'common', N('soldier fatigues', 'askar kiyimi', 'форма солдата', 1), ['olive/khaki/olive', 'khaki/brown/olive', 'gray/black/charcoal']);
add('h', 'milhelm', 'cod', 'soldiers', 'common', N('soldier helmet', 'askar dubulğasi', 'шлем солдата', 0), ['olive/khaki', 'khaki/brown']);
add('s', 'combat', 'cod', 'soldiers', 'common', N('soldier boots', 'askar etigi', 'ботинки солдата', 3), ['black/white', 'brown/cream']);
add('o', 'operator_gear', 'cod', 'operators', 'epic', N('special operator kit', 'maxsus operator kiyimi', 'экипировка оператора спецопераций', 2), ['black/gray/charcoal', 'olive/orange/charcoal', 'charcoal/lime/black']);
add('o', 'special_forces', 'cod', 'operators', 'epic', N('stealth operator armor', 'yaşirin operator zirhi', 'броня скрытного оператора', 1), ['charcoal/red/black', 'black/sky/charcoal']);
add('h', 'tachelm', 'cod', 'operators', 'rare', N('operator helmet', 'operator dubulğasi', 'шлем оператора', 0), ['black/orange', 'olive/lime']);
add('f', 'balaclava', 'cod', 'operators', 'common', N('operator balaclava', 'operator niqobi', 'балаклава оператора', 1), ['black/gray', 'olive/black']);
add('f', 'skullmask', 'cod', 'operators', 'epic', N('ghost half-mask', 'arvoh yarim niqobi', 'маска-призрак', 1), ['white/gray', 'gray/black']);
add('g', 'tacglove', 'cod', 'equipment', 'common', N('operator gloves', 'operator qŏlqoplari', 'перчатки оператора', 3), ['black/gray', 'olive/orange', 'charcoal/red']);
add('b', 'tacpack', 'cod', 'equipment', 'uncommon', N('field pack', 'dala ryukzagi', 'полевой рюкзак', 0), ['olive/red', 'black/orange', 'khaki/black']);
add('n', 'dogtag', 'cod', 'equipment', 'common', N('service tags', 'xizmat taqinçoqlari', 'армейские жетоны', 3), ['silver/black', 'gold/black']);
add('n', 'gaiter', 'cod', 'equipment', 'common', N('neck gaiter', 'bŏyin yopqiçi', 'бафф', 0), ['black/gray', 'olive/khaki']);

/* ---------- 10. Apex Legends style: sci-fi warriors ---------- */
add('o', 'hardsuit', 'apex', 'scifi-warriors', 'epic', N('legend hardsuit', 'afsona zirh kostyumi', 'хардсьют легенды', 0), ['orange/sky/charcoal', 'navy/lime/charcoal', 'charcoal/pink/black']);
add('o', 'scifi_suit', 'apex', 'scifi-warriors', 'rare', N('scout bodysuit', 'razvedçi kostyumi', 'костюм разведчика', 0), ['white/sky', 'silver/orange', 'black/lime']);
add('h', 'visorhelm', 'apex', 'scifi-warriors', 'rare', N('legend visor helmet', 'afsona ŏynali dubulğa', 'шлем легенды с визором', 0), ['orange/sky', 'navy/lime']);
add('o', 'robot_armor', 'apex', 'armor', 'epic', N('heavy sci-fi armor', 'ogʻir fantastik zirh'.replace('ogʻir', 'ŏğir'), 'тяжёлая фантастическая броня', 1), ['silver/orange/charcoal', 'gold/sky/charcoal', 'charcoal/lime/black']);
add('g', 'gauntlet', 'apex', 'armor', 'rare', N('power gauntlets', 'kuç qŏlqoplari'.replace('kuç', 'kuç'), 'силовые краги', 3), ['silver/orange', 'charcoal/lime']);
add('s', 'mechboot', 'apex', 'armor', 'rare', N('mech boots', 'mexanik etik', 'мехботинки', 3), ['charcoal/orange', 'silver/sky', 'navy/lime']);
add('o', 'stalker_suit', 'apex', 'legend-costumes', 'epic', N('stalker hunter suit', 'ovçi kostyumi'.replace('ovçi', 'ovçi'), 'костюм охотника-сталкера', 0), ['black/lime/charcoal', 'navy/pink/black', 'charcoal/orange/black']);
add('o', 'support_medic', 'apex', 'legend-costumes', 'rare', N('support medic suit', 'yordamçi shifokor kostyumi'.replace('shifokor', 'şifokor'), 'костюм медика поддержки', 0), ['white/green', 'sky/white', 'mint/navy']);
add('f', 'neonvisor', 'apex', 'legend-costumes', 'rare', N('legend neon visor', 'afsona neon ŏynagi', 'неоновый визор легенды', 0), ['black/lime', 'navy/pink', 'charcoal/sky']);
add('b', 'jetpack', 'apex', 'legend-costumes', 'epic', N('thrust pack', 'tortuvçi ryukzak'.replace('tortuvçi', 'tortuvçi'), 'реактивный ранец', 0), ['silver/orange', 'charcoal/lime']);

/* ---------- 11. Overwatch style: heroes ---------- */
add('o', 'hero_visor', 'overwatch', 'heroes', 'epic', N('visor hero suit', 'ŏynali qahramon kostyumi', 'костюм героя с визором', 0), ['white/sky/navy', 'orange/white/charcoal', 'purple/yellow/navy']);
add('o', 'hero_shield', 'overwatch', 'heroes', 'epic', N('guardian hero suit', 'qoravul qahramon kostyumi', 'костюм героя-защитника', 0), ['blue/gold/navy', 'navy/silver/charcoal']);
add('o', 'engineer', 'overwatch', 'heroes', 'rare', N('engineer hero overalls', 'muhandis qahramon kombinezoni', 'комбинезон героя-инженера', 0), ['yellow/orange/charcoal', 'orange/white/navy']);
add('h', 'aviator', 'overwatch', 'hero-accessories', 'uncommon', N('engineer goggle cap', 'muhandis ŏynakli qalpoq', 'шлем-очки инженера', 0), ['brown/silver', 'olive/orange']);
add('o', 'mech_pilot', 'overwatch', 'hero-suits', 'epic', N('mech hero suit', 'mex qahramon kostyumi', 'костюм героя-пилота', 0), ['white/pink/purple', 'orange/white/navy', 'teal/yellow/navy']);
add('o', 'hero_wing', 'overwatch', 'hero-suits', 'epic', N('winged hero suit', 'qanotli qahramon kostyumi', 'костюм героя с крыльями', 0), ['white/gold/navy', 'teal/white/navy']);
add('o', 'support_medic', 'overwatch', 'hero-suits', 'rare', N('field medic suit', 'dala şifokor kostyumi', 'костюм полевого медика', 0), ['white/green', 'sky/white']);
add('o', 'hero_flame', 'overwatch', 'hero-suits', 'legendary', N('flame hero suit', 'olov qahramon kostyumi', 'костюм героя-пламени', 0), ['orange/yellow/maroon', 'red/gold/black', 'purple/pink/navy']);
add('f', 'goggles', 'overwatch', 'hero-accessories', 'uncommon', N('hero goggles', 'qahramon ŏynagi', 'очки героя', 3), ['orange/white', 'teal/yellow', 'black/pink']);
add('b', 'cape', 'overwatch', 'hero-accessories', 'rare', N('hero cape', 'qahramon plaşi', 'плащ героя', 0), ['white/gold', 'blue/yellow', 'orange/black']);
add('g', 'cyberglove', 'overwatch', 'hero-accessories', 'rare', N('power gloves', 'kuç qŏlqoplari', 'силовые перчатки', 3), ['white/sky', 'orange/white']);

/* ---------- 12. League of Legends style: fantasy champions ---------- */
add('o', 'champion_plate', 'lol', 'champions', 'epic', N('champion plate armor', 'çempion zirhi', 'пластинчатая броня чемпиона', 1), ['silver/blue/charcoal', 'gold/red/brown', 'white/gold/silver']);
add('h', 'knighthelm', 'lol', 'champions', 'rare', N('champion helm', 'çempion dubulğasi', 'шлем чемпиона', 0), ['silver/blue', 'gold/red']);
add('b', 'longcape', 'lol', 'champions', 'rare', N('champion cape', 'çempion plaşi', 'плащ чемпиона', 0), ['blue/gold', 'red/gold']);
add('o', 'arcane_robe', 'lol', 'mages', 'epic', N('arcane mage robe', 'sehrli sehrgar çoponi', 'мантия мага тайных искусств', 1), ['purple/sky/navy', 'navy/gold/purple', 'teal/white/navy']);
add('h', 'wizard', 'lol', 'mages', 'rare', N('arcane mage hat', 'sehrli sehrgar şlyapasi', 'шляпа мага', 1), ['purple/gold', 'navy/silver']);
add('n', 'amulet', 'lol', 'mages', 'rare', N('arcane amulet', 'sehrli tumor', 'амулет тайных искусств', 0), ['purple/yellow', 'teal/white']);
add('o', 'blade_assassin', 'lol', 'warriors', 'rare', N('blade dancer outfit', 'qiliç raqqosi kiyimi', 'наряд танцора клинков', 0), ['black/red/charcoal', 'charcoal/silver/black', 'purple/pink/black']);
add('o', 'jungle_hunter', 'lol', 'warriors', 'uncommon', N('wild hunter outfit', 'yovvoyi ovçi kiyimi', 'наряд дикого охотника', 0), ['green/gold/brown', 'olive/orange/brown']);
add('o', 'warlord', 'lol', 'warriors', 'epic', N('war-chief armor', 'uruş yŏlboşçisi zirhi'.replace('yŏlboşçisi', 'sarkardasi'), 'броня вождя войны', 1), ['red/gold/charcoal', 'blue/silver/charcoal']);
add('g', 'gauntlet', 'lol', 'warriors', 'rare', N('champion gauntlets', 'çempion qŏlqoplari', 'краги чемпиона', 3), ['silver/gold', 'gold/red']);

/* ---------- 13. Dota 2 style: heroes, armor, robes ---------- */
add('o', 'warlord', 'dota2', 'heroes', 'epic', N('hero warlord armor', 'qahramon sarkarda zirhi', 'броня героя-полководца', 1), ['red/gold/charcoal', 'green/gold/charcoal', 'purple/silver/charcoal']);
add('o', 'jungle_hunter', 'dota2', 'heroes', 'rare', N('forest ranger outfit', 'ŏrmon kamonçisi kiyimi', 'наряд лесного рейнджера', 0), ['green/gold/brown', 'teal/silver/olive']);
add('h', 'hornhelm', 'dota2', 'armor', 'epic', N('horned war helm', 'shoxli jang dubulğasi'.replace('shox', 'şox'), 'рогатый боевой шлем', 0), ['silver/gold', 'gold/red', 'charcoal/orange']);
add('o', 'knight_armor', 'dota2', 'armor', 'epic', N('heavy plate armor', 'ogʻir zirh'.replace('ogʻir', 'ŏğir'), 'тяжёлая латная броня', 1), ['silver/red/charcoal', 'gold/blue/brown']);
add('g', 'gauntlet', 'dota2', 'armor', 'rare', N('war gauntlets', 'jang qŏlqoplari', 'боевые краги', 3), ['gold/red', 'silver/blue']);
add('o', 'mystic_robe', 'dota2', 'robes', 'epic', N('mystic robe', 'sirli çopon', 'таинственная мантия', 1), ['purple/gold', 'navy/sky', 'maroon/gold', 'teal/white']);
add('h', 'cloakhood', 'dota2', 'robes', 'rare', N('mystic hood', 'sirli kapyuşon', 'таинственный капюшон', 0), ['purple/gold', 'navy/silver']);
add('b', 'longcape', 'dota2', 'robes', 'rare', N('hero mantle', 'qahramon plaşi', 'мантия героя', 1), ['maroon/gold', 'navy/silver']);
add('n', 'amulet', 'dota2', 'magic-accessories', 'rare', N('mana amulet', 'mana tumori', 'амулет маны', 0), ['sky/white', 'purple/yellow']);
add('h', 'halo', 'dota2', 'magic-accessories', 'epic', N('radiant halo', 'nurli halqa', 'сияющий нимб', 0), ['gold/white']);
add('b', 'fairycape', 'dota2', 'magic-accessories', 'epic', N('spirit veil', 'ruh pardasi', 'вуаль духов', 1), ['sky/white', 'pink/white']);

/* ---------- 14. Terraria style: armor sets, fantasy costumes, adventure ---------- */
add('o', 'pixel_armor', 'terraria', 'armor-sets', 'common', N('copper-style armor set', 'mis zirh to‘plami'.replace('to‘p', 'tŏp'), 'набор медной брони', 0), ['orange/brown/maroon', 'coral/cream/brown']);
add('o', 'pixel_armor', 'terraria', 'armor-sets', 'uncommon', N('iron-style armor set', 'temir zirh to‘plami'.replace('to‘p', 'tŏp'), 'набор железной брони', 0), ['silver/gray/charcoal', 'gray/white/charcoal']);
add('o', 'pixel_armor', 'terraria', 'armor-sets', 'rare', N('gold-style armor set', 'oltin zirh to‘plami'.replace('to‘p', 'tŏp'), 'набор золотой брони', 0), ['gold/yellow/brown', 'yellow/white/brown']);
add('o', 'molten_armor', 'terraria', 'armor-sets', 'epic', N('molten-style armor set', 'erigan zirh to‘plami'.replace('to‘p', 'tŏp'), 'набор расплавленной брони', 0), ['maroon/orange/charcoal', 'black/orange/maroon']);
add('o', 'jungle_armor', 'terraria', 'armor-sets', 'epic', N('jungle-style armor set', 'jungli zirh to‘plami'.replace('to‘p', 'tŏp'), 'набор брони джунглей', 0), ['green/lime/olive', 'teal/mint/olive']);
add('h', 'blockhelm', 'terraria', 'armor-sets', 'uncommon', N('pixel armor helm', 'piksel zirh dubulğasi', 'пиксельный шлем', 0), ['orange/brown', 'silver/gray', 'gold/yellow']);
add('s', 'pixelboot', 'terraria', 'armor-sets', 'common', N('pixel armor boots', 'piksel zirh etigi', 'пиксельные ботинки', 3), ['orange/brown', 'silver/gray', 'gold/yellow']);
add('o', 'arcane_robe', 'terraria', 'fantasy-costumes', 'epic', N('ancient mage robes', 'qadimgi sehrgar çoponi', 'древние одеяния мага', 2), ['purple/gold/navy', 'teal/yellow/navy']);
add('o', 'fairy_dress', 'terraria', 'fantasy-costumes', 'rare', N('forest fairy dress', 'ŏrmon parisi libosi', 'платье лесной феи', 2), ['mint/white', 'pink/lavender']);
add('h', 'wizard', 'terraria', 'fantasy-costumes', 'rare', N('starlight hat', 'yulduz nuri şlyapasi', 'шляпа звёздного света', 1), ['blue/gold', 'purple/silver']);
add('o', 'adventurer_tunic', 'terraria', 'adventure', 'common', N('adventurer tunic', 'sarguzaşt kŏylagi', 'туника искателя приключений', 1), ['green/gold/brown', 'blue/cream/brown', 'red/cream/brown']);
add('h', 'miner', 'terraria', 'adventure', 'common', N('miner lamp cap', 'konçi chiroq qalpoği'.replace('konçi chiroq', 'konçi çiroq'), 'шахтёрская каска с лампой', 1), ['yellow/gray', 'orange/gray']);
add('b', 'satchel', 'terraria', 'adventure', 'common', N('adventure satchel', 'sarguzaşt sumkasi', 'сумка искателя', 1), ['brown/gold', 'green/yellow']);
add('s', 'hiking', 'terraria', 'adventure', 'common', N('explorer boots', 'tadqiqotçi etigi', 'ботинки исследователя', 3), ['brown/orange', 'olive/yellow']);

/* ---------- 15. Among Us style: crew suits, hats, funny accessories ---------- */
add('o', 'crew_capsule', 'amongus', 'crew-suits', 'common', N('space crew capsule suit', 'koinot ekipaji kapsula kostyumi', 'капсульный костюм космической команды', 0), ['red/white', 'blue/white', 'green/white', 'yellow/white', 'pink/white', 'purple/white', 'orange/white', 'teal/white', 'black/gray', 'brown/cream']);
add('h', 'visorhelm', 'amongus', 'crew-hats', 'common', N('crew visor helmet', 'ekipaj ŏynali dubulğasi', 'шлем с визором экипажа', 0), ['red/sky', 'blue/sky', 'green/sky', 'yellow/sky', 'pink/sky', 'orange/sky']);
add('h', 'plantpot', 'amongus', 'crew-hats', 'common', N('tiny plant hat', 'kichik ŏsimlik şlyapasi'.replace('kichik', 'kiçik'), 'шляпа-горшок с ростком', 1), ['orange/green']);
add('h', 'pancakes', 'amongus', 'funny-accessories', 'uncommon', N('pancake stack hat', 'blin uyumi şlyapasi', 'шляпа из блинов', 1), ['yellow/brown']);
add('h', 'cheese', 'amongus', 'funny-accessories', 'common', N('cheese wedge hat', 'pişloq şlyapasi', 'шляпа-сыр', 1), ['yellow/gold']);
add('h', 'cone', 'amongus', 'funny-accessories', 'common', N('traffic cone hat', 'yŏl konusi şlyapasi', 'шляпа-конус', 1), ['orange/white']);
add('h', 'bucket', 'amongus', 'funny-accessories', 'common', N('bucket hat', 'chelak şlyapa'.replace('chelak', 'çelak'), 'шляпа-ведро', 1), ['gray/blue', 'blue/white', 'red/white']);
add('h', 'banana', 'amongus', 'funny-accessories', 'uncommon', N('banana peel hat', 'banan şlyapasi', 'шляпа-банан', 1), ['yellow/brown']);
add('h', 'eggshell', 'amongus', 'funny-accessories', 'uncommon', N('egg shell hat', 'tuxum qobig‘i şlyapasi'.replace('qobig‘i', 'qobiği'), 'шляпа-скорлупа', 1), ['cream/white']);
add('h', 'bowler', 'amongus', 'crew-hats', 'common', N('tiny bowler hat', 'kichik buşlyapa'.replace('kichik', 'kiçik').replace('buş', 'boş'), 'маленький котелок', 0), ['black/red', 'brown/gold']);
add('h', 'cactus', 'amongus', 'funny-accessories', 'rare', N('cactus hat', 'kaktus şlyapasi', 'шляпа-кактус', 1), ['green/pink']);
add('h', 'crown', 'amongus', 'crew-hats', 'epic', N('mini crown', 'mini toj', 'мини-корона', 1), ['gold/red', 'gold/sky']);
add('b', 'crewpack', 'amongus', 'funny-accessories', 'common', N('mini crew sack', 'mini ekipaj xaltasi', 'мини-мешок экипажа', 0), ['red/white', 'blue/white', 'green/white', 'pink/white']);
add('n', 'stripescarf', 'amongus', 'funny-accessories', 'common', N('striped scarf', 'çiziqli şarf', 'полосатый шарф', 0), ['red/white', 'blue/yellow']);
add('f', 'pixelshades', 'amongus', 'funny-accessories', 'common', N('funny shades', 'kulgili ŏynak', 'смешные очки', 3), ['black/white', 'pink/white', 'blue/yellow']);

/* ---------- mythic flagship skins: one rarest outfit per game ---------- */
add('o', 'special_forces', 'cs16', 'sas', 'mythic', N('golden elite assault suit', 'oltin elita hujum kostyumi', 'золотой элитный штурмовой костюм', 0), ['gold/black/charcoal']);
add('o', 'operator_gear', 'cs2', 'special-forces', 'mythic', N('mythic shadow operator kit', 'afsonaviy soya operator kiyimi', 'мифический комплект теневого оператора', 0), ['black/gold/charcoal']);
add('o', 'diamond_armor', 'minecraft', 'diamond', 'mythic', N('rainbow gem-block armor', 'kamalak qimmatbaho kubik zirh', 'радужная броня из самоцветов', 1), ['pink/sky/purple']);
add('o', 'dragon_armor', 'fortnite', 'fantasy-heroes', 'mythic', N('storm dragon lord armor', 'dŏl ajdaho hukmdori zirhi', 'броня повелителя штормового дракона', 1), ['purple/gold/black']);
add('o', 'ghillie', 'pubg', 'costumes', 'mythic', N('golden forest spirit suit', 'oltin ŏrmon ruhi kostyumi', 'золотой костюм лесного духа', 0), ['gold/lime/olive']);
add('o', 'neon_hero', 'roblox', 'themed', 'mythic', N('rainbow neon block hero suit', 'kamalak neon kubik qahramon kostyumi', 'радужный неоновый блочный костюм', 0), ['pink/yellow/purple']);
add('o', 'agent_coat', 'valorant', 'agents', 'mythic', N('prism agent coat', 'prizma agent paltosi', 'призматическое пальто агента', 2), ['lavender/pink/purple']);
add('o', 'robot_armor', 'freefire', 'futuristic', 'mythic', N('gold chrome robo armor', 'oltin xrom robot zirhi', 'золотая хромированная роботоброня', 1), ['gold/pink/black']);
add('o', 'operator_gear', 'cod', 'operators', 'mythic', N('ghost-white elite kit', 'oq arvoh elita kiyimi', 'белый элитный комплект-призрак', 2), ['white/sky/gray']);
add('o', 'hardsuit', 'apex', 'armor', 'mythic', N('star-forged hardsuit', 'yulduz zarbli zirh kostyumi', 'хардсьют звёздной ковки', 0), ['gold/sky/black']);
add('o', 'hero_flame', 'overwatch', 'hero-suits', 'mythic', N('firebird hero suit', 'olov qaşqasi qahramon kostyumi'.replace('qaşqasi', 'quşi'), 'костюм героя огненной птицы', 0), ['red/gold/orange']);
add('o', 'champion_plate', 'lol', 'champions', 'mythic', N('celestial champion armor', 'samoviy çempion zirhi', 'небесная броня чемпиона', 1), ['white/gold/sky']);
add('o', 'mystic_robe', 'dota2', 'robes', 'mythic', N('immortal mystic robe', 'oʻlmas sirli çopon'.replace('oʻlmas', 'ŏlmas'), 'бессмертная таинственная мантия', 1), ['gold/purple/black']);
add('o', 'molten_armor', 'terraria', 'armor-sets', 'mythic', N('solar-forged armor set', 'quyoş zarbli zirh to‘plami'.replace('quyoş', 'quyoş').replace('to‘p', 'tŏp'), 'набор солнечной брони', 0), ['gold/orange/maroon']);
add('o', 'crew_capsule', 'amongus', 'crew-suits', 'mythic', N('golden crew capsule suit', 'oltin ekipaj kapsula kostyumi', 'золотой капсульный костюм', 0), ['gold/white']);

module.exports = { GAME_ITEMS: items };
