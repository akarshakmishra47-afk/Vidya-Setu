import re

with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find `<aside className="vs-sidebar`
matches = [m.start() for m in re.finditer(r'<aside className="vs-sidebar', content)]
print("aside vs-sidebar indices:", matches)

for m in matches:
    # Print a window around each match
    print("MATCH at", m)
    print(content[m-200:m+500])
