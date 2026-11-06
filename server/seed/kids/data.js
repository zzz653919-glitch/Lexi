/* LEXIO KIDS content. One group per category; one line per picture card:  en | uz | ru | picture | extra
   Uzbek is written in the new alphabet (Ŏ ŏ Ğ ğ Ş ş Ç ç). The picture is an emoji (several emoji = a counted row), or "#rrggbb" for a colour swatch.
   extra: letters → the example word, numbers → the digit.  Administrators can replace every picture with an uploaded image and add audio. */
const CATEGORIES = [
  { slug: 'alphabet', emoji: '🔤', color: '#ffb703', kind: 'letters', en: 'Alphabet', uz: 'Alifbo', ru: 'Алфавит', words: `
A | olma | яблоко | 🍎 | Apple
B | tŏp | мяч | ⚽ | Ball
C | muşuk | кошка | 🐱 | Cat
D | it | собака | 🐶 | Dog
E | fil | слон | 🐘 | Elephant
F | baliq | рыба | 🐟 | Fish
G | uzum | виноград | 🍇 | Grapes
H | uy | дом | 🏠 | House
I | muzqaymoq | мороженое | 🍦 | Ice cream
J | şarbat | сок | 🧃 | Juice
K | kalit | ключ | 🔑 | Key
L | şer | лев | 🦁 | Lion
M | oy | луна | 🌙 | Moon
N | burun | нос | 👃 | Nose
O | apelsin | апельсин | 🍊 | Orange
P | pitsa | пицца | 🍕 | Pizza
Q | malika | королева | 👸 | Queen
R | quyon | кролик | 🐰 | Rabbit
S | quyoş | солнце | ☀️ | Sun
T | daraxt | дерево | 🌳 | Tree
U | soyabon | зонт | ☂️ | Umbrella
V | skripka | скрипка | 🎻 | Violin
W | tarvuz | арбуз | 🍉 | Watermelon
X | quti | коробка | 📦 | Box
Y | yaxta | яхта | ⛵ | Yacht
Z | zebra | зебра | 🦓 | Zebra` },
  { slug: 'animals', emoji: '🦁', color: '#fb8500', kind: 'words', en: 'Animals', uz: 'Hayvonlar', ru: 'Животные', words: `
Cat | muşuk | кошка | 🐱
Dog | it | собака | 🐶
Lion | şer | лев | 🦁
Elephant | fil | слон | 🐘
Rabbit | quyon | кролик | 🐰
Monkey | maymun | обезьяна | 🐵
Bear | ayiq | медведь | 🐻
Horse | ot | лошадь | 🐴
Cow | sigir | корова | 🐮
Duck | ŏrdak | утка | 🦆
Fish | baliq | рыба | 🐟
Tiger | yŏlbars | тигр | 🐯` },
  { slug: 'colors', emoji: '🎨', color: '#ff6fb5', kind: 'words', en: 'Colors', uz: 'Ranglar', ru: 'Цвета', words: `
Red | qizil | красный | #ef4444
Blue | kŏk | синий | #2f7bff
Green | yaşil | зелёный | #22c55e
Yellow | sariq | жёлтый | #facc15
Orange | zarğaldoq | оранжевый | #fb923c
Purple | binafşa | фиолетовый | #a855f7
Pink | puşti | розовый | #ff7ab8
Black | qora | чёрный | #1f2937
White | oq | белый | #ffffff
Brown | jigarrang | коричневый | #8b5a2b` },
  { slug: 'numbers', emoji: '🔢', color: '#8ecae6', kind: 'numbers', en: 'Numbers', uz: 'Raqamlar', ru: 'Цифры', words: `
One | bir | один | 🍎 | 1
Two | ikki | два | 🍎🍎 | 2
Three | uç | три | 🍎🍎🍎 | 3
Four | tŏrt | четыре | 🍎🍎🍎🍎 | 4
Five | beş | пять | 🍎🍎🍎🍎🍎 | 5
Six | olti | шесть | 🍎🍎🍎🍎🍎🍎 | 6
Seven | yetti | семь | 🍎🍎🍎🍎🍎🍎🍎 | 7
Eight | sakkiz | восемь | 🍎🍎🍎🍎🍎🍎🍎🍎 | 8
Nine | toqqiz | девять | 🍎🍎🍎🍎🍎🍎🍎🍎🍎 | 9
Ten | on | десять | 🍎🍎🍎🍎🍎🍎🍎🍎🍎🍎 | 10` },
  { slug: 'fruits', emoji: '🍓', color: '#ef476f', kind: 'words', en: 'Fruits', uz: 'Mevalar', ru: 'Фрукты', words: `
Apple | olma | яблоко | 🍎
Banana | banan | банан | 🍌
Orange | apelsin | апельсин | 🍊
Strawberry | qulupnay | клубника | 🍓
Grapes | uzum | виноград | 🍇
Watermelon | tarvuz | арбуз | 🍉
Lemon | limon | лимон | 🍋
Pear | nok | груша | 🍐
Peach | şaftoli | персик | 🍑
Cherry | olça | вишня | 🍒` },
  { slug: 'family', emoji: '👨‍👩‍👧‍👦', color: '#c77dff', kind: 'words', en: 'Family', uz: 'Oila', ru: 'Семья', words: `
Mother | ona | мама | 👩
Father | ota | папа | 👨
Sister | opa | сестра | 👧
Brother | aka | брат | 🧒
Baby | çaqaloq | малыш | 👶
Grandmother | buvi | бабушка | 👵
Grandfather | bobo | дедушка | 👴
Family | oila | семья | 👨‍👩‍👧‍👦
Friend | dŏst | друг | 👫` },
  { slug: 'body', emoji: '🖐️', color: '#ffd166', kind: 'words', en: 'Body Parts', uz: 'Tana aʼzolari', ru: 'Части тела', words: `
Head | boş | голова | 🙂
Eyes | kŏz | глаза | 👀
Nose | burun | нос | 👃
Mouth | oğiz | рот | 👄
Ear | quloq | ухо | 👂
Hand | qŏl | рука | ✋
Leg | oyoq | нога | 🦵
Foot | oyoq kafti | ступня | 🦶
Tooth | tiş | зуб | 🦷
Tongue | til | язык | 👅` },
  { slug: 'food', emoji: '🍕', color: '#f77f00', kind: 'words', en: 'Food', uz: 'Ovqat', ru: 'Еда', words: `
Bread | non | хлеб | 🍞
Milk | sut | молоко | 🥛
Water | suv | вода | 💧
Pizza | pitsa | пицца | 🍕
Egg | tuxum | яйцо | 🥚
Cheese | pişloq | сыр | 🧀
Rice | guruç | рис | 🍚
Soup | şŏrva | суп | 🍲
Cake | tort | торт | 🍰
Meat | gŏşt | мясо | 🍖
Cookie | peçenye | печенье | 🍪
Ice cream | muzqaymoq | мороженое | 🍦` },
  { slug: 'toys', emoji: '🧸', color: '#ff8fab', kind: 'words', en: 'Toys', uz: 'Ŏyinçoqlar', ru: 'Игрушки', words: `
Ball | tŏp | мяч | ⚽
Doll | qŏğirçoq | кукла | 🎎
Car | maşina | машинка | 🚗
Teddy bear | ayiqça | мишка | 🧸
Robot | robot | робот | 🤖
Balloon | şarça | шарик | 🎈
Drum | noğora | барабан | 🥁
Puzzle | jumboq | пазл | 🧩
Guitar | gitara | гитара | 🎸
Blocks | kubiklar | кубики | 🧱` },
  { slug: 'vehicles', emoji: '🚗', color: '#4cc9f0', kind: 'words', en: 'Vehicles', uz: 'Transport', ru: 'Транспорт', words: `
Car | maşina | машина | 🚗
Bus | avtobus | автобус | 🚌
Train | poyezd | поезд | 🚆
Airplane | samolyot | самолёт | ✈️
Bicycle | velosiped | велосипед | 🚲
Ship | kema | корабль | 🚢
Taxi | taksi | такси | 🚕
Truck | yuk maşinasi | грузовик | 🚚
Helicopter | vertolyot | вертолёт | 🚁
Rocket | raketa | ракета | 🚀` },
  { slug: 'clothes', emoji: '👕', color: '#9b5de5', kind: 'words', en: 'Clothes', uz: 'Kiyimlar', ru: 'Одежда', words: `
Shirt | kŏylak | рубашка | 👕
Pants | şim | штаны | 👖
Shoes | poyabzal | обувь | 👟
Hat | şlyapa | шляпа | 👒
Dress | libos | платье | 👗
Socks | paypoq | носки | 🧦
Coat | palto | пальто | 🧥
Gloves | qŏlqop | перчатки | 🧤
Scarf | şarf | шарф | 🧣
Glasses | kŏzoynak | очки | 👓` },
  { slug: 'nature', emoji: '🌳', color: '#06d6a0', kind: 'words', en: 'Nature', uz: 'Tabiat', ru: 'Природа', words: `
Sun | quyoş | солнце | ☀️
Moon | oy | луна | 🌙
Star | yulduz | звезда | ⭐
Flower | gul | цветок | 🌸
Tree | daraxt | дерево | 🌳
Cloud | bulut | облако | ☁️
Rain | yomğir | дождь | 🌧️
Snow | qor | снег | ❄️
Rainbow | kamalak | радуга | 🌈
Mountain | tağ | гора | ⛰️` },
  { slug: 'everyday', emoji: '👋', color: '#ffbe0b', kind: 'words', en: 'Everyday Words', uz: 'Kundalik sŏzlar', ru: 'Повседневные слова', words: `
Hello | salom | привет | 👋
Goodbye | xayr | до свидания | ✌️
Please | iltimos | пожалуйста | 🙏
Thank you | rahmat | спасибо | 😊
Sorry | keçirasiz | извините | 😔
Yes | ha | да | ✅
No | yŏq | нет | ❌
Good morning | xayrli tong | доброе утро | 🌅
Good night | xayrli tun | спокойной ночи | 🌛
Happy | xursand | счастливый | 😀` },
  { slug: 'sentences', emoji: '💬', color: '#3a86ff', kind: 'sentences', en: 'Simple Sentences', uz: 'Oddiy gaplar', ru: 'Простые предложения', words: `
My name is Ali. | Mening ismim Ali. | Меня зовут Али. | 🙋
This is a cat. | Bu muşuk. | Это кошка. | 🐱
I like apples. | Menga olma yoqadi. | Я люблю яблоки. | 🍎
I have a ball. | Mening tŏpim bor. | У меня есть мяч. | ⚽
I am happy. | Men xursandman. | Я счастлив. | 😀
I see a bird. | Men quş kŏryapman. | Я вижу птицу. | 🐦
She is my mother. | U mening onam. | Она моя мама. | 👩
The sun is hot. | Quyoş issiq. | Солнце горячее. | ☀️
I can run. | Men yugura olaman. | Я умею бегать. | 🏃
I love my family. | Men oilamni yaxşi kŏraman. | Я люблю свою семью. | 👨‍👩‍👧‍👦` },
];
module.exports = { CATEGORIES };
