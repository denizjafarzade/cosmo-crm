import React, { useState, useEffect, useRef } from 'react';
import { FaChessKnight, FaChessQueen, FaChessRook, FaChessBishop, FaChessPawn, FaChessKing } from 'react-icons/fa';
import { FiCheck, FiMail, FiPhone, FiMapPin, FiStar, FiBookOpen, FiUsers, FiMonitor, FiClock, FiAward, FiCamera, FiPlay, FiUser } from 'react-icons/fi';
import { FaWhatsapp, FaInstagram, FaTelegram, FaYoutube } from 'react-icons/fa';
import './App.css';

const WHATSAPP_NUMBER = '994XXXXXXXXX';

const THEMES = [
  { id: 'warm', label: 'Warm Cream', color: '#c9a84c', dark: false },
  { id: 'cool', label: 'Cool Slate', color: '#2563eb', dark: false },
  { id: 'emerald', label: 'Emerald', color: '#166534', dark: false },
  { id: 'dark-gold', label: 'Dark Gold', color: '#c9a84c', dark: true },
  { id: 'dark-blue', label: 'Dark Blue', color: '#3b82f6', dark: true },
  { id: 'dark-emerald', label: 'Dark Green', color: '#22c55e', dark: true },
];

const chessPieces = [FaChessKing, FaChessQueen, FaChessRook, FaChessBishop, FaChessKnight, FaChessPawn];

function ChessBackground() {
  const pieces = useRef(
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      Icon: chessPieces[i % chessPieces.length],
      left: `${Math.random() * 100}%`,
      size: `${2 + Math.random() * 3}rem`,
      duration: `${18 + Math.random() * 25}s`,
      delay: `${-Math.random() * 20}s`,
      opacity: 0.3 + Math.random() * 0.5,
    }))
  ).current;

  return (
    <div className="chess-bg">
      {pieces.map(p => (
        <p.Icon
          key={p.id}
          className="chess-piece"
          style={{
            left: p.left,
            fontSize: p.size,
            animationDuration: p.duration,
            animationDelay: p.delay,
            opacity: p.opacity,
          }}
        />
      ))}
    </div>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const close = () => setMenuOpen(false);

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <a href="#hero" className="nav-logo" onClick={close}>
        <FaChessKnight className="nav-logo-icon" />
        <div className="nav-logo-text">Cosmo <span>Chess</span></div>
      </a>
      <ul className={`nav-links ${menuOpen ? 'open' : ''}`}>
        {['About', 'Lessons', 'Achievements', 'Testimonials', 'Gallery', 'Materials', 'Pricing', 'Register'].map(s => (
          <li key={s}><a href={`#${s.toLowerCase()}`} onClick={close}>{s}</a></li>
        ))}
      </ul>
      <button className={`hamburger ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
        <span /><span /><span />
      </button>
    </nav>
  );
}

function Hero() {
  return (
    <section className="hero" id="hero">
      <ChessBackground />
      <div className="hero-content">
        <div className="hero-badge">Welcome to Cosmo Chess Academy</div>
        <h1>Master the Art of <span>Chess</span></h1>
        <p>Professional chess training for all levels. Develop strategic thinking, build confidence, and achieve tournament success with personalized coaching.</p>
        <div className="hero-buttons">
          <a href="#register" className="btn-primary"><FiBookOpen /> Start Learning</a>
          <a href="#about" className="btn-secondary"><FiUser /> Meet Your Coach</a>
        </div>
        <div className="hero-stats">
          <div className="stat-item"><div className="stat-number">8+</div><div className="stat-label">Years Experience</div></div>
          <div className="stat-item"><div className="stat-number">200+</div><div className="stat-label">Students Trained</div></div>
          <div className="stat-item"><div className="stat-number">50+</div><div className="stat-label">Tournament Wins</div></div>
          <div className="stat-item"><div className="stat-number">4.9</div><div className="stat-label">Parent Rating</div></div>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="section" id="about">
      <div className="section-header">
        <div className="section-tag">About the Coach</div>
        <h2>Your Path to Chess Mastery</h2>
        <hr className="divider" />
      </div>
      <div className="about-grid">
        <div className="about-image">
          <div className="about-image-placeholder">
            <FaChessKnight className="placeholder-icon" />
            <span className="placeholder-text">Coach Photo</span>
          </div>
          <div className="about-image-badge">FIDE Rated</div>
        </div>
        <div className="about-text">
          <h3>Hi, I'm <span>Abdullah Shabanov</span></h3>
          <p>
            I'm a passionate chess coach dedicated to helping students of all ages unlock their potential through the beautiful game of chess. With years of competitive and teaching experience, I bring a structured yet engaging approach to every lesson.
          </p>
          <p>
            My mission at Cosmo Chess Academy is to make chess accessible and enjoyable while building the skills that lead to real tournament success and personal growth.
          </p>
          <div className="about-highlights">
            <div className="highlight-item">
              <div className="highlight-icon"><FiAward /></div>
              <div className="highlight-text"><strong>Certified Chess Trainer</strong><span>Professional coaching certification</span></div>
            </div>
            <div className="highlight-item">
              <div className="highlight-icon"><FiUsers /></div>
              <div className="highlight-text"><strong>All Ages Welcome</strong><span>Kids (5+), teenagers & adults</span></div>
            </div>
            <div className="highlight-item">
              <div className="highlight-icon"><FiMonitor /></div>
              <div className="highlight-text"><strong>Online & In-Person</strong><span>Flexible learning options</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Lessons() {
  const cards = [
    { icon: <FiUser />, title: 'Private Lessons', desc: 'One-on-one sessions tailored to your level and goals.', features: ['Personalized curriculum', 'Flexible scheduling', 'Detailed game analysis', 'Homework & exercises'] },
    { icon: <FiUsers />, title: 'Group Classes', desc: 'Learn together in small groups of 3-6 students.', features: ['Interactive discussions', 'Practice games', 'Team problem solving', 'Friendly competition'] },
    { icon: <FiMonitor />, title: 'Online Training', desc: 'Professional coaching from anywhere in the world.', features: ['Live video sessions', 'Screen sharing analysis', 'Digital resources', 'Recording available'] },
    { icon: <FiAward />, title: 'Tournament Prep', desc: 'Intensive preparation for competitive play.', features: ['Opening repertoire', 'Time management', 'Psychological training', 'Mock tournaments'] },
  ];

  return (
    <section className="lessons-bg" id="lessons">
      <div className="section">
        <div className="section-header">
          <div className="section-tag">Lesson Format</div>
          <h2>How We Train</h2>
          <hr className="divider" />
          <p>Choose the format that works best for you</p>
        </div>
        <div className="lessons-grid">
          {cards.map((c, i) => (
            <div className="lesson-card" key={i}>
              <div className="lesson-icon">{c.icon}</div>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
              <ul className="lesson-features">
                {c.features.map((f, j) => <li key={j}><FiCheck className="check" /> {f}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Achievements() {
  const items = [
    { medal: '🥇', name: 'National Youth Championship', detail: '1st Place - U12', desc: 'Baku, 2024' },
    { medal: '🥈', name: 'City Rapid Tournament', detail: '2nd Place - Open', desc: 'Baku, 2024' },
    { medal: '🥇', name: 'School Chess Olympiad', detail: 'Team Gold Medal', desc: 'Regional, 2023' },
    { medal: '🏆', name: 'Online Blitz Championship', detail: 'Top 10 Finish', desc: 'International, 2023' },
    { medal: '🥇', name: 'Junior Classical Championship', detail: '1st Place - U14', desc: 'Baku, 2023' },
    { medal: '🎯', name: 'FIDE Rating Milestones', detail: '15+ Students Rated', desc: 'Ongoing Achievement' },
  ];

  return (
    <section className="section" id="achievements">
      <div className="section-header">
        <div className="section-tag">Student Success</div>
        <h2>Achievements & Awards</h2>
        <hr className="divider" />
        <p>Our students consistently shine in competitions</p>
      </div>
      <div className="achievements-grid">
        {items.map((a, i) => (
          <div className="achievement-card" key={i}>
            <div className="achievement-medal">{a.medal}</div>
            <h3>{a.name}</h3>
            <div className="achievement-detail">{a.detail}</div>
            <p>{a.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  const reviews = [
    { text: "My son has been taking lessons for 6 months and the improvement is incredible. He went from a complete beginner to winning his first tournament. Deniz is patient, knowledgeable, and truly cares about each student's progress.", name: 'Aysel M.', role: 'Parent of 10-year-old student', initials: 'AM' },
    { text: "The best investment we made in our child's education. Chess lessons here have improved not just her game but her concentration and problem-solving skills at school. Highly recommended!", name: 'Rashad K.', role: 'Parent of 8-year-old student', initials: 'RK' },
    { text: "Professional, structured, and fun. My teenager actually looks forward to chess class every week. The tournament preparation is excellent and results speak for themselves.", name: 'Leyla H.', role: 'Parent of 14-year-old student', initials: 'LH' },
    { text: "We started as complete beginners and now both my kids are competing in city tournaments. The group classes are well organized and the atmosphere is very supportive.", name: 'Farid A.', role: 'Parent of two students', initials: 'FA' },
  ];

  return (
    <section className="testimonials-bg" id="testimonials">
      <div className="section">
        <div className="section-header">
          <div className="section-tag">Testimonials</div>
          <h2>What Parents Say</h2>
          <hr className="divider" />
        </div>
        <div className="testimonials-grid">
          {reviews.map((r, i) => (
            <div className="testimonial-card" key={i}>
              <div className="testimonial-quote">"</div>
              <div className="testimonial-stars">{Array(5).fill(null).map((_, j) => <FiStar key={j} />)}</div>
              <p>{r.text}</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">{r.initials}</div>
                <div className="testimonial-author-info">
                  <strong>{r.name}</strong>
                  <span>{r.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Gallery() {
  const items = [
    { icon: <FiCamera />, label: 'Tournament Day' },
    { icon: <FiUsers />, label: 'Group Lesson' },
    { icon: <FiAward />, label: 'Award Ceremony' },
    { icon: <FiPlay />, label: 'Video Lesson' },
    { icon: <FiCamera />, label: 'Chess Camp' },
    { icon: <FiMonitor />, label: 'Online Session' },
  ];

  return (
    <section className="section" id="gallery">
      <div className="section-header">
        <div className="section-tag">Gallery</div>
        <h2>Photos & Videos</h2>
        <hr className="divider" />
        <p>Moments from our academy</p>
      </div>
      <div className="gallery-grid">
        {items.map((g, i) => (
          <div className="gallery-item" key={i}>
            <div className="gallery-placeholder">
              <span className="gallery-placeholder-icon">{g.icon}</span>
              <span className="gallery-placeholder-text">Add {g.label} Photo</span>
            </div>
            <div className="gallery-overlay"><span>{g.label}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Materials() {
  const books = [
    { icon: '📘', title: 'Chess Fundamentals', desc: 'Essential tactics and strategy for beginners', tag: 'Beginner' },
    { icon: '📗', title: 'Winning Endgames', desc: 'Master the most critical phase of the game', tag: 'Intermediate' },
    { icon: '📕', title: 'Opening Repertoire', desc: 'Build a solid opening system step by step', tag: 'All Levels' },
    { icon: '📙', title: 'Puzzle Workbook', desc: '500+ tactical puzzles with solutions', tag: 'Practice' },
    { icon: '🎥', title: 'Video Course Library', desc: 'Recorded lessons on key topics', tag: 'Digital' },
    { icon: '📋', title: 'Study Plans', desc: 'Structured weekly improvement plans', tag: 'Guided' },
  ];

  return (
    <section className="materials-bg" id="materials">
      <div className="section">
        <div className="section-header">
          <div className="section-tag">Resources</div>
          <h2>Books & Materials</h2>
          <hr className="divider" />
          <p>Curated resources to accelerate your growth</p>
        </div>
        <div className="materials-grid">
          {books.map((b, i) => (
            <div className="material-card" key={i}>
              <div className="material-icon">{b.icon}</div>
              <h3>{b.title}</h3>
              <p>{b.desc}</p>
              <span className="material-tag">{b.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      title: 'Starter',
      desc: 'Perfect for beginners',
      price: '60',
      period: '/month',
      features: ['4 group lessons/month', 'Basic study materials', 'Online puzzle access', 'Progress reports'],
      featured: false,
    },
    {
      title: 'Pro',
      desc: 'Most popular choice',
      price: '120',
      period: '/month',
      features: ['4 private lessons/month', '2 group sessions free', 'Full material access', 'Game analysis', 'Tournament guidance'],
      featured: true,
    },
    {
      title: 'Elite',
      desc: 'For competitive players',
      price: '200',
      period: '/month',
      features: ['8 private lessons/month', 'Unlimited group access', 'All materials included', 'Tournament preparation', 'Priority scheduling', 'Monthly assessment'],
      featured: false,
    },
  ];

  return (
    <section className="section" id="pricing">
      <div className="section-header">
        <div className="section-tag">Packages</div>
        <h2>Pricing Plans</h2>
        <hr className="divider" />
        <p>Flexible plans to fit your goals and budget</p>
      </div>
      <div className="pricing-grid">
        {plans.map((p, i) => (
          <div className={`price-card ${p.featured ? 'featured' : ''}`} key={i}>
            {p.featured && <div className="price-badge">Popular</div>}
            <h3>{p.title}</h3>
            <div className="price-desc">{p.desc}</div>
            <div className="price-amount">{p.price} AZN <span>{p.period}</span></div>
            <ul className="price-features">
              {p.features.map((f, j) => <li key={j}><FiCheck className="check" /> {f}</li>)}
            </ul>
            <a href="#register" className={`price-btn ${p.featured ? 'primary' : 'outline'}`}>Get Started</a>
          </div>
        ))}
      </div>
    </section>
  );
}

function Registration() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', age: '', level: '', package: '', message: '' });

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = e => {
    e.preventDefault();
    const text = `New Registration:\nName: ${form.name}\nEmail: ${form.email}\nPhone: ${form.phone}\nAge: ${form.age}\nLevel: ${form.level}\nPackage: ${form.package}\nMessage: ${form.message}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, '_blank');
    setSubmitted(true);
  };

  return (
    <section className="registration-bg" id="register">
      <div className="section">
        <div className="section-header">
          <div className="section-tag">Enroll Now</div>
          <h2>Registration</h2>
          <hr className="divider" />
        </div>
        <div className="reg-container">
          <div className="reg-info">
            <h3>Ready to Begin Your Chess Journey?</h3>
            <p>Fill out the form and we'll get back to you within 24 hours to schedule your first lesson. Trial lesson available!</p>
            <div className="reg-contact-item">
              <div className="reg-contact-icon"><FiPhone /></div>
              <div className="reg-contact-text"><strong>Phone / WhatsApp</strong><span>+994 XX XXX XX XX</span></div>
            </div>
            <div className="reg-contact-item">
              <div className="reg-contact-icon"><FiMail /></div>
              <div className="reg-contact-text"><strong>Email</strong><span>info@cosmochess.academy</span></div>
            </div>
            <div className="reg-contact-item">
              <div className="reg-contact-icon"><FiMapPin /></div>
              <div className="reg-contact-text"><strong>Location</strong><span>Baku, Azerbaijan</span></div>
            </div>
            <div className="reg-contact-item">
              <div className="reg-contact-icon"><FiClock /></div>
              <div className="reg-contact-text"><strong>Working Hours</strong><span>Mon–Sat, 10:00 – 20:00</span></div>
            </div>
          </div>
          <div className="reg-form">
            {submitted ? (
              <div className="form-success">
                <div className="success-icon">✓</div>
                <h3>Thank You!</h3>
                <p>Your registration has been sent via WhatsApp. We'll respond shortly!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input name="name" value={form.name} onChange={handleChange} placeholder="Your name" required />
                  </div>
                  <div className="form-group">
                    <label>Phone *</label>
                    <input name="phone" value={form.phone} onChange={handleChange} placeholder="+994 XX XXX XX XX" required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="your@email.com" />
                  </div>
                  <div className="form-group">
                    <label>Student Age *</label>
                    <input name="age" value={form.age} onChange={handleChange} placeholder="e.g. 10" required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Chess Level</label>
                    <select name="level" value={form.level} onChange={handleChange}>
                      <option value="">Select level</option>
                      <option>Complete Beginner</option>
                      <option>Beginner</option>
                      <option>Intermediate</option>
                      <option>Advanced</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Preferred Package</label>
                    <select name="package" value={form.package} onChange={handleChange}>
                      <option value="">Select package</option>
                      <option>Starter (60 AZN/mo)</option>
                      <option>Pro (120 AZN/mo)</option>
                      <option>Elite (200 AZN/mo)</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Message</label>
                  <textarea name="message" value={form.message} onChange={handleChange} placeholder="Any questions or special requests..." />
                </div>
                <button type="submit" className="submit-btn">Submit & Contact via WhatsApp</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-brand">
          <a href="#hero" className="nav-logo">
            <FaChessKnight className="nav-logo-icon" />
            <div className="nav-logo-text">Cosmo <span>Chess</span></div>
          </a>
          <p>Professional chess training for all ages. Building champions one move at a time.</p>
          <div className="footer-social">
            <a href="#!" aria-label="Instagram"><FaInstagram /></a>
            <a href="#!" aria-label="WhatsApp"><FaWhatsapp /></a>
            <a href="#!" aria-label="Telegram"><FaTelegram /></a>
            <a href="#!" aria-label="YouTube"><FaYoutube /></a>
          </div>
        </div>
        <div className="footer-col">
          <h4>Quick Links</h4>
          <ul>
            <li><a href="#about">About</a></li>
            <li><a href="#lessons">Lessons</a></li>
            <li><a href="#achievements">Achievements</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#register">Register</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Contact</h4>
          <ul>
            <li><a href={`https://wa.me/${WHATSAPP_NUMBER}`}>WhatsApp</a></li>
            <li><a href="mailto:info@cosmochess.academy">Email</a></li>
            <li><a href="#register">Baku, Azerbaijan</a></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        &copy; {new Date().getFullYear()} Cosmo Chess Academy. All rights reserved.
      </div>
    </footer>
  );
}

function ThemeSwitcher({ theme, setTheme }) {
  const light = THEMES.filter(t => !t.dark);
  const dark = THEMES.filter(t => t.dark);
  return (
    <div className="theme-switcher">
      <div className="theme-group-label">Light</div>
      {light.map(t => (
        <button key={t.id} className={`theme-btn ${theme === t.id ? 'active' : ''}`} onClick={() => setTheme(t.id)}>
          <span className="theme-dot" style={{ background: t.color }} />
          {t.label}
        </button>
      ))}
      <div className="theme-group-label">Dark</div>
      {dark.map(t => (
        <button key={t.id} className={`theme-btn ${theme === t.id ? 'active' : ''}`} onClick={() => setTheme(t.id)}>
          <span className="theme-dot" style={{ background: t.color, border: '2px solid rgba(255,255,255,0.3)' }} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('cosmo-theme') || 'warm');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cosmo-theme', theme);
  }, [theme]);

  return (
    <>
      <ThemeSwitcher theme={theme} setTheme={setTheme} />
      <Navbar />
      <Hero />
      <About />
      <Lessons />
      <Achievements />
      <Testimonials />
      <Gallery />
      <Materials />
      <Pricing />
      <Registration />
      <Footer />
      <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="whatsapp-float" target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp">
        <FaWhatsapp />
      </a>
    </>
  );
}

export default App;
