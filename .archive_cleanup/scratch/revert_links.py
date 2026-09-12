import re

with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('const LandingPage =')
end = content.find('function AppWithProviders()')

if start != -1 and end != -1:
    lp_code = content[start:end]
    
    # Let's find some href="#..." target="_blank"
    matches = re.findall(r'href="#([a-zA-Z0-9_-]+)" target="_blank"', lp_code)
    print("Found targets:", matches)
    
    # We will replace `href="#\1" target="_blank"`
    # with `href="#\1" onClick={(e) => { e.preventDefault(); window.location.hash = "\1"; if (onLoginClick) onLoginClick(); }}`
    
    lp_code = re.sub(
        r'href="#([a-zA-Z0-9_-]+)" target="_blank"',
        r'href="#\1" onClick={(e) => { e.preventDefault(); window.location.hash = "\1"; if (onLoginClick) onLoginClick(); }}',
        lp_code
    )

    content = content[:start] + lp_code + content[end:]
    
    with open('Frontend/index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully reverted links in LandingPage.")
else:
    print("Could not find LandingPage")
