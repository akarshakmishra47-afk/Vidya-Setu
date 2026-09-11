import re
with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_str = "style={{ width: '100%', flexShrink: 0, objectFit: 'cover' }}"
new_str = "style={{ width: '100%', height: 'auto', display: 'block', flexShrink: 0 }}"
content = content.replace(old_str, new_str)

with open('Frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed image styling.")
