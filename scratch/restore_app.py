with open('scratch/head_app.txt', 'r', encoding='utf-8') as f:
    head_app = f.read()

with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('function App({ onLogout }) {')
end = content.find('function Login({ onLogin }) {')

if start != -1 and end != -1:
    new_content = content[:start] + head_app + content[end:]
    with open('Frontend/index.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully replaced App component.")
else:
    print("Failed to find boundaries in index.html.")
