with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('function App({ onLogout }) {')
end = content.find('function AppWithProviders() {')

with open('scratch/app_component.txt', 'w', encoding='utf-8') as f:
    f.write(content[start:end])
