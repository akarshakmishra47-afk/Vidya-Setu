import re

with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add color to Login button
# In the navbar, the login button is: <a className="btn-login" href="#login" ...>Login</a>
# Let's change its class to "btn-getstarted" which has the gold background.
content = re.sub(
    r'<a className="btn-login" href="#login"(.*?)>Login</a>',
    r'<a className="btn-getstarted" href="#login"\1>Login</a>',
    content
)

# 2. Remove GitHub from Community
# It appears as: <a href="https://github.com/akarshakmishra47-afk/Vidya-Setu">GitHub</a>
content = content.replace(
    '<a href="https://github.com/akarshakmishra47-afk/Vidya-Setu">GitHub</a>',
    ''
)

# 3. Remove "View source"
# It appears as: <a className="btn btn-outline-light" href="https://github.com/akarshakmishra47-afk/Vidya-Setu">View source</a>
content = content.replace(
    '<a className="btn btn-outline-light" href="https://github.com/akarshakmishra47-afk/Vidya-Setu">View source</a>',
    ''
)

with open('Frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated index.html: Login button colored, GitHub and View source removed.")
