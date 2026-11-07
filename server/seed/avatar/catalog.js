/* The first Avatar Shop catalogue: original drawings described by parameters (kind + colours + pattern), names in uz / ru / en.
   Administrators can add, change, disable and price items afterwards. Prices are LEXIO TOKENS. */
const { KIND_SLOT } = require('../../lib/avatar-spec');

const COLORS = {
  red: ['#e63946', 'Red', 'Qizil', ['красный', 'красная', 'красное', 'красные']], blue: ['#2f7bff', 'Blue', 'Kŏk', ['синий', 'синяя', 'синее', 'синие']], green: ['#2fb36d', 'Green', 'Yaşil', ['зелёный', 'зелёная', 'зелёное', 'зелёные']],
  yellow: ['#ffc83d', 'Yellow', 'Sariq', ['жёлтый', 'жёлтая', 'жёлтое', 'жёлтые']], pink: ['#ff7ab8', 'Pink', 'Puşti', ['розовый', 'розовая', 'розовое', 'розовые']], purple: ['#8e5bd9', 'Purple', 'Binafşa', ['фиолетовый', 'фиолетовая', 'фиолетовое', 'фиолетовые']],
  orange: ['#ff8a1f', 'Orange', 'Zarğaldoq', ['оранжевый', 'оранжевая', 'оранжевое', 'оранжевые']], black: ['#2b2b3a', 'Black', 'Qora', ['чёрный', 'чёрная', 'чёрное', 'чёрные']], white: ['#f4f4f8', 'White', 'Oq', ['белый', 'белая', 'белое', 'белые']],
  brown: ['#8b5a2b', 'Brown', 'Jigarrang', ['коричневый', 'коричневая', 'коричневое', 'коричневые']], teal: ['#16b8a6', 'Teal', 'Firuza', ['бирюзовый', 'бирюзовая', 'бирюзовое', 'бирюзовые']], gray: ['#9aa3b2', 'Gray', 'Kulrang', ['серый', 'серая', 'серое', 'серые']],
  gold: ['#f2b705', 'Golden', 'Oltin', ['золотой', 'золотая', 'золотое', 'золотые']],
};
/* kind → [English, Uzbek, Russian noun, gender: 0 m, 1 f, 2 n, 3 plural] */
const KINDS = {
  tee: ['T-shirt', 'Futbolka', 'футболка', 1], hoodie: ['Hoodie', 'Hudi', 'худи', 2], jacket: ['Jacket', 'Kurtka', 'куртка', 1], shirt: ['Shirt', 'Kŏylak', 'рубашка', 1], pants: ['Pants', 'Şim', 'штаны', 3], shorts: ['Shorts', 'Şortik', 'шорты', 3],
  dress: ['Dress', 'Libos', 'платье', 2], shoes: ['Sneakers', 'Krossovka', 'кроссовки', 3], glasses: ['Glasses', 'Kŏzoynak', 'очки', 3], sunglasses: ['Sunglasses', 'Quyoş kŏzoynagi', 'солнечные очки', 3], hat: ['Hat', 'Şlyapa', 'шляпа', 1],
  cap: ['Cap', 'Beysbolka', 'кепка', 1], headphones: ['Headphones', 'Quloqçin', 'наушники', 3], backpack: ['Backpack', 'Ryukzak', 'рюкзак', 0], watch: ['Watch', 'Soat', 'часы', 3], necklace: ['Necklace', 'Marjon', 'ожерелье', 2],
  wings: ['Wings', 'Qanotlar', 'крылья', 3], mask: ['Mask', 'Niqob', 'маска', 1], cat: ['Cat', 'Muşuk', 'кошка', 1], dog: ['Dog', 'It', 'собака', 1], rabbit: ['Rabbit', 'Quyon', 'кролик', 0], fox: ['Fox', 'Tulki', 'лиса', 1],
  dragon: ['Dragon', 'Ajdaho', 'дракон', 0], bird: ['Bird', 'Quş', 'птица', 1], dino: ['Dinosaur', 'Dinozavr', 'динозавр', 0], fantasy: ['Unicorn', 'Yakkaşox', 'единорог', 0],
};
const PATTERN = { stripes: ['with stripes', 'çiziqli', 'в полоску'], dots: ['with dots', 'nuqtali', 'в горошек'], solid: null };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const PRICE = { common: 40, uncommon: 90, rare: 180, epic: 420, legendary: 950 };

const items = [];
function add(slug, names, kind, rarity, art, extra = {}) { items.push({ slug, en: names[0], uz: names[1], ru: names[2], kind, rarity, art, price: extra.price ?? PRICE[rarity] + (extra.bump || 0), earn: extra.earn || '', starter: extra.starter ? 1 : 0 }); }
/* a coloured copy of a basic kind */
function colored(kind, list) {
  const [en, uz, ru, g] = KINDS[kind];
  for (const [color, rarity, pattern = 'solid', c2key] of list) {
    const [hex, cen, cuz, cru] = COLORS[color], pat = PATTERN[pattern], c2 = c2key ? COLORS[c2key][0] : '#ffffff';
    add(`${kind}-${color}${pattern !== 'solid' ? '-' + pattern : ''}`, [
      `${cen} ${en}${pat ? ' ' + pat[0] : ''}`, `${pat ? cap(pat[1]) + ' ' + cuz.toLowerCase() : cuz} ${uz.toLowerCase()}`.replace(/^./, (x) => x.toUpperCase()), `${cap(cru[g])} ${ru}${pat ? ' ' + pat[2] : ''}`],
      kind, rarity, { c: hex, c2, p: pattern });
  }
}
/* starter items: every account owns them */
add('starter-tee', ['White T-shirt', 'Oq futbolka', 'Белая футболка'], 'tee', 'common', { c: '#f4f4f8', c2: '#ffffff', p: 'solid' }, { starter: true, price: 0 });
add('starter-jeans', ['Blue jeans', 'Kŏk jinsi', 'Синие джинсы'], 'pants', 'common', { c: '#3d6bb3', c2: '#2a4f8f', p: 'solid' }, { starter: true, price: 0 });
add('starter-sneakers', ['White sneakers', 'Oq krossovka', 'Белые кроссовки'], 'shoes', 'common', { c: '#f4f4f8', c2: '#e63946', p: 'solid' }, { starter: true, price: 0 });

colored('tee', [['red', 'common'], ['blue', 'common'], ['green', 'common'], ['yellow', 'common'], ['pink', 'uncommon', 'dots'], ['blue', 'uncommon', 'stripes', 'white']]);
colored('hoodie', [['gray', 'common'], ['purple', 'uncommon'], ['red', 'uncommon'], ['teal', 'rare', 'stripes', 'white']]);
colored('jacket', [['brown', 'uncommon'], ['black', 'uncommon'], ['blue', 'rare'], ['red', 'rare', 'stripes', 'white']]);
colored('shirt', [['white', 'common'], ['blue', 'common', 'check'.replace('check', 'stripes'), 'white'], ['pink', 'common'], ['green', 'uncommon', 'dots']]);
colored('pants', [['black', 'common'], ['brown', 'common'], ['green', 'uncommon'], ['purple', 'uncommon']]);
colored('shorts', [['blue', 'common'], ['orange', 'common'], ['teal', 'uncommon', 'stripes', 'white']]);
colored('dress', [['pink', 'common'], ['purple', 'uncommon'], ['red', 'uncommon', 'dots'], ['teal', 'rare', 'stripes', 'white']]);
colored('shoes', [['black', 'common'], ['red', 'common'], ['blue', 'uncommon'], ['gold', 'epic'], ['green', 'uncommon']]);
const costumes = [['astronaut', ['Astronaut suit', 'Astronavt kostyumi', 'Костюм космонавта'], 'rare', '#e8ecf5', '#2f7bff'], ['knight', ['Knight armor', 'Ritsar sovuti', 'Рыцарские доспехи'], 'epic', '#9aa3b2', '#e63946'], ['wizard', ['Wizard robe', 'Sehrgar çoponi', 'Мантия волшебника'], 'epic', '#6a3fc4', '#f2b705'],
  ['pirate', ['Pirate outfit', 'Qarŏqçi kiyimi', 'Костюм пирата'], 'rare', '#2b2b3a', '#e63946'], ['chef', ['Chef uniform', 'Oşpaz kiyimi', 'Форма повара'], 'uncommon', '#f4f4f8', '#2b2b3a'], ['hero', ['Superhero suit', 'Superqahramon kostyumi', 'Костюм супергероя'], 'legendary', '#e63946', '#2f7bff']];
for (const [v, names, rarity, c, c2] of costumes) add(`costume-${v}`, names, 'costume', rarity, { c, c2, v });
const seasons = [['winter', ['Winter outfit', 'Qişki kiyim', 'Зимний наряд'], '#2f7bff', '#f4f4f8'], ['summer', ['Summer outfit', 'Yozgi kiyim', 'Летний наряд'], '#ffc83d', '#ff7ab8'], ['spring', ['Spring outfit', 'Bahorgi kiyim', 'Весенний наряд'], '#2fb36d', '#ff7ab8'], ['autumn', ['Autumn outfit', 'Kuzgi kiyim', 'Осенний наряд'], '#ff8a1f', '#8b5a2b']];
for (const [v, names, c, c2] of seasons) add(`seasonal-${v}`, names, 'seasonal', 'uncommon', { c, c2, v }, { bump: 30 });

colored('glasses', [['black', 'common'], ['red', 'common'], ['teal', 'uncommon']]);
colored('sunglasses', [['black', 'uncommon'], ['pink', 'uncommon'], ['gold', 'rare']]);
colored('hat', [['red', 'common'], ['purple', 'uncommon'], ['black', 'uncommon'], ['gold', 'epic']]);
colored('cap', [['blue', 'common'], ['red', 'common'], ['green', 'uncommon']]);
colored('headphones', [['black', 'uncommon'], ['pink', 'uncommon'], ['blue', 'rare']]);
colored('backpack', [['red', 'common'], ['blue', 'common'], ['purple', 'uncommon']]);
colored('watch', [['black', 'common'], ['gold', 'rare'], ['teal', 'uncommon']]);
colored('necklace', [['gold', 'rare'], ['pink', 'common'], ['teal', 'uncommon']]);
colored('wings', [['white', 'epic'], ['purple', 'epic'], ['red', 'rare']]);
colored('mask', [['black', 'uncommon'], ['white', 'common'], ['gold', 'epic']]);

colored('cat', [['orange', 'common'], ['gray', 'common'], ['black', 'uncommon']]);
colored('dog', [['brown', 'common'], ['white', 'common'], ['gold', 'uncommon']]);
colored('rabbit', [['white', 'common'], ['pink', 'uncommon']]);
colored('fox', [['orange', 'uncommon'], ['white', 'rare']]);
colored('dragon', [['green', 'epic'], ['red', 'epic']]);
colored('bird', [['blue', 'common'], ['yellow', 'common']]);
colored('dino', [['green', 'rare'], ['teal', 'rare']]);
colored('fantasy', [['pink', 'epic'], ['purple', 'epic']]);
/* pets that are earned by learning (not for sale) */
add('pet-fox-ember', ['Ember Fox', 'Olovli tulki', 'Огненная лиса'], 'fox', 'rare', { c: '#e8591a', c2: '#ffd23f', p: 'solid' }, { earn: 'lessons:25', price: 0 });
add('pet-bird-sky', ['Sky Bird', 'Osmon quşi', 'Небесная птица'], 'bird', 'rare', { c: '#5ec8ff', c2: '#ffffff', p: 'solid' }, { earn: 'words:100', price: 0 });
add('pet-dino-frost', ['Frost Dino', 'Muzli dinozavr', 'Ледяной динозавр'], 'dino', 'epic', { c: '#9fd8ff', c2: '#ffffff', p: 'solid' }, { earn: 'streak:14', price: 0 });
add('pet-dragon-golden', ['Golden Dragon', 'Oltin ajdaho', 'Золотой дракон'], 'dragon', 'legendary', { c: '#f2b705', c2: '#ff8a1f', p: 'solid' }, { earn: 'levels:1', price: 0 });
add('pet-unicorn-rainbow', ['Rainbow Unicorn', 'Kamalak yakkaşoxi', 'Радужный единорог'], 'fantasy', 'legendary', { c: '#ffffff', c2: '#ff7ab8', p: 'solid', v: 'rainbow' }, { earn: 'xp:3000', price: 0 });

for (const [v, names, rarity] of [['bounce', ['Bounce', 'Sakraş', 'Прыжки'], 'uncommon'], ['wave', ['Friendly wave', 'Salom berişi', 'Дружеское приветствие'], 'uncommon'], ['dance', ['Happy dance', 'Xursand raqs', 'Весёлый танец'], 'rare'], ['float', ['Floating', 'Suzişi', 'Парение'], 'rare']]) add(`animation-${v}`, names, 'animation', rarity, { v });
for (const [v, names, rarity, c, c2] of [['meadow', ['Green meadow', 'Yaşil çayır', 'Зелёный луг'], 'common', '#9be3a1', '#d7f7c4'], ['beach', ['Sunny beach', 'Quyoşli plyaj', 'Солнечный пляж'], 'uncommon', '#7fe0e8', '#ffe9a8'], ['space', ['Outer space', 'Koinot', 'Космос'], 'rare', '#1d1b4b', '#5a3d9e'],
  ['city', ['Night city', 'Tungi şahar', 'Ночной город'], 'rare', '#2a2d6b', '#ff7ab8'], ['candy', ['Candy land', 'Konfet dunyosi', 'Конфетная страна'], 'epic', '#ffc2e2', '#d9f3ff'], ['castle', ['Castle hill', 'Qasr tepaligi', 'Холм с замком'], 'epic', '#a5d8ff', '#c9efc0'],
  ['sunset', ['Sunset', 'Quyoş botişi', 'Закат'], 'uncommon', '#ff9a6b', '#ffd86b'], ['forest', ['Magic forest', 'Sehrli ŏrmon', 'Волшебный лес'], 'legendary', '#3a2f8a', '#6bd68f']]) add(`background-${v}`, names, 'background', rarity, { c, c2, v });
for (const [v, names, rarity, c] of [['sparkles', ['Sparkles', 'Yulduzçalar', 'Искры'], 'uncommon', '#ffd23f'], ['hearts', ['Floating hearts', 'Uçuvçi yuraklar', 'Летящие сердечки'], 'rare', '#ff5fa2'], ['flames', ['Fire aura', 'Alanga halqasi', 'Огненная аура'], 'epic', '#ff6a2b'], ['snow', ['Snowfall', 'Qor yoğişi', 'Снегопад'], 'rare', '#d9f3ff'], ['bubbles', ['Bubbles', 'Pufakçalar', 'Пузыри'], 'uncommon', '#7fd8ff']]) add(`effect-${v}`, names, 'effect', rarity, { c, v });
for (const [v, names, rarity, c, c2] of [['gold', ['Golden style', 'Oltin uslub', 'Золотой стиль'], 'legendary', '#f2b705', '#fff1a8'], ['ghost', ['Ghost style', 'Arvoh uslubi', 'Стиль призрака'], 'epic', '#cfe8ff', '#ffffff'], ['neon', ['Neon style', 'Neon uslub', 'Неоновый стиль'], 'epic', '#5ef2ff', '#ff5fa2']]) add(`style-${v}`, names, 'style', rarity, { c, c2, v });
for (const [v, names, rarity, c, c2] of [['trophy', ['Golden trophy', 'Oltin kubok', 'Золотой кубок'], 'rare', '#f2b705', '#ffe28a'], ['gem', ['Rare gem', 'Nodir qimmatbaho toş', 'Редкий самоцвет'], 'epic', '#5ef2ff', '#2f7bff'], ['star', ['Star of fame', 'Şuhrat yulduzi', 'Звезда славы'], 'epic', '#ffd23f', '#ff8a1f'], ['key', ['Golden key', 'Oltin kalit', 'Золотой ключ'], 'legendary', '#f2b705', '#e63946']]) add(`collectible-${v}`, names, 'collectible', rarity, { c, c2, v });

for (const it of items) it.slot = KIND_SLOT[it.kind];
module.exports = { ITEMS: items };
