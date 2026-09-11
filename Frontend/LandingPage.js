const LandingPage = () => {
  const [currentSlide, setCurrentSlide] = React.useState(0);
  
  const slides = [
    {
      badge: "Campus Community",
      headline: "Find the right opportunities for your next big step.",
      image: "/images/hero-campus-community.jpg",
      bullets: [
        "Discover scholarships, internships, and student perks",
        "Connect with students across the AKTU ecosystem",
        "Save useful resources in one focused dashboard",
        "Build your path with practical guidance"
      ]
    },
    {
      badge: "AI Study Planner",
      headline: "Know exactly what to study before you open a single book.",
      image: "/images/hero-ai-study-planner.jpg",
      bullets: [
        "AI-ranked topics from 3 years of verified previous-year papers",
        "400+ live jobs & internships, refreshed every 24 hours",
        "Resume strength scoring with a personalized roadmap",
        "Scholarships filtered to what you're actually eligible for"
      ]
    },
    {
      badge: "Career Compass",
      headline: "See exactly which skills stand between you and your target role.",
      image: "/images/hero-career-compass.jpg",
      bullets: [
        "Skill-gap analysis against real job requirements",
        "AI resume review with a strength score out of 100",
        "A personalized project and learning roadmap",
        "Track your readiness over time"
      ]
    },
    {
      badge: "Scholarship Hub",
      headline: "Stop missing scholarship deadlines you actually qualify for.",
      image: "/images/hero-scholarship-hub.jpg",
      bullets: [
        "Government, defence, and private scholarships in one place",
        "Eligibility and deadlines shown upfront",
        "Step-by-step application guides",
        "AI troubleshooting for common form errors"
      ]
    }
  ];

  React.useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const check = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffc94d" strokeWidth="3">
      <path d="M4 12l5 5L20 6" />
    </svg>
  );

  const activeSlide = slides[currentSlide];

  return (
    <div className="landing-page-wrapper">
      <style dangerouslySetInnerHTML={{__html: `
        .landing-page-wrapper {
          --ink:#20140f;
          --paper:#fffaf5;
          --paper-dim:#fff2e6;
          --maroon-1:#7a1120;
          --maroon-2:#3a0a10;
          --gold:#ffc94d;
          --gold-deep:#e8a400;
          --accent:#ff5a1f;
          --accent-fg:#3a2400;
          --muted:#6b5f57;
          --border:#f0e2d4;

          --purple-bg:#ece5ff; --purple-fg:#6f4dfb;
          --yellow-bg:#fff2cf; --yellow-fg:#c98a00;
          --teal-bg:#dcf6ea;   --teal-fg:#159a63;
          --pink-bg:#ffe3ec;   --pink-fg:#e0447a;
          --peach-bg:#ffe6d8;  --peach-fg:#ff5a1f;
          --blue-bg:#e2edff;   --blue-fg:#3d6fe0;

          --font-display:'Baloo 2', sans-serif;
          --font-body:'Inter', sans-serif;
          --maxw:1200px;
          font-family: var(--font-body);
          color: var(--ink);
          background: var(--paper);
          line-height: 1.55;
          min-height: 100vh;
          overflow-x: hidden;
        }
        .landing-page-wrapper * { box-sizing:border-box; }
        .landing-page-wrapper a { color:inherit; text-decoration:none; }
        .landing-page-wrapper ul { margin:0; padding:0; list-style:none; }
        .landing-page-wrapper img, .landing-page-wrapper svg { display:block; }
        .landing-page-wrapper button { font:inherit; }

        .landing-page-wrapper .btn { font-family:var(--font-body); font-size:.95rem; font-weight:700; border-radius:10px;
              padding:13px 26px; cursor:pointer; border:none; display:inline-flex; align-items:center; gap:8px; }
        .landing-page-wrapper .btn-gold { background:var(--gold); color:var(--accent-fg); }
        .landing-page-wrapper .btn-gold:hover { background:var(--gold-deep); }
        .landing-page-wrapper .btn-outline-light { background:transparent; border:1.5px solid rgba(255,255,255,.5); color:#fff; }

        .landing-page-wrapper .nav { background:#fff; border-bottom:1px solid var(--border); position:sticky; top:0; z-index:60; }
        .landing-page-wrapper .nav-inner { max-width:var(--maxw); margin:0 auto; padding:12px 28px; display:flex; align-items:center; gap:30px; }
        .landing-page-wrapper .brand { display:flex; align-items:center; gap:10px; margin-right:8px; }
        .landing-page-wrapper .brand-mark { width:36px; height:36px; border-radius:9px; background:var(--ink);
                     display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .landing-page-wrapper .brand-word { font-family:var(--font-display); font-weight:700; font-size:1.1rem; color:var(--maroon-1); line-height:1.2; }
        .landing-page-wrapper .brand-tag { font-size:.7rem; color:var(--muted); line-height:1.2; }
        .landing-page-wrapper .nav-links { display:flex; align-items:center; gap:26px; flex:1; }
        .landing-page-wrapper .nav-links > a { font-size:.93rem; font-weight:600; color:var(--ink); }
        .landing-page-wrapper .nav-item { position:relative; }
        .landing-page-wrapper .campus-btn { display:flex; align-items:center; gap:4px; font-size:.93rem; font-weight:700; color:var(--accent);
                     border:1.5px solid var(--border); border-radius:8px; padding:7px 12px; background:transparent; cursor:pointer; }
        .landing-page-wrapper .chev { font-size:.65rem; opacity:.7; }
        .landing-page-wrapper .dropdown {
          position:absolute; top:100%; left:0; background:#fff; border:1px solid var(--border); border-radius:10px;
          min-width:200px; padding:8px; box-shadow:0 20px 40px -20px rgba(32,20,15,.35); margin-top:6px;
          opacity:0; visibility:hidden; transform:translateY(6px); transition:.15s ease;
        }
        .landing-page-wrapper .nav-item:hover .dropdown { opacity:1; visibility:visible; transform:translateY(0); }
        .landing-page-wrapper .dropdown a { display:block; padding:9px 12px; border-radius:7px; font-size:.9rem; color:var(--ink); }
        .landing-page-wrapper .dropdown a:hover { background:var(--paper-dim); }
        .landing-page-wrapper .nav-actions { display:flex; align-items:center; gap:12px; }
        .landing-page-wrapper .btn-login { background:transparent; border:1.5px solid var(--border); border-radius:8px; padding:9px 20px; font-weight:700; font-size:.9rem; color:var(--ink); }
        .landing-page-wrapper .btn-getstarted { background:var(--gold); color:var(--accent-fg); border-radius:8px; padding:9px 20px; font-weight:700; font-size:.9rem; }

        .landing-page-wrapper .hero { background:linear-gradient(135deg, var(--maroon-1), var(--maroon-2)); color:#fff; padding:52px 28px 52px; overflow:hidden; }
        .landing-page-wrapper .hero-inner { max-width:var(--maxw); margin:0 auto; display:grid; grid-template-columns:1.15fr .85fr; gap:40px; align-items:center; }
        .landing-page-wrapper .slide-badge { display:inline-block; background:var(--gold); color:var(--accent-fg); font-weight:700; font-size:.82rem;
                      letter-spacing:.03em; text-transform:uppercase; padding:6px 14px; border-radius:6px; margin-bottom:16px; }
        .landing-page-wrapper .slide-headline { font-family:var(--font-display); font-weight:700; font-size:clamp(1.8rem,3.4vw,2.6rem); line-height:1.2;
                          margin:0 0 20px; max-width:18ch; min-height:3.6em; }
        .landing-page-wrapper .slide-bullets { margin-bottom:22px; min-height:130px; }
        .landing-page-wrapper .slide-bullets li { display:flex; gap:10px; align-items:flex-start; font-size:.95rem; margin-bottom:10px; color:#f4e3da; }
        .landing-page-wrapper .slide-bullets svg { flex-shrink:0; margin-top:3px; }
        .landing-page-wrapper .price-row { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
        .landing-page-wrapper .free-tag { background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.25); border-radius:10px; padding:10px 16px; font-weight:700; }

        .landing-page-wrapper .hero-art { position:relative; aspect-ratio:4/3; border-radius:20px; overflow:hidden;
                   background:radial-gradient(circle at 70% 30%, rgba(255,201,77,.12), transparent 60%), var(--maroon-2); }
        .landing-page-wrapper .hero-art img { position:absolute; bottom:0; left:50%; transform:translateX(-50%); height:88%; width:auto; }
        .landing-page-wrapper .badge-tag { position:absolute; left:12px; bottom:12px; background:var(--gold); color:var(--accent-fg);
                               font-weight:700; font-size:.8rem; padding:6px 12px; border-radius:6px; }
        .landing-page-wrapper .stat-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px; }
        .landing-page-wrapper .stat-card { background:rgba(255,255,255,.1); border-radius:12px; padding:16px; }
        .landing-page-wrapper .stat-card .num { font-family:var(--font-display); font-weight:700; font-size:1.5rem; color:var(--gold); }
        .landing-page-wrapper .stat-card .label { font-size:.8rem; color:#f4e3da; }
        .landing-page-wrapper .ribbon { margin-top:12px; background:linear-gradient(90deg, var(--accent), var(--gold-deep));
                 color:var(--accent-fg); text-align:center; font-weight:700; font-size:.88rem; padding:10px; border-radius:8px; }

        .landing-page-wrapper .dots { display:flex; justify-content:center; gap:8px; padding-top:34px; }
        .landing-page-wrapper .dot { width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,.35); border:none; cursor:pointer; padding:0; }
        .landing-page-wrapper .dot.active { background:var(--gold); width:22px; border-radius:4px; }

        .landing-page-wrapper .popular-wrap { max-width:var(--maxw); margin:-40px auto 0; padding:0 28px; position:relative; z-index:5; }
        .landing-page-wrapper .popular-card { background:#fff; border-radius:20px; box-shadow:0 30px 60px -30px rgba(32,20,15,.35); padding:30px 30px 22px; }
        .landing-page-wrapper .popular-title { display:inline-block; background:var(--gold); color:var(--accent-fg); font-family:var(--font-display);
                         font-weight:700; font-size:1.05rem; padding:8px 18px; border-radius:10px; margin-bottom:20px; }
        .landing-page-wrapper .tile-row-wrap { position:relative; }
        .landing-page-wrapper .tile-row { display:flex; gap:16px; overflow-x:auto; scroll-behavior:smooth; padding-bottom:6px; scrollbar-width:none; }
        .landing-page-wrapper .tile-row::-webkit-scrollbar { display:none; }
        .landing-page-wrapper .tile { flex:0 0 190px; border-radius:14px; padding:20px; display:flex; flex-direction:column; gap:34px; cursor: pointer; text-decoration: none; }
        .landing-page-wrapper .tile-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,.6); }
        .landing-page-wrapper .tile-bottom { display:flex; justify-content:space-between; align-items:center; font-weight:700; font-size:.98rem; }
        .landing-page-wrapper .scroll-btn { position:absolute; top:50%; transform:translateY(-50%); width:34px; height:34px; border-radius:50%;
                     background:#fff; border:1px solid var(--border); box-shadow:0 8px 20px -10px rgba(32,20,15,.3); cursor:pointer; }
        .landing-page-wrapper .scroll-btn.left { left:-17px; } .landing-page-wrapper .scroll-btn.right { right:-17px; }

        .landing-page-wrapper .explore { max-width:var(--maxw); margin:0 auto; padding:72px 28px 20px; text-align:center; }
        .landing-page-wrapper .explore h2 { font-family:var(--font-display); font-weight:700; font-size:clamp(1.6rem,2.8vw,2.1rem); margin:0 0 6px; color:var(--maroon-1); }
        .landing-page-wrapper .explore .sub { color:var(--muted); margin:0 0 36px; font-size:.98rem; }
        .landing-page-wrapper .card-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; text-align:left; }
        .landing-page-wrapper .fcard { border:1px solid var(--border); border-radius:14px; overflow:hidden; background:#fff; cursor: pointer; text-decoration: none; display: block; color: inherit; }
        .landing-page-wrapper .fcard .bar { height:6px; }
        .landing-page-wrapper .fcard .body { padding:24px; }
        .landing-page-wrapper .fcard .icon-chip { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:16px; }
        .landing-page-wrapper .fcard h3 { font-family:var(--font-display); font-size:1.1rem; margin:0 0 8px; }
        .landing-page-wrapper .fcard p { color:var(--muted); font-size:.92rem; margin:0; }

        .landing-page-wrapper .cta-band { max-width:var(--maxw); margin:64px auto 0; padding:0 28px 90px; }
        .landing-page-wrapper .cta-box { background:linear-gradient(135deg,var(--maroon-1),var(--maroon-2)); border-radius:20px; padding:48px;
                  color:#fff; display:flex; justify-content:space-between; align-items:center; gap:28px; flex-wrap:wrap; }
        .landing-page-wrapper .cta-box h2 { font-family:var(--font-display); font-size:1.5rem; margin:0 0 8px; max-width:22ch; }
        .landing-page-wrapper .cta-box p { color:#f4e3da; margin:0; max-width:38ch; }
        .landing-page-wrapper .cta-actions { display:flex; gap:12px; flex-wrap:wrap; }

        .landing-page-wrapper footer { border-top:1px solid var(--border); padding:44px 28px 26px; }
        .landing-page-wrapper .footer-inner { max-width:var(--maxw); margin:0 auto; display:flex; justify-content:space-between; gap:36px; flex-wrap:wrap; }
        .landing-page-wrapper .footer-brand p { color:var(--muted); max-width:34ch; font-size:.88rem; margin-top:12px; }
        .landing-page-wrapper .footer-cols { display:flex; gap:48px; flex-wrap:wrap; }
        .landing-page-wrapper .footer-col h5 { font-size:.8rem; margin:0 0 10px; text-transform:uppercase; letter-spacing:.04em; color:var(--maroon-1); }
        .landing-page-wrapper .footer-col a { display:block; color:var(--muted); font-size:.88rem; margin-bottom:7px; }
        .landing-page-wrapper .footer-bottom { max-width:var(--maxw); margin:28px auto 0; padding-top:18px; border-top:1px solid var(--border);
                        font-size:.8rem; color:var(--muted); display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; }

        @media (max-width: 900px){
          .landing-page-wrapper .nav-links { display:none; }
          .landing-page-wrapper .hero-inner { grid-template-columns:1fr; }
          .landing-page-wrapper .card-grid { grid-template-columns:1fr; }
          .landing-page-wrapper .popular-wrap { margin-top:-24px; }
        }
      `}} />

      <header className="nav">
        <div className="nav-inner">
          <a className="brand" href="#">
            <span className="brand-mark" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
                <path d="M24 10 L42 19 L24 28 L6 19 Z" fill="#ff5a1f"/>
                <path d="M14 23 V32 Q24 38 34 32 V23" stroke="#ff5a1f" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="42" y1="19" x2="42" y2="30" stroke="#ffc94d" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="42" cy="32" r="2.2" fill="#ffc94d"/>
              </svg>
            </span>
            <span>
              <span className="brand-word">Vidya Setu</span><br/>
              <span className="brand-tag">Learn &bull; Grow &bull; Achieve</span>
            </span>
          </a>

          <nav className="nav-links">
            <a href="#jobs">Jobs & Internships</a>
            <a href="#prashna">GATE Insights</a>
            <a href="#karya">Career Compass</a>
            <div className="nav-item">
              <button className="campus-btn">Campus <span className="chev">&#9660;</span></button>
              <div className="dropdown">
                <a href="#bazaar">Campus Store</a>
                <a href="#chhatra">Student Perks</a>
                <a href="#community">Community Hub</a>
                <a href="#hub">Scholarship Hub</a>
              </div>
            </div>
          </nav>

          <div className="nav-actions">
            <a className="btn-login" href="#login">Login</a>
            <a className="btn-getstarted" href="#login">Get Started</a>
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="slide-badge">{activeSlide.badge}</span>
            <h1 className="slide-headline">{activeSlide.headline}</h1>
            <ul className="slide-bullets">
              {activeSlide.bullets.map((b, i) => (
                <li key={i}>{check}<span>{b}</span></li>
              ))}
            </ul>
            <div className="price-row">
              <span className="free-tag">Free for AKTU-affiliated students</span>
              <a className="btn btn-gold" href="#login">Get started free</a>
            </div>
          </div>

          <div>
            <div className="hero-art">
              <img src={activeSlide.image} alt="" onError={(e) => e.target.style.display='none'} />
              <span className="badge-tag">{activeSlide.badge}</span>
            </div>
            <div className="stat-row">
              <div className="stat-card"><div className="num">416+</div><div className="label">Live job openings</div></div>
              <div className="stat-card"><div className="num">76</div><div className="label">Student perks</div></div>
            </div>
            <div className="ribbon">Now live across AKTU-affiliated colleges</div>
          </div>
        </div>

        <div className="dots">
          {slides.map((_, i) => (
            <button key={i} className={`dot ${i === currentSlide ? 'active' : ''}`} aria-label={`Show slide ${i + 1}`} onClick={() => setCurrentSlide(i)} />
          ))}
        </div>
      </section>

      <div className="popular-wrap">
        <div className="popular-card">
          <span className="popular-title">Popular Modules</span>
          <div className="tile-row-wrap">
            <button className="scroll-btn left" onClick={(e) => e.target.nextElementSibling.scrollBy({left:-220,behavior:'smooth'})} aria-label="Scroll left">&#8592;</button>
            <div className="tile-row">
              <a href="#prashna" className="tile" style={{background:"#ece5ff"}}>
                <div className="tile-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6f4dfb" strokeWidth="2"><path d="M4 20V10M12 20V4M20 20v-7"/></svg></div>
                <div className="tile-bottom" style={{color:"#6f4dfb"}}>GATE Insights <span>&rsaquo;</span></div>
              </a>
              <a href="#karya" className="tile" style={{background:"#fff2cf"}}>
                <div className="tile-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c98a00" strokeWidth="2"><circle cx="12" cy="12" r="8"/></svg></div>
                <div className="tile-bottom" style={{color:"#c98a00"}}>Career Compass <span>&rsaquo;</span></div>
              </a>
              <a href="#hub" className="tile" style={{background:"#dcf6ea"}}>
                <div className="tile-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#159a63" strokeWidth="2"><path d="M8 21h8M12 17v4M6 4h12v4a6 6 0 0 1-12 0V4Z"/></svg></div>
                <div className="tile-bottom" style={{color:"#159a63"}}>Scholarship Hub <span>&rsaquo;</span></div>
              </a>
              <a href="#jobs" className="tile" style={{background:"#ffe3ec"}}>
                <div className="tile-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e0447a" strokeWidth="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></div>
                <div className="tile-bottom" style={{color:"#e0447a"}}>Jobs & Internships <span>&rsaquo;</span></div>
              </a>
              <a href="#bazaar" className="tile" style={{background:"#ffe6d8"}}>
                <div className="tile-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff5a1f" strokeWidth="2"><path d="M3 9h18l-1.6 9.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8L3 9Z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/></svg></div>
                <div className="tile-bottom" style={{color:"#ff5a1f"}}>Campus Store <span>&rsaquo;</span></div>
              </a>
              <a href="#community" className="tile" style={{background:"#e2edff"}}>
                <div className="tile-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3d6fe0" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.4 8.5 8.5 0 0 1-4-1L3 20l1.1-5.5A8.38 8.38 0 0 1 3.5 11 8.5 8.5 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/></svg></div>
                <div className="tile-bottom" style={{color:"#3d6fe0"}}>Community Hub <span>&rsaquo;</span></div>
              </a>
            </div>
            <button className="scroll-btn right" onClick={(e) => e.target.previousElementSibling.scrollBy({left:220,behavior:'smooth'})} aria-label="Scroll right">&#8594;</button>
          </div>
        </div>
      </div>

      <section className="explore" id="explore">
        <h2>Explore Vidya-Setu</h2>
        <p className="sub">Built for every branch across the AKTU ecosystem — not just CSE.</p>
        <div className="card-grid">
          <a href="#prashna" className="fcard">
            <div className="bar" style={{background:"#6f4dfb"}}></div>
            <div className="body">
              <div className="icon-chip" style={{background:"#ece5ff"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6f4dfb" strokeWidth="2"><path d="M4 20V10M12 20V4M20 20v-7"/></svg></div>
              <h3>GATE Insights</h3>
              <p>AI ranks topics from verified previous-year papers by branch, semester, and subject.</p>
            </div>
          </a>
          <a href="#karya" className="fcard">
            <div className="bar" style={{background:"#c98a00"}}></div>
            <div className="body">
              <div className="icon-chip" style={{background:"#fff2cf"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c98a00" strokeWidth="2"><circle cx="12" cy="12" r="8"/></svg></div>
              <h3>Career Compass</h3>
              <p>Get a readiness score, skill-gap breakdown, and a resume strength score out of 100.</p>
            </div>
          </a>
          <a href="#hub" className="fcard">
            <div className="bar" style={{background:"#159a63"}}></div>
            <div className="body">
              <div className="icon-chip" style={{background:"#dcf6ea"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#159a63" strokeWidth="2"><path d="M8 21h8M12 17v4M6 4h12v4a6 6 0 0 1-12 0V4Z"/></svg></div>
              <h3>Scholarship Hub</h3>
              <p>Government, defence, and private scholarships with deadlines and eligibility upfront.</p>
            </div>
          </a>
          <a href="#jobs" className="fcard">
            <div className="bar" style={{background:"#e0447a"}}></div>
            <div className="body">
              <div className="icon-chip" style={{background:"#ffe3ec"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e0447a" strokeWidth="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></div>
              <h3>Jobs & Internships</h3>
              <p>400+ real listings, refreshed daily, filterable by domain, location, and experience.</p>
            </div>
          </a>
          <a href="#bazaar" className="fcard">
            <div className="bar" style={{background:"#ff5a1f"}}></div>
            <div className="body">
              <div className="icon-chip" style={{background:"#ffe6d8"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff5a1f" strokeWidth="2"><path d="M3 9h18l-1.6 9.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8L3 9Z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/></svg></div>
              <h3>Campus Store</h3>
              <p>Buy and sell books, electronics, and tools directly with verified students.</p>
            </div>
          </a>
          <a href="#community" className="fcard">
            <div className="bar" style={{background:"#3d6fe0"}}></div>
            <div className="body">
              <div className="icon-chip" style={{background:"#e2edff"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3d6fe0" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.4 8.5 8.5 0 0 1-4-1L3 20l1.1-5.5A8.38 8.38 0 0 1 3.5 11 8.5 8.5 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/></svg></div>
              <h3>Community Hub</h3>
              <p>Ask doubts and get answers from students who've already cleared that exam.</p>
            </div>
          </a>
        </div>
      </section>

      <section className="cta-band">
        <div className="cta-box">
          <div>
            <h2>Built by students who were tired of ten open tabs.</h2>
            <p>Free for AKTU-affiliated students, and open source on GitHub.</p>
          </div>
          <div className="cta-actions">
            <a className="btn btn-gold" href="#login">Get started free</a>
            <a className="btn btn-outline-light" href="https://github.com/akarshakmishra47-afk/Vidya-Setu">View source</a>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            <a className="brand" href="#">
              <span className="brand-mark" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
                  <path d="M24 10 L42 19 L24 28 L6 19 Z" fill="#ff5a1f"/>
                  <path d="M14 23 V32 Q24 38 34 32 V23" stroke="#ff5a1f" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="42" y1="19" x2="42" y2="30" stroke="#ffc94d" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="42" cy="32" r="2.2" fill="#ffc94d"/>
                </svg>
              </span>
              <span className="brand-word">Vidya-Setu</span>
            </a>
            <p>A student portal unifying exam prep, scholarships, jobs, and campus life for the AKTU ecosystem.</p>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <h5>Product</h5>
              <a href="#prashna">GATE Insights</a>
              <a href="#karya">Career Compass</a>
              <a href="#hub">Scholarship Hub</a>
              <a href="#jobs">Jobs & Internships</a>
            </div>
            <div className="footer-col">
              <h5>Community</h5>
              <a href="#bazaar">Campus Store</a>
              <a href="#community">Community Hub</a>
              <a href="https://github.com/akarshakmishra47-afk/Vidya-Setu">GitHub</a>
            </div>
            <div className="footer-col">
              <h5>Account</h5>
              <a href="#login">Sign in</a>
              <a href="#login">Get started</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; 2026 Vidya-Setu. Built for the AKTU ecosystem.</span>
          <span>Study. Explore. Build your career. — all in one place.</span>
        </div>
      </footer>
    </div>
  );
};
