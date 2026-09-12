import re

with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace specific phrases first
content = content.replace("AKTU-affiliated students", "university students")
content = content.replace("the AKTU ecosystem", "students")
content = content.replace("AKTU-affiliated colleges", "universities")
content = content.replace("AKTU alumni", "university alumni")
content = content.replace("AKTU events", "university events")
content = content.replace("at AKTU", "at your university")
content = content.replace("across AKTU", "across universities")
content = content.replace("AKTU", "University")

with open('Frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Replaced AKTU references.")
