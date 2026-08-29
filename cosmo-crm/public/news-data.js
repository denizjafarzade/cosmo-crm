// Demo content for client preview — replace with real academy content before launch.
// Edit all articles and gallery items in this single file.
//
// category/title/excerpt are { en, az, ru } so the card and listing pages can
// show the right language (see pickLang() in index.html / news.html /
// news-article.html). `body` (the full article) stays English-only for this
// demo copy — translate it here once real articles replace these.

var NEWS = [
  {
    slug: 'young-players-shine-rapid-tournament',
    category: { en: 'Tournament', az: 'Turnir', ru: 'Турнир' },
    date: '2026-06-21',
    title: {
      en: 'Young Players Shine at the Weekend Rapid Tournament',
      az: 'Gənc Oyunçular Həftəsonu Sürətli Turnirdə Parladı',
      ru: 'Юные игроки блеснули на воскресном турнире по рапиду'
    },
    excerpt: {
      en: 'Our students demonstrated strong focus, confidence, and sportsmanship during a competitive weekend event with players from across the city.',
      az: 'Şagirdlərimiz şəhərin müxtəlif yerlərindən gələn oyunçularla keçirilən rəqabətli həftəsonu tədbirində güclü diqqət, özünəinam və idman əxlaqı nümayiş etdirdilər.',
      ru: 'Наши ученики продемонстрировали высокую концентрацию, уверенность и спортивный дух на конкурентном турнире выходного дня с участниками со всего города.'
    },
    image: 'img/ph-tournament.svg',
    imageAlt: 'Students competing at the Weekend Rapid Tournament',
    relatedGalleryFilter: 'tournaments',
    galleryItems: ['g4', 'g5', 'g6'],
    body:
      '<p>Last Saturday, a group of our students joined a full-day weekend rapid tournament — a chance to put recent lessons into practice in a real competitive setting. Players of varying skill levels took part, from those entering their very first tournament to more experienced students pushing for personal performance goals.</p>'
      + '<p>The format used rapid time controls, giving each player fifteen minutes per game. The pace kept energy high throughout the day, and coaches were on hand between rounds to offer brief feedback and encouragement. Watching students apply opening theory and endgame patterns they had practised in sessions was one of the clearest signs of progress the academy has seen this season.</p>'
      + '<div class="article-callout"><p>Tournament experience is one of the fastest ways to grow as a chess player. The combination of time pressure, unfamiliar opponents, and genuine stakes builds a kind of mental resilience that regular lessons alone cannot replicate.</p></div>'
      + '<p>Students finished the day with a range of results, but all walked away with valuable experience. A follow-up group analysis session is planned for the coming week, where the most instructive moments from the day will be reviewed together as a group.</p>'
  },
  {
    slug: 'season-of-strong-progress',
    category: { en: 'Achievement', az: 'Nailiyyət', ru: 'Достижение' },
    date: '2026-05-30',
    title: {
      en: 'A Season of Strong Progress and New Milestones',
      az: 'Güclü İnkişaf və Yeni Nailiyyətlər Mövsümü',
      ru: 'Сезон уверенного прогресса и новых достижений'
    },
    excerpt: {
      en: 'Several students reached important personal milestones after months of structured training — from first tournament entries to significant rating improvements.',
      az: 'Bir neçə şagird aylarla davam edən sistemli məşqlərdən sonra mühüm şəxsi nailiyyətlərə çatdı — ilk turnir iştirakından tutmuş reytinqdə ciddi irəliləyişlərə qədər.',
      ru: 'Несколько учеников достигли важных личных результатов после месяцев системных тренировок — от первого участия в турнире до значительного роста рейтинга.'
    },
    image: 'img/ph-awards.svg',
    imageAlt: 'Student receiving recognition for chess progress',
    relatedGalleryFilter: 'awards',
    galleryItems: ['g7', 'g8', 'g9'],
    body:
      '<p>This season, several students across different age groups reached meaningful personal milestones after months of consistent training and regular practice. These results reflect the kind of steady, compounding progress that builds when students commit to structured sessions over time.</p>'
      + '<p>Progress in chess rarely follows a straight line. Students often plateau before a breakthrough — and then gain confidence and skill in a short burst. The coaches work to recognise these moments early and adjust the curriculum to accelerate growth during these windows. This season\'s highlights included first competitive entries, opening breakthroughs, and strong improvements in endgame technique across multiple age groups.</p>'
      + '<div class="article-callout"><p>Every student\'s journey is different. Some improve most through tournament experience, others through deep opening study or endgame drills. Our role is to identify which approach fits each individual and adapt the programme accordingly.</p></div>'
      + '<p>The coming season will see several of these students move on to new training goals — including their first rated tournament entries and more advanced strategic material. We are proud of every student who has put in the work this season and look forward to seeing what the next term brings.</p>'
  },
  {
    slug: 'highlights-online-chess-event',
    category: { en: 'Academy Event', az: 'Akademiya Tədbiri', ru: 'Мероприятие академии' },
    date: '2026-05-10',
    title: {
      en: 'Highlights from Our Latest Online Chess Event',
      az: 'Son Onlayn Şahmat Tədbirimizdən Seçmələr',
      ru: 'Лучшие моменты нашего последнего онлайн-турнира'
    },
    excerpt: {
      en: 'Students from different age groups came together for an engaging online tournament and shared learning session that showcased both skill and sportsmanship.',
      az: 'Müxtəlif yaş qruplarından şagirdlər maraqlı bir onlayn turnir və birgə tədris sessiyasında bir araya gəldi, bu da həm bacarıqlarını, həm də idman əxlaqını nümayiş etdirdi.',
      ru: 'Ученики разных возрастных групп собрались вместе для увлекательного онлайн-турнира и совместного учебного занятия, показав как мастерство, так и спортивный дух.'
    },
    image: 'img/ph-training.svg',
    imageAlt: 'Students participating in an online chess event',
    relatedGalleryFilter: 'training',
    galleryItems: ['g1', 'g2', 'g3'],
    body:
      '<p>Our latest online chess event brought together students from across different age groups for an afternoon of competitive play and shared learning. The digital format meant participants from different schedules and locations could all join in without the constraints of a physical venue.</p>'
      + '<p>The event featured a short rapid tournament, followed by a live analysis session where coaches walked through key moments from the games. Students were encouraged to comment and ask questions during the review, making it an interactive learning experience rather than a simple competition. Several especially instructive positions were saved for use in upcoming individual sessions.</p>'
      + '<div class="article-callout"><p>Online events allow us to reach students who may not be able to attend in-person activities, and they give everyone a chance to compete in a relaxed, familiar setting. The format has proven especially effective for students who are newer to competitive play.</p></div>'
      + '<p>Based on the response, we plan to run similar events monthly. Students who wish to participate in the next session can register through our WhatsApp group or contact us directly for details on timing and format.</p>'
  },
  {
    slug: 'personalised-coaching-approach',
    category: { en: 'Training', az: 'Təlim', ru: 'Обучение' },
    date: '2026-04-18',
    title: {
      en: 'How Personalised Coaching Plans Change the Game',
      az: 'Fərdi Təlim Planları Oyunu Necə Dəyişir',
      ru: 'Как персонализированные тренерские планы меняют игру'
    },
    excerpt: {
      en: 'Every student at the academy trains with a tailored plan built around their current level, goals, and learning style — here is what that looks like in practice.',
      az: 'Akademiyadakı hər bir şagird öz səviyyəsinə, məqsədlərinə və öyrənmə tərzinə uyğun hazırlanmış fərdi planla məşq edir — bu, praktikada necə görünür.',
      ru: 'Каждый ученик академии тренируется по индивидуальному плану, составленному с учётом его текущего уровня, целей и стиля обучения — вот как это выглядит на практике.'
    },
    image: 'img/ph-training.svg',
    imageAlt: 'Coach working one-on-one with a student at a chess board',
    relatedGalleryFilter: 'training',
    galleryItems: ['g1', 'g2', 'g12'],
    body:
      '<p>One of the most common questions new families ask is how we structure individual lessons. The answer is that no two students train the same way — because no two students have exactly the same gaps, strengths, or goals.</p>'
      + '<p>When a new student joins, the first session is always an assessment. The coach plays through a few short games, sets some puzzles, and asks questions about what the student finds difficult or enjoys most. From that conversation, a personalised training plan is built. It may prioritise tactical patterns, or opening theory, or endgame technique — depending on where the clearest improvement opportunities lie.</p>'
      + '<div class="article-callout"><p>A student who already has strong tactical instincts but crumbles in the endgame does not need the same curriculum as a student who plays solid positional chess but misses combinations. Generic training plans cannot address this — individual ones can.</p></div>'
      + '<p>Plans are reviewed every four to six weeks and updated based on progress. As students develop, the focus shifts naturally — and the coaching adapts to match. It is this ongoing adjustment that produces the consistent improvements we see across the academy.</p>'
  },
  {
    slug: 'end-of-season-awards',
    category: { en: 'Achievement', az: 'Nailiyyət', ru: 'Достижение' },
    date: '2026-03-22',
    title: {
      en: 'Student Recognition Ceremony — End-of-Season Awards',
      az: 'Şagird Təltif Mərasimi — Mövsüm Sonu Mükafatları',
      ru: 'Церемония признания учеников — награды по итогам сезона'
    },
    excerpt: {
      en: 'The academy held its end-of-season recognition evening, celebrating the dedication and growth of students who made exceptional strides over the past months.',
      az: 'Akademiya mövsüm sonu təltif gecəsini keçirdi və son aylarda böyük irəliləyiş əldə edən şagirdlərin əzmini və inkişafını qeyd etdi.',
      ru: 'Академия провела вечер признания по итогам сезона, отметив усердие и рост учеников, добившихся значительных успехов за последние месяцы.'
    },
    image: 'img/ph-awards.svg',
    imageAlt: 'End-of-season student recognition ceremony at the academy',
    relatedGalleryFilter: 'awards',
    galleryItems: ['g7', 'g8', 'g9'],
    body:
      '<p>To close the season, the academy held a recognition evening for students who demonstrated exceptional commitment, improvement, or sportsmanship over the past months. The event brought together students, parents, and coaches for an informal ceremony celebrating the work everyone had put in.</p>'
      + '<p>Recognition was given across several categories — not only for competitive results, but also for consistency, attitude, and personal growth. Several students who had never played a single game at the start of the season were celebrated for reaching their first competitive entry. Others were recognised for significant improvements in their approach to difficult positions and time management under pressure.</p>'
      + '<div class="article-callout"><p>We believe that the most important achievements in chess are often the ones that do not show up in a result — the student who finally stops rushing, the one who starts trusting their calculation, or the one who comes back every week regardless of how the last tournament went.</p></div>'
      + '<p>The evening ended with a short blitz tournament and a light analysis session. We are grateful to every student and parent who made this season what it was, and we look forward to building on it in the term ahead.</p>'
  },
  {
    slug: 'summer-chess-camp-2026',
    category: { en: 'Academy Event', az: 'Akademiya Tədbiri', ru: 'Мероприятие академии' },
    date: '2026-02-28',
    title: {
      en: 'Summer Chess Camp 2026 — Registration Open',
      az: '2026 Yay Şahmat Düşərgəsi — Qeydiyyat Açıqdır',
      ru: 'Летний шахматный лагерь 2026 — регистрация открыта'
    },
    excerpt: {
      en: 'Our intensive five-day summer programme returns this July, offering structured training, friendly competition, and group activities for players aged 7 to 16.',
      az: 'Beş günlük intensiv yay proqramımız bu iyulda geri qayıdır və 7-16 yaş arası oyunçular üçün sistemli məşq, dostluq yarışları və qrup fəaliyyətləri təklif edir.',
      ru: 'Наша интенсивная пятидневная летняя программа возвращается в июле, предлагая структурированные тренировки, дружеские соревнования и групповые активности для игроков 7-16 лет.'
    },
    image: 'img/ph-camps.svg',
    imageAlt: 'Group of students at a chess camp activity',
    relatedGalleryFilter: 'camps',
    galleryItems: ['g10', 'g11', 'g12'],
    body:
      '<p>Registration is now open for the Cosmo Chess Academy Summer Camp — a five-day intensive programme designed for players aged 7 to 16 who want to make serious progress during the summer break. Spots are limited to ensure every participant receives meaningful attention from coaches.</p>'
      + '<p>Each day runs from 10:00 to 16:00 and is divided between structured training sessions, friendly games, and group activities. Morning sessions focus on thematic lessons — tactics, openings, or endgames — while afternoons are given over to practice games, puzzle competitions, and team events. The schedule is deliberately varied to keep energy and engagement high across the full five days.</p>'
      + '<div class="article-callout"><p>The summer camp is one of the most effective ways for students to accelerate their development. Immersive, focused training over five consecutive days produces results that would otherwise take months of weekly lessons to achieve.</p></div>'
      + '<p>Past camp participants have consistently returned to the autumn term with noticeably stronger games, greater confidence at the board, and a clearer understanding of their own playing style. To reserve a place, contact us through WhatsApp or the form at the bottom of this page. Early registration is strongly recommended as spaces fill quickly each year.</p>'
  }
];

// Demo gallery items — replace images with real academy photos before launch.
// Each item: id, category (matches filter), title, caption, image path, alt text, optional relatedArticle slug.
var GALLERY = [
  {
    id: 'g1',
    category: 'training',
    title: 'Individual Training Session',
    caption: 'One-on-one coaching with focused board analysis and personalised feedback.',
    image: 'img/ph-training.svg',
    alt: 'Coach and student analysing a chess position together'
  },
  {
    id: 'g2',
    category: 'training',
    title: 'Group Strategy Workshop',
    caption: 'Students working through a shared tactical puzzle in a collaborative session.',
    image: 'img/ph-training.svg',
    alt: 'Group of students studying chess positions on a shared board',
    relatedArticle: 'highlights-online-chess-event'
  },
  {
    id: 'g3',
    category: 'training',
    title: 'Online Coaching Session',
    caption: 'A typical online lesson — screen-shared board, live analysis, real feedback.',
    image: 'img/ph-training.svg',
    alt: 'Online coaching session with shared chess board on screen',
    relatedArticle: 'highlights-online-chess-event'
  },
  {
    id: 'g4',
    category: 'tournaments',
    title: 'Weekend Rapid Tournament',
    caption: 'Students focused and in the zone during the Saturday rapid event.',
    image: 'img/ph-tournament.svg',
    alt: 'Students competing at the Weekend Rapid Tournament',
    relatedArticle: 'young-players-shine-rapid-tournament'
  },
  {
    id: 'g5',
    category: 'tournaments',
    title: 'Junior Online Competition',
    caption: 'Our junior students competing in a structured online blitz format.',
    image: 'img/ph-tournament.svg',
    alt: 'Junior students in an online chess competition',
    relatedArticle: 'young-players-shine-rapid-tournament'
  },
  {
    id: 'g6',
    category: 'tournaments',
    title: 'Friendly Practice Tournament',
    caption: 'An internal practice event for students preparing for upcoming rated competitions.',
    image: 'img/ph-tournament.svg',
    alt: 'Students at a friendly practice tournament between training groups'
  },
  {
    id: 'g7',
    category: 'awards',
    title: 'Student Recognition Ceremony',
    caption: 'Celebrating the season\'s standout moments of growth and dedication.',
    image: 'img/ph-awards.svg',
    alt: 'Student receiving recognition at the end-of-season ceremony',
    relatedArticle: 'end-of-season-awards'
  },
  {
    id: 'g8',
    category: 'awards',
    title: 'End-of-Season Awards',
    caption: 'Coaches presenting students with awards for progress and commitment.',
    image: 'img/ph-awards.svg',
    alt: 'Coach presenting an award to a student at the end-of-season event',
    relatedArticle: 'end-of-season-awards'
  },
  {
    id: 'g9',
    category: 'awards',
    title: 'Regional Tournament Podium',
    caption: 'A proud moment after a strong showing at a regional open event.',
    image: 'img/ph-awards.svg',
    alt: 'Students celebrating a podium finish at a regional chess tournament'
  },
  {
    id: 'g10',
    category: 'camps',
    title: 'Summer Chess Camp',
    caption: 'Five days of intensive training, games, and team activities every July.',
    image: 'img/ph-camps.svg',
    alt: 'Students gathered for a day of summer chess camp activities',
    relatedArticle: 'summer-chess-camp-2026'
  },
  {
    id: 'g11',
    category: 'camps',
    title: 'Chess Camp Group Activity',
    caption: 'Team puzzle-solving and group games during a camp afternoon session.',
    image: 'img/ph-camps.svg',
    alt: 'Students doing a group chess activity during summer camp',
    relatedArticle: 'summer-chess-camp-2026'
  },
  {
    id: 'g12',
    category: 'camps',
    title: 'Outdoor Strategy Session',
    caption: 'A change of setting — strategic thinking exercises in an outdoor format.',
    image: 'img/ph-camps.svg',
    alt: 'Students participating in an outdoor chess strategy session'
  }
];
