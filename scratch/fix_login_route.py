import re

with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove 'Get Started' from Navbar
content = re.sub(
    r'<a className="btn-getstarted" href="#login" onClick=\{\(e\) => \{ e\.preventDefault\(\); window\.location\.hash = "login"; if \(onLoginClick\) onLoginClick\(\); \}\}>Get Started</a>',
    '',
    content
)

# Remove 'Get started' from Footer
content = re.sub(
    r'<a href="#login" onClick=\{\(e\) => \{ e\.preventDefault\(\); window\.location\.hash = "login"; if \(onLoginClick\) onLoginClick\(\); \}\}>Get started</a>',
    '',
    content
)

# Update Login onLogin handler in AppWithProviders
old_login_handler = """        return <Login onLogin={(data) => {
          const fetchedData = data.user || data; 
          setIsLoggedIn(true);
          if (fetchedData) {"""

new_login_handler = """        return <Login onLogin={(data) => {
          const fetchedData = data.user || data; 
          setIsLoggedIn(true);
          
          if (window.location.hash.replace("#", "") === "login") {
            window.location.hash = "home";
          }
          
          if (fetchedData) {"""

content = content.replace(old_login_handler, new_login_handler)

with open('Frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated index.html to remove Get Started and fix login routing.")
