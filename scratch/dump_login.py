import re
with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()
start = content.find('function Login(')
end = content.find('function LandingPage(')
with open('scratch/login_component.txt', 'w', encoding='utf-8') as f:
    f.write(content[start:end])
