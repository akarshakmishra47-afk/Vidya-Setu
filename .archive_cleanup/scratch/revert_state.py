with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_state = 'const initialHash = window.location.hash.replace("#", "");\n      const [showLandingPage, setShowLandingPage] = useState(initialHash === "" || initialHash === "home");'
new_state = 'const [showLandingPage, setShowLandingPage] = useState(true);'

if old_state in content:
    content = content.replace(old_state, new_state)
    with open('Frontend/index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully reverted showLandingPage state initialization.")
else:
    print("Could not find old_state.")
