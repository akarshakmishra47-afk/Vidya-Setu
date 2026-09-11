with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('function AppWithProviders() {')
end = content.find('root.render(<AppWithProviders />);')
app_code = content[start:end]

start_return = app_code.find('return (')

with open('scratch/app_with_providers_return.txt', 'w', encoding='utf-8') as f:
    f.write(app_code[start_return:])
