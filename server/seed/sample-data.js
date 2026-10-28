/* Original sample curriculum (not copied from any other product). Levels are indicative CEFR-style labels, not an official assessment.
   Word entry: [english, uzbek, part of speech, example sentence, example translation]. */
const W = (en, uz, pos, ex, exUz) => ({ en, uz, pos, ex, exUz });

const GENERAL = {
  slug: 'english-foundations', title: 'English Foundations', track: 'general',
  description: 'A step-by-step English course from beginner to advanced with an Uzbek translation language. Sample content: edit or extend it in the admin panel.',
  levels: [
    { code: 'A1', title: 'Beginner', description: 'First words and simple sentences.', units: [
      { title: 'Hello and me', description: 'Greet people and talk about yourself and your family.', lessons: [
        { title: 'Greetings', description: 'Say hello and be polite.', words: [W('hello', 'salom', 'interjection', 'Hello, my name is Anna.', 'Salom, mening ismim Anna.'), W('goodbye', 'xayr', 'interjection', 'Goodbye, see you tomorrow.', "Xayr, ertaga ko'rishamiz."), W('please', 'iltimos', 'adverb', 'Please sit down.', "Iltimos, o'tiring."), W('thank you', 'rahmat', 'phrase', 'Thank you for your help.', 'Yordamingiz uchun rahmat.'), W('yes', 'ha', 'interjection', 'Yes, I like tea.', 'Ha, men choyni yoqtiraman.'), W('morning', 'ertalab', 'noun', 'Good morning, teacher.', "Xayrli tong, o'qituvchi.")],
          sentence: ['Nice to meet you.', 'Siz bilan tanishganimdan xursandman.'],
          passage: { text: 'Anna says hello to her teacher every morning. She says, "Good morning!" Then she sits down and opens her book.', q: 'What does Anna say in the morning?', options: ['Good morning!', 'Goodbye!', 'Thank you!'], expl: 'The passage says she says "Good morning!" to her teacher.' },
          mc: { prompt: 'Choose the correct reply to "Thank you!"', options: ["You're welcome.", 'Good morning.', 'Goodbye.'], expl: '"You\'re welcome" is the polite answer to "Thank you".' } },
        { title: 'About me', description: 'Say who you are.', words: [W('name', 'ism', 'noun', 'My name is Omar.', 'Mening ismim Omar.'), W('student', 'talaba', 'noun', 'I am a student.', 'Men talabaman.'), W('teacher', "o'qituvchi", 'noun', 'She is a teacher.', "U o'qituvchi."), W('friend', "do'st", 'noun', 'He is my friend.', "U mening do'stim."), W('country', 'davlat', 'noun', 'My country is beautiful.', "Mening davlatim go'zal."), W('age', 'yosh', 'noun', 'What is your age?', 'Yoshingiz nechada?')],
          sentence: ['I am a student.', 'Men talabaman.'],
          passage: { text: 'My name is Omar. I am from Tashkent. I am a student and I like English.', q: 'What is Omar?', options: ['A student', 'A teacher', 'A doctor'], expl: 'He says "I am a student".' },
          mc: { prompt: 'She ___ a teacher.', options: ['is', 'am', 'are'], expl: 'Use "is" with she, he and it.' } },
        { title: 'My family', description: 'Talk about people in your family.', words: [W('mother', 'ona', 'noun', 'My mother works at a school.', 'Onam maktabda ishlaydi.'), W('father', 'ota', 'noun', 'My father drives a bus.', 'Otam avtobus haydaydi.'), W('sister', 'opa; singil', 'noun', 'My sister has a cat.', 'Opamning mushugi bor.'), W('brother', 'aka; uka', 'noun', 'My brother plays football.', "Akam futbol o'ynaydi."), W('grandmother', 'buvi', 'noun', 'My grandmother tells stories.', "Buvim ertaklar aytib beradi."), W('family', 'oila', 'noun', 'I love my family.', 'Men oilamni sevaman.')],
          sentence: ['We have a big family.', 'Bizning katta oilamiz bor.'],
          passage: { text: 'Lola has a small family. Her father is a driver and her mother is a nurse. Lola has one brother.', q: 'How many brothers does Lola have?', options: ['One', 'Two', 'None'], expl: 'The passage says she has one brother.' },
          mc: { prompt: 'This is ___ mother.', options: ['my', 'me', 'I'], expl: 'Use "my" before a noun.' } },
      ] },
      { title: 'Food and daily life', description: 'Food, drinks and your day.', lessons: [
        { title: 'At the table', description: 'Name common food and drink.', words: [W('water', 'suv', 'noun', 'Can I have some water?', 'Menga biroz suv bera olasizmi?'), W('bread', 'non', 'noun', 'We eat bread for breakfast.', 'Biz nonushtada non yeymiz.'), W('apple', 'olma', 'noun', 'She eats an apple every day.', 'U har kuni olma yeydi.'), W('tea', 'choy', 'noun', 'I drink tea with sugar.', 'Men choyni shakar bilan ichaman.'), W('milk', 'sut', 'noun', 'The baby drinks milk.', 'Chaqaloq sut ichadi.'), W('rice', 'guruch', 'noun', 'Rice is my favourite food.', 'Guruch mening sevimli taomim.')],
          sentence: ['I drink tea every morning.', 'Men har ertalab choy ichaman.'],
          passage: { text: 'At breakfast, Karim eats bread and an apple. He drinks tea with milk.', q: 'What does Karim drink?', options: ['Tea with milk', 'Water', 'Juice'], expl: 'He drinks tea with milk.' },
          mc: { prompt: 'I ___ water every day.', options: ['drink', 'eat', 'read'], expl: 'We drink water, we do not eat it.' } },
        { title: 'Daily routine', description: 'Describe what you do every day.', words: [W('wake up', "uyg'onmoq", 'verb', 'I wake up at seven o\'clock.', "Men soat yettida uyg'onaman."), W('eat', 'yemoq', 'verb', 'We eat dinner together.', 'Biz kechki ovqatni birga yeymiz.'), W('go', 'bormoq', 'verb', 'I go to school by bus.', 'Men maktabga avtobusda boraman.'), W('sleep', 'uxlamoq', 'verb', 'The children sleep early.', 'Bolalar barvaqt uxlaydi.'), W('work', 'ishlamoq', 'verb', 'My father works in a bank.', 'Otam bankda ishlaydi.'), W('study', "o'rganmoq; o'qimoq", 'verb', 'I study English every evening.', "Men har kech ingliz tilini o'rganaman.")],
          sentence: ['She wakes up at six.', "U soat oltida uyg'onadi."],
          passage: { text: 'Aziz wakes up at six. He eats breakfast and goes to work. In the evening he studies English.', q: 'What does Aziz do in the evening?', options: ['He studies English', 'He goes to work', 'He eats breakfast'], expl: 'The last sentence says he studies English in the evening.' },
          mc: { prompt: 'He ___ to school every day.', options: ['goes', 'go', 'going'], expl: 'Add -s to the verb after he, she and it.' } },
      ] },
      { title: 'Places', description: 'Places in a town.', lessons: [
        { title: 'Around town', description: 'Say where things are.', words: [W('house', 'uy', 'noun', 'We live in a small house.', 'Biz kichkina uyda yashaymiz.'), W('school', 'maktab', 'noun', 'The school opens at eight.', 'Maktab soat sakkizda ochiladi.'), W('shop', "do'kon", 'noun', 'The shop sells fresh bread.', "Do'kon yangi non sotadi."), W('park', 'park', 'noun', 'Children play in the park.', "Bolalar parkda o'ynaydi."), W('street', "ko'cha", 'noun', 'Our street is quiet.', "Bizning ko'chamiz tinch."), W('city', 'shahar', 'noun', 'Samarkand is an old city.', 'Samarqand qadimiy shahar.')],
          sentence: ['The park is near my house.', 'Park mening uyimga yaqin.'],
          passage: { text: 'There is a small shop on my street. It is next to the school. I buy bread there every morning.', q: 'Where is the shop?', options: ['Next to the school', 'Next to the park', 'In the city centre'], expl: 'The passage says the shop is next to the school.' },
          mc: { prompt: 'There ___ a park in my city.', options: ['is', 'are', 'am'], expl: 'Use "is" with one thing (a park).' } },
      ] },
    ] },
    { code: 'A2', title: 'Elementary', description: 'Everyday situations.', units: [
      { title: 'Everyday life', description: 'Shopping and travelling.', lessons: [
        { title: 'Shopping', description: 'Ask about prices and pay.', words: [W('price', 'narx', 'noun', 'What is the price of this bag?', 'Bu sumkaning narxi qancha?'), W('cheap', 'arzon', 'adjective', 'These shoes are cheap.', 'Bu poyabzallar arzon.'), W('expensive', 'qimmat', 'adjective', 'That phone is too expensive.', "O'sha telefon juda qimmat."), W('buy', 'sotib olmoq', 'verb', 'I want to buy a new jacket.', 'Men yangi kurtka sotib olmoqchiman.'), W('pay', "to'lamoq", 'verb', 'You can pay by card.', "Karta bilan to'lashingiz mumkin."), W('money', 'pul', 'noun', 'I do not have enough money.', "Menda yetarli pul yo'q.")],
          sentence: ['How much does this shirt cost?', "Bu ko'ylak qancha turadi?"],
          passage: { text: 'Dilya wanted to buy a coat. The first coat was expensive, so she went to another shop. There the coats were cheaper, and she bought a green one.', q: 'Why did Dilya go to another shop?', options: ['The first coat was expensive.', 'The first shop was closed.', 'She wanted a red coat.'], expl: 'The first coat was expensive, so she went to another shop.' },
          mc: { prompt: 'This bag is ___ than that one.', options: ['cheaper', 'cheap', 'cheapest'], expl: 'Use the comparative form with "than".' } },
        { title: 'Travel', description: 'Trains, tickets and hotels.', words: [W('ticket', 'chipta', 'noun', 'I need a ticket to Bukhara.', 'Menga Buxoroga chipta kerak.'), W('train', 'poyezd', 'noun', 'The train leaves at nine.', "Poyezd soat to'qqizda jo'naydi."), W('airport', 'aeroport', 'noun', 'We arrived at the airport early.', 'Biz aeroportga barvaqt yetib keldik.'), W('luggage', 'bagaj', 'noun', 'My luggage is very heavy.', "Bagajim juda og'ir."), W('journey', 'sayohat', 'noun', 'The journey took three hours.', 'Sayohat uch soat davom etdi.'), W('hotel', 'mehmonxona', 'noun', 'The hotel is near the station.', 'Mehmonxona bekatga yaqin.')],
          sentence: ['Where can I buy a ticket?', 'Chiptani qayerdan sotib olsam bo\'ladi?'],
          passage: { text: 'Our journey to Khiva started early. We took the train at six in the morning. After four hours, we arrived and went to the hotel.', q: 'How did they travel to Khiva?', options: ['By train', 'By plane', 'By bus'], expl: 'The passage says they took the train.' },
          mc: { prompt: 'We ___ to the airport yesterday.', options: ['went', 'go', 'goes'], expl: 'Use the past form "went" for yesterday.' } },
      ] },
    ] },
    { code: 'B1', title: 'Intermediate', description: 'Work, study and plans.', units: [
      { title: 'Work and study', description: 'Talk about your job and goals.', lessons: [
        { title: 'Work life', description: 'Vocabulary for the workplace.', words: [W('deadline', 'muddat', 'noun', 'The deadline for the report is Friday.', 'Hisobot muddati — juma.'), W('colleague', 'hamkasb', 'noun', 'My colleague helped me with the project.', 'Hamkasbim loyihada menga yordam berdi.'), W('meeting', "yig'ilish", 'noun', 'We have a meeting at ten o\'clock.', "Soat o'nda yig'ilishimiz bor."), W('salary', 'maosh', 'noun', 'Her salary is paid every month.', "Uning maoshi har oy to'lanadi."), W('improve', 'yaxshilamoq', 'verb', 'I want to improve my speaking skills.', "Men so'zlashuv ko'nikmalarimni yaxshilamoqchiman."), W('experience', 'tajriba', 'noun', 'He has five years of experience.', "Uning besh yillik tajribasi bor.")],
          sentence: ['We need to finish the report today.', 'Bugun hisobotni tugatishimiz kerak.'],
          passage: { text: 'Malika started a new job last month. Her colleagues are friendly, and she learns something new every day. She hopes to gain more experience before asking for a higher salary.', q: 'What does Malika hope to do before asking for a higher salary?', options: ['Gain more experience', 'Change her job', 'Move to another city'], expl: 'She hopes to gain more experience first.' },
          mc: { prompt: 'If I finish early, I ___ help you.', options: ['will', 'would', 'am'], expl: 'First conditional: if + present simple, will + verb.' } },
      ] },
    ] },
    { code: 'B2', title: 'Upper intermediate', description: 'Opinions and arguments.', units: [
      { title: 'Society and ideas', description: 'Express and defend opinions.', lessons: [
        { title: 'Opinions', description: 'Agree, disagree and suggest.', words: [W('opinion', 'fikr', 'noun', 'In my opinion, the plan is realistic.', 'Mening fikrimcha, reja real.'), W('agree', "rozi bo'lmoq; qo'shilmoq", 'verb', 'I agree with your suggestion.', "Men sizning taklifingizga qo'shilaman."), W('argue', 'bahslashmoq', 'verb', 'They often argue about politics.', 'Ular tez-tez siyosat haqida bahslashadi.'), W('evidence', 'dalil', 'noun', 'There is no clear evidence for this claim.', "Bu da'voni tasdiqlovchi aniq dalil yo'q."), W('suggest', 'taklif qilmoq', 'verb', 'I suggest that we postpone the meeting.', "Men yig'ilishni keyinga qoldirishni taklif qilaman."), W('convince', 'ishontirmoq', 'verb', 'She tried to convince him to stay.', 'U uni qolishga ishontirmoqchi bo\'ldi.')],
          sentence: ['I completely agree with you.', "Men siz bilan to'liq roziman."],
          passage: { text: 'Some people think that homework is useful. Others argue that students need more free time. The teacher suggested a compromise: less homework, but more projects.', q: 'What did the teacher suggest?', options: ['Less homework and more projects', 'No homework at all', 'More homework every day'], expl: 'The teacher suggested less homework but more projects.' },
          mc: { prompt: 'She suggested ___ earlier.', options: ['leaving', 'to leave', 'leave'], expl: 'After "suggest" we can use the -ing form.' } },
      ] },
    ] },
    { code: 'C1', title: 'Advanced', description: 'Precise, nuanced language.', units: [
      { title: 'Academic language', description: 'Language for reports and discussions.', lessons: [
        { title: 'Nuance', description: 'Words for precise meaning.', words: [W('reluctant', 'istamaydigan', 'adjective', 'He was reluctant to share his results.', 'U natijalarini baham ko\'rishni istamadi.'), W('significant', 'sezilarli; muhim', 'adjective', 'The study found a significant difference between the groups.', "Tadqiqot guruhlar o'rtasida sezilarli farqni aniqladi."), W('comprehensive', 'har tomonlama', 'adjective', 'The report gives a comprehensive overview of the market.', 'Hisobot bozorga har tomonlama sharh beradi.'), W('mitigate', 'yumshatmoq', 'verb', 'New rules may mitigate the impact of the crisis.', "Yangi qoidalar inqiroz ta'sirini yumshatishi mumkin."), W('ambiguous', 'noaniq', 'adjective', 'The contract contains an ambiguous clause.', 'Shartnomada noaniq band bor.'), W('substantial', 'katta; sezilarli', 'adjective', 'The company made a substantial profit.', "Kompaniya katta foyda ko'rdi.")],
          sentence: ['The results were not entirely clear.', "Natijalar to'liq aniq emas edi."],
          passage: { text: 'The city introduced a comprehensive plan to reduce traffic. Although some residents were reluctant to change their habits, the plan led to a substantial drop in the number of cars downtown.', q: 'What was the result of the plan?', options: ['Far fewer cars downtown', 'More traffic', 'No change'], expl: 'The plan led to a substantial drop in the number of cars.' },
          mc: { prompt: 'Not only ___ late, but he also forgot the documents.', options: ['was he', 'he was', 'did he'], expl: 'After "Not only" at the start of a sentence, the auxiliary verb comes before the subject.' } },
      ] },
    ] },
  ],
};

const IELTS = {
  slug: 'ielts-starter-practice', title: 'IELTS Starter Practice', track: 'ielts',
  description: 'Practice vocabulary and reading tasks in the style of academic exams. This is practice material only, not an official IELTS assessment or a score prediction.',
  levels: [
    { code: 'IELTS', title: 'Academic basics', description: 'Describing charts and trends.', units: [
      { title: 'Describing data', description: 'Words for charts and graphs.', lessons: [
        { title: 'Task vocabulary', description: 'Describe a trend.', words: [W('graph', 'grafik', 'noun', 'The graph shows the number of visitors.', 'Grafik tashrif buyuruvchilar sonini ko\'rsatadi.'), W('increase', 'oshmoq; ko\'paymoq', 'verb', 'Sales increase every summer.', 'Sotuvlar har yozda oshadi.'), W('decrease', 'kamaymoq', 'verb', 'The number of users began to decrease in May.', 'Foydalanuvchilar soni may oyida kamaya boshladi.'), W('proportion', 'ulush; nisbat', 'noun', 'A large proportion of students study abroad.', 'Talabalarning katta qismi chet elda o\'qiydi.'), W('trend', 'tendensiya', 'noun', 'The trend continued for five years.', 'Bu tendensiya besh yil davom etdi.'), W('significantly', 'sezilarli darajada', 'adverb', 'Prices rose significantly last year.', "Narxlar o'tgan yili sezilarli darajada oshdi.")],
          sentence: ['The chart shows a clear upward trend.', "Diagramma aniq o'sish tendensiyasini ko'rsatadi."],
          passage: { text: 'The bar chart compares the number of students in three cities. City A has the highest number, while City C has the lowest. Between 2015 and 2020, the figure for City B rose steadily.', q: 'Which city has the lowest number of students?', options: ['City C', 'City A', 'City B'], expl: 'The passage says City C has the lowest number.' },
          mc: { prompt: 'The figure ___ from 20% to 35% between 2010 and 2015.', options: ['rose', 'raised', 'arose'], expl: '"Rise" does not take an object, so the past form is "rose".' } },
      ] },
    ] },
  ],
};

module.exports = { GENERAL, IELTS };
