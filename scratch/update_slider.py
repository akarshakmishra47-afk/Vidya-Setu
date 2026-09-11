import re
import os

with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('const LandingPage =')
end = content.find('function AppWithProviders() {')

lp_code = content[start:end]

# New slides array using the uploaded banners
new_slides_code = """  const slides = [
    { image: "images/slider_1.png" },
    { image: "images/slider_2.png" },
    { image: "images/slider_3.png" },
    { image: "images/slider_4.png" }
  ];"""

lp_code = re.sub(r'const slides = \[.*?\];', new_slides_code, lp_code, flags=re.DOTALL)

# New hero section - full width edge-to-edge
new_hero = """      <section className="hero" id="top" style={{ padding: 0, position: 'relative', width: '100%', overflow: 'hidden' }}>
        <div style={{ width: '100%', display: 'flex', transition: 'transform 0.5s ease-in-out', transform: `translateX(-${currentSlide * 100}%)` }}>
          {slides.map((s, i) => (
            <img 
              key={i} 
              src={s.image} 
              alt={`Slide ${i+1}`} 
              style={{ width: '100%', flexShrink: 0, objectFit: 'cover' }} 
            />
          ))}
        </div>

        <div className="dots" style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '8px', zIndex: 10, paddingTop: 0 }}>
          {slides.map((_, i) => (
            <button key={i} className={`dot ${i === currentSlide ? 'active' : ''}`} aria-label={`Show slide ${i + 1}`} onClick={() => setCurrentSlide(i)} style={{ width: i === currentSlide ? '22px' : '8px', height: '8px', borderRadius: i === currentSlide ? '4px' : '50%', background: i === currentSlide ? 'var(--gold)' : 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.3s ease' }} />
          ))}
        </div>
      </section>"""

lp_code = re.sub(r'<section className="hero" id="top">.*?</section>', new_hero, lp_code, flags=re.DOTALL)

# Also fix the background color to white if they want a clean layout or just leave the rest of the styles.
# The user just wants the hero section changed.
content = content[:start] + lp_code + content[end:]

with open('Frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done replacing slider.")
