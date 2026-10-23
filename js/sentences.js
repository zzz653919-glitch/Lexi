/* Sentence bank for translation, word-order and fill-in-the-blank exercises.
   en: the English sentence. uz: accepted Uzbek translations (the first is shown as the model answer).
   enAlts: other accepted English sentences (for Uzbek -> English exercises).
   words: English vocabulary words the sentence practises (used to pick sentences related to a lesson).
   rule: grammar note id (texts live in locales-lesson.js as rule.<id>.t / rule.<id>.d).
   cloze: { answer, options } turns the sentence into a fill-in-the-blank (the answer appears once in `en`).
   Written for this project from simple everyday English; the Uzbek translations are not reviewed by a
   professional translator, so a teacher or native speaker should double-check them. */
VL.sentences = [
  // ---- A1 ----
  { id: 'a01', level: 'A1', en: 'I am at home.', uz: ['Men uydaman.', 'Men uyda turibman.', 'Uydaman.', 'Uyda turibman.'], words: ['home', 'house'], rule: 'be', cloze: { answer: 'am', options: ['am', 'is', 'are'] } },
  { id: 'a02', level: 'A1', en: 'She is a teacher.', uz: ["U o'qituvchi.", "U o'qituvchidir.", "U ustoz."], words: ['teacher'], rule: 'be', cloze: { answer: 'is', options: ['am', 'is', 'are'] } },
  { id: 'a03', level: 'A1', en: 'We are students.', uz: ["Biz talabamiz.", "Biz o'quvchimiz.", "Biz talabalarmiz."], words: ['student'], rule: 'be', cloze: { answer: 'are', options: ['am', 'is', 'are'] } },
  { id: 'a04', level: 'A1', en: 'He is my brother.', uz: ['U mening akam.', 'U mening ukam.', 'U akam.', 'U ukam.'], words: ['brother'], rule: 'be', cloze: { answer: 'is', options: ['am', 'is', 'are'] } },
  { id: 'a05', level: 'A1', en: 'They are at school.', uz: ['Ular maktabda.', 'Ular maktabdalar.'], words: ['school'], rule: 'be', cloze: { answer: 'are', options: ['am', 'is', 'are'] } },
  { id: 'a06', level: 'A1', en: 'It is a big house.', uz: ['Bu katta uy.', 'Bu katta uydir.', 'Bu katta bir uy.'], words: ['house', 'big'], rule: 'be', cloze: { answer: 'is', options: ['am', 'is', 'are'] } },
  { id: 'a07', level: 'A1', en: 'The water is cold.', uz: ['Suv sovuq.', 'Suv sovuqdir.'], words: ['water', 'cold'], rule: 'be', cloze: { answer: 'is', options: ['am', 'is', 'are'] } },
  { id: 'a08', level: 'A1', en: 'My mother is in the kitchen.', uz: ['Onam oshxonada.', 'Mening onam oshxonada.', 'Onam oshxonada turibdi.'], words: ['mother', 'kitchen'], rule: 'prep', cloze: { answer: 'in', options: ['in', 'on', 'at'] } },
  { id: 'a09', level: 'A1', en: 'The book is on the table.', uz: ['Kitob stol ustida.', 'Kitob stolda.', 'Kitob stolning ustida.'], words: ['book', 'table'], rule: 'prep', cloze: { answer: 'on', options: ['in', 'on', 'at'] } },
  { id: 'a10', level: 'A1', en: 'I drink water.', uz: ['Men suv ichaman.', 'Suv ichaman.'], words: ['water', 'drink'], rule: 'present', cloze: { answer: 'drink', options: ['drink', 'drinks', 'drinking'] } },
  { id: 'a11', level: 'A1', en: 'I eat bread.', uz: ['Men non yeyman.', 'Non yeyman.'], words: ['bread', 'eat'], rule: 'present' },
  { id: 'a12', level: 'A1', en: 'We read books.', uz: ["Biz kitob o'qiymiz.", "Biz kitoblar o'qiymiz.", "Kitob o'qiymiz."], words: ['book', 'read'], rule: 'present' },
  { id: 'a13', level: 'A1', en: 'They go to school.', uz: ['Ular maktabga boradi.', 'Ular maktabga borishadi.', 'Ular maktabga boradilar.'], words: ['school', 'go'], rule: 'present' },
  { id: 'a14', level: 'A1', en: 'She drinks tea.', uz: ['U choy ichadi.'], words: ['tea', 'drink'], rule: 'third', cloze: { answer: 'drinks', options: ['drink', 'drinks', 'drinking'] } },
  { id: 'a15', level: 'A1', en: 'He eats an apple.', uz: ['U olma yeydi.', 'U bitta olma yeydi.'], words: ['apple', 'eat'], rule: 'article', cloze: { answer: 'an', options: ['a', 'an', 'the'] } },
  { id: 'a16', level: 'A1', en: 'He eats rice every day.', uz: ['U har kuni guruch yeydi.', 'U kuniga guruch yeydi.'], words: ['rice', 'eat', 'day'], rule: 'third', cloze: { answer: 'eats', options: ['eat', 'eats', 'eating'] } },
  { id: 'a17', level: 'A1', en: 'I have a book.', uz: ['Menda kitob bor.', 'Mening kitobim bor.', 'Menda bitta kitob bor.'], words: ['book'], rule: 'have', cloze: { answer: 'have', options: ['have', 'has', 'having'] } },
  { id: 'a18', level: 'A1', en: 'She has a sister.', uz: ['Uning opasi bor.', 'Uning singlisi bor.', 'Unda opa bor.', 'Unda singil bor.'], words: ['sister'], rule: 'have', cloze: { answer: 'has', options: ['have', 'has', 'having'] } },
  { id: 'a19', level: 'A1', en: 'We have a big house.', uz: ['Bizda katta uy bor.', 'Bizning katta uyimiz bor.'], words: ['house', 'big'], rule: 'have', cloze: { answer: 'have', options: ['have', 'has', 'having'] } },
  { id: 'a20', level: 'A1', en: 'There is a bed in the room.', uz: ['Xonada karavot bor.', "Xonada to'shak bor.", 'Xonada bitta karavot bor.'], words: ['bed', 'room'], rule: 'there', cloze: { answer: 'is', options: ['is', 'are', 'am'] } },
  { id: 'a21', level: 'A1', en: 'There are two chairs.', uz: ['Ikkita stul bor.', 'Ikki stul bor.'], words: ['chair'], rule: 'there', cloze: { answer: 'are', options: ['is', 'are', 'am'] } },
  { id: 'a22', level: 'A1', en: 'My name is Ali.', uz: ['Mening ismim Ali.', 'Ismim Ali.'], words: ['name'], rule: 'be', cloze: { answer: 'is', options: ['am', 'is', 'are'] } },
  { id: 'a23', level: 'A1', en: 'The teacher speaks English.', uz: ["O'qituvchi ingliz tilida gapiradi.", "O'qituvchi inglizcha gapiradi."], words: ['teacher', 'speak'], rule: 'third', cloze: { answer: 'speaks', options: ['speak', 'speaks', 'speaking'] } },
  { id: 'a24', level: 'A1', en: 'I want some water.', uz: ['Men suv xohlayman.', 'Men biroz suv xohlayman.', 'Suv xohlayman.', 'Men suv istayman.', 'Biroz suv istayman.'], words: ['water'], rule: 'some', cloze: { answer: 'some', options: ['some', 'any', 'an'] } },
  { id: 'a25', level: 'A1', en: 'The door is open.', uz: ['Eshik ochiq.', 'Eshik ochiq turibdi.'], words: ['door', 'open'], rule: 'be', cloze: { answer: 'is', options: ['am', 'is', 'are'] } },
  { id: 'a26', level: 'A1', en: 'I see a car.', uz: ["Men mashina ko'ryapman.", "Men mashinani ko'raman.", "Mashina ko'ryapman.", "Men bitta mashinani ko'ryapman."], words: ['car', 'see'], rule: 'article', cloze: { answer: 'a', options: ['a', 'an', 'the'] } },
  { id: 'a27', level: 'A1', en: 'He drives a bus.', uz: ['U avtobus haydaydi.', 'U avtobusni haydaydi.', 'U avtobus boshqaradi.'], words: ['bus', 'driver'], rule: 'third', cloze: { answer: 'drives', options: ['drive', 'drives', 'driving'] } },
  { id: 'a28', level: 'A1', en: 'I write in my notebook.', uz: ['Men daftarimga yozaman.', 'Daftarimga yozaman.', 'Men daftarga yozaman.', 'Men daftarimda yozaman.'], words: ['notebook', 'write'], rule: 'prep', cloze: { answer: 'in', options: ['in', 'on', 'at'] } },
  { id: 'a29', level: 'A1', en: 'The apple is red.', uz: ['Olma qizil.', 'Olma qizil rangda.'], words: ['apple', 'red'], rule: 'be', cloze: { answer: 'is', options: ['am', 'is', 'are'] } },
  { id: 'a30', level: 'A1', en: 'I am a student.', uz: ["Men talabaman.", "Men o'quvchiman.", "Talabaman.", "O'quvchiman."], words: ['student'], rule: 'be', cloze: { answer: 'am', options: ['am', 'is', 'are'] } },
  // ---- A2 ----
  { id: 'b01', level: 'A2', en: 'I was at school yesterday.', uz: ['Men kecha maktabda edim.', 'Kecha maktabda edim.', 'Men kecha maktabda bo\'ldim.'], words: ['school'], rule: 'pastbe', cloze: { answer: 'was', options: ['was', 'were', 'am'] } },
  { id: 'b02', level: 'A2', en: 'They were tired.', uz: ['Ular charchagan edi.', 'Ular charchagan edilar.', 'Ular horg\'in edi.'], words: [], rule: 'pastbe', cloze: { answer: 'were', options: ['was', 'were', 'is'] } },
  { id: 'b03', level: 'A2', en: 'She bought a ticket.', uz: ['U chipta sotib oldi.', 'U bilet sotib oldi.', 'U bitta chipta sotib oldi.'], words: ['ticket', 'buy'], rule: 'past', cloze: { answer: 'bought', options: ['buy', 'bought', 'buys'] } },
  { id: 'b04', level: 'A2', en: 'We visited the market.', uz: ['Biz bozorga bordik.', 'Biz bozorga tashrif buyurdik.', 'Biz bozorda bo\'ldik.'], words: ['market'], rule: 'past', cloze: { answer: 'visited', options: ['visit', 'visited', 'visiting'] } },
  { id: 'b05', level: 'A2', en: "I don't like cold water.", uz: ['Men sovuq suvni yoqtirmayman.', "Men sovuq suvni yaxshi ko'rmayman.", 'Menga sovuq suv yoqmaydi.', 'Sovuq suvni yoqtirmayman.'], words: ['water', 'cold'], rule: 'neg', cloze: { answer: "don't", options: ["don't", "doesn't", "didn't"] } },
  { id: 'b06', level: 'A2', en: "She doesn't eat meat.", uz: ["U go'sht yemaydi.", "U go'shtni yemaydi."], words: ['meat', 'eat'], rule: 'neg', cloze: { answer: "doesn't", options: ["don't", "doesn't", "didn't"] } },
  { id: 'b07', level: 'A2', en: 'Do you speak English?', uz: ['Siz inglizcha gapirasizmi?', 'Sen inglizcha gapirasanmi?', 'Siz ingliz tilida gapirasizmi?', 'Inglizcha gapirasizmi?'], words: ['speak'], rule: 'ques', cloze: { answer: 'Do', options: ['Do', 'Does', 'Are'] } },
  { id: 'b08', level: 'A2', en: 'Does he work here?', uz: ['U shu yerda ishlaydimi?', 'U bu yerda ishlaydimi?'], words: ['work'], rule: 'ques', cloze: { answer: 'Does', options: ['Do', 'Does', 'Is'] } },
  { id: 'b09', level: 'A2', en: 'I am going to travel.', uz: ['Men sayohat qilmoqchiman.', 'Men sayohatga chiqmoqchiman.', 'Sayohat qilmoqchiman.', 'Men sayohat qilaman.'], words: ['journey', 'travel'], rule: 'going', cloze: { answer: 'going', options: ['going', 'go', 'went'] } },
  { id: 'b10', level: 'A2', en: 'This bag is cheaper than that bag.', uz: ['Bu sumka anavi sumkadan arzonroq.', 'Bu sumka u sumkadan arzonroq.', 'Bu sumka boshqa sumkadan arzonroq.'], words: ['cheap', 'expensive'], rule: 'comp', cloze: { answer: 'cheaper', options: ['cheap', 'cheaper', 'cheapest'] } },
  { id: 'b11', level: 'A2', en: 'I must go home.', uz: ['Men uyga ketishim kerak.', 'Men uyga borishim kerak.', 'Uyga ketishim kerak.', 'Uyga borishim kerak.'], words: ['home', 'go'], rule: 'modal', cloze: { answer: 'must', options: ['must', 'musts', 'to must'] } },
  { id: 'b12', level: 'A2', en: 'We have to wait.', uz: ['Biz kutishimiz kerak.', 'Kutishimiz kerak.', 'Biz kutishga majburmiz.'], words: ['wait'], rule: 'modal', cloze: { answer: 'have', options: ['have', 'has', 'had'] } },
  { id: 'b13', level: 'A2', en: 'She is reading a book now.', uz: ["U hozir kitob o'qiyapti.", "U hozir kitob o'qimoqda.", "U hozir kitob o'qiyotir."], words: ['read', 'book'], rule: 'cont', cloze: { answer: 'reading', options: ['read', 'reads', 'reading'] } },
  { id: 'b14', level: 'A2', en: 'The weather is cloudy today.', uz: ['Bugun ob-havo bulutli.', 'Bugun havo bulutli.', 'Ob-havo bugun bulutli.'], words: ['weather', 'cloudy', 'today'], rule: 'be', cloze: { answer: 'is', options: ['am', 'is', 'are'] } },
  { id: 'b15', level: 'A2', en: 'I need a passport.', uz: ['Menga pasport kerak.', 'Pasport kerak.', 'Menga bitta pasport kerak.'], words: ['passport'], rule: 'article', cloze: { answer: 'a', options: ['a', 'an', 'the'] } },
  { id: 'b16', level: 'A2', en: 'He opens the window.', uz: ['U derazani ochadi.', 'U deraza ochadi.'], words: ['window', 'open'], rule: 'third', cloze: { answer: 'opens', options: ['open', 'opens', 'opening'] } },
  { id: 'b17', level: 'A2', en: 'She closed the door.', uz: ['U eshikni yopdi.', 'U eshik yopdi.'], words: ['door', 'close'], rule: 'past', cloze: { answer: 'closed', options: ['close', 'closed', 'closing'] } },
  { id: 'b18', level: 'A2', en: 'We went to the airport.', uz: ['Biz aeroportga bordik.', 'Biz aeroportga ketdik.'], words: ['airport'], rule: 'past', cloze: { answer: 'went', options: ['go', 'went', 'goes'] } },
  // ---- B1 ----
  { id: 'c01', level: 'B1', en: 'I have lived here for five years.', uz: ['Men bu yerda besh yildan beri yashayman.', 'Men bu yerda besh yildan beri yashab kelaman.', 'Besh yildan beri bu yerda yashayman.'], words: [], rule: 'perfect', cloze: { answer: 'have', options: ['have', 'has', 'had'] } },
  { id: 'c02', level: 'B1', en: 'If it rains, we will stay at home.', uz: ["Agar yomg'ir yog'sa, biz uyda qolamiz.", "Yomg'ir yog'sa, uyda qolamiz.", "Agar yomg'ir yog'sa, uyda qolamiz."], words: ['home'], rule: 'cond1', cloze: { answer: 'will', options: ['will', 'would', 'did'] } },
  { id: 'c03', level: 'B1', en: 'She has already finished her homework.', uz: ['U uy vazifasini allaqachon tugatdi.', 'U uy vazifasini tugatib bo\'ldi.', 'U allaqachon uy vazifasini tugatdi.'], words: ['homework'], rule: 'perfect', cloze: { answer: 'has', options: ['have', 'has', 'is'] } },
  { id: 'c04', level: 'B1', en: 'I used to play football.', uz: ["Men futbol o'ynardim.", "Men ilgari futbol o'ynar edim.", "Men avval futbol o'ynardim."], words: ['hobby', 'exercise'], rule: 'usedto', cloze: { answer: 'used', options: ['used', 'use', 'using'] } },
  { id: 'c05', level: 'B1', en: 'The book was written by a teacher.', uz: ["Kitobni bir o'qituvchi yozgan.", "Kitob o'qituvchi tomonidan yozilgan.", "Bu kitobni o'qituvchi yozgan."], words: ['book', 'teacher'], rule: 'passive', cloze: { answer: 'written', options: ['write', 'wrote', 'written'] } },
  { id: 'c06', level: 'B1', en: 'You should improve your skills.', uz: ['Siz ko\'nikmalaringizni yaxshilashingiz kerak.', 'Sen ko\'nikmalaringni yaxshilashing kerak.', 'Siz mahoratingizni oshirishingiz kerak.', 'Siz ko\'nikmalaringizni oshirishingiz kerak.'], words: ['improve', 'skill'], rule: 'modal', cloze: { answer: 'should', options: ['should', 'shoulds', 'to should'] } },
];

VL.sentenceById = (id) => VL.sentences.find((s) => s.id === id) || null;
