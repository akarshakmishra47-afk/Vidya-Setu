import re
with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()
match = re.search(r'<a[^>]*href="#karya"[^>]*>', content)
if match:
    print(match.group(0))
