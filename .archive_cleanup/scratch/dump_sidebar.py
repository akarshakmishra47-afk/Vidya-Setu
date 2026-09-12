import re

with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

m = 479996
with open('scratch/sidebar_context.txt', 'w', encoding='utf-8') as f:
    f.write(content[m-2000:m+2000])
