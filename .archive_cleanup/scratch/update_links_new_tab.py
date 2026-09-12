import re

with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('const LandingPage =')
end = content.find('function AppWithProviders()')

if start != -1 and end != -1:
    lp_code = content[start:end]
    
    # We want to replace `<a href="#<something>" onClick={...} ...>` with `<a href="#<something>" target="_blank" ...>`
    # The exact onClick we inserted is: `onClick={(e) => { e.preventDefault(); window.location.hash = "X"; if (onLoginClick) onLoginClick(); }}`
    
    # Find all a tags with href matching our pattern
    # It's safer to just replace the onClick completely and inject target="_blank"
    
    lp_code = re.sub(
        r'href="#([a-zA-Z0-9_-]+)"\s*onClick=\{\(e\)\s*=>\s*\{\s*e\.preventDefault\(\);\s*window\.location\.hash\s*=\s*"[^"]+";\s*if\s*\(onLoginClick\)\s*onLoginClick\(\);\s*\}\}',
        r'href="#\1" target="_blank"',
        lp_code
    )

    # There might be some that don't have the e.preventDefault (if they were added manually)
    lp_code = re.sub(
        r'href="#([a-zA-Z0-9_-]+)"\s*onClick=\{\(e\)\s*=>\s*\{\s*if\s*\(onLoginClick\)\s*onLoginClick\(\);\s*\}\}',
        r'href="#\1" target="_blank"',
        lp_code
    )

    content = content[:start] + lp_code + content[end:]
    
    # Now modify AppWithProviders
    start2 = content.find('function AppWithProviders() {')
    end2 = content.find('const [isLoggedIn, setIsLoggedIn]', start2)
    
    if start2 != -1 and end2 != -1:
        # replace `const [showLandingPage, setShowLandingPage] = useState(true);`
        # with `const initialHash = window.location.hash.replace("#", ""); const [showLandingPage, setShowLandingPage] = useState(initialHash === "" || initialHash === "home");`
        old_state = 'const [showLandingPage, setShowLandingPage] = useState(true);'
        new_state = 'const initialHash = window.location.hash.replace("#", "");\n      const [showLandingPage, setShowLandingPage] = useState(initialHash === "" || initialHash === "home");'
        content = content.replace(old_state, new_state)

    with open('Frontend/index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully replaced links with target='_blank' and updated AppWithProviders")
else:
    print("Could not find LandingPage")
