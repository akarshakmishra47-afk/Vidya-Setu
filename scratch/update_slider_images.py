import re

with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Update slides array
content = content.replace('"/images/hero-campus-community.jpg"', '"/images/nobg_slide1.png"')
content = content.replace('"/images/hero-ai-study-planner.jpg"', '"/images/nobg_slide4.png"')
content = content.replace('"/images/hero-career-compass.jpg"', '"/images/nobg_slide3.png"')
content = content.replace('"/images/hero-scholarship-hub.jpg"', '"/images/nobg_slide2.png"')

# Update CSS for hero-art img
old_css = ".landing-page-wrapper .hero-art img { position:absolute; bottom:0; left:50%; transform:translateX(-50%); height:88%; width:auto; }"

new_css = ".landing-page-wrapper .hero-art img { position:absolute; bottom:0; left:50%; transform:translateX(-50%); height:95%; width:auto; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.4)); }"

if old_css in content:
    content = content.replace(old_css, new_css)
else:
    print("Could not find old CSS. Attempting regex...")
    # fallback
    content = re.sub(r'\.landing-page-wrapper \.hero-art img\s*\{[^}]+\}', new_css, content)

with open('Frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated index.html")
