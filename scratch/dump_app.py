with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('function AppWithProviders() {')
end = content.find('root.render(<AppWithProviders />);')

with open('scratch/app_with_providers.txt', 'w', encoding='utf-8') as f:
    f.write(content[start:start+10000])
