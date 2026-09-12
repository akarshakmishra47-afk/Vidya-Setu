import re

with open('Frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract Login component
start = content.find('function Login(')
end = content.find('function LandingPage(')
login_code = content[start:end]

# 1. Update state and regData
login_code = login_code.replace('rollNo: "", branch:', 'branch:')
# 2. Update Forgot Password State
login_code = login_code.replace('rollNo: "", question:', 'email: "", question:')

# 3. Update handleLogin validation
login_code = login_code.replace('if (!email || !pass) return alert("Please enter both Roll Number and Password.");', 'if (!email || !pass) return alert("Please enter both Email and Password.");')
login_code = login_code.replace('if (!/^\\d{13}$/.test(email)) return alert("Roll Number must be exactly 13 digits.");', 'if (!email.toLowerCase().endsWith("@gmail.com")) return alert("Please use a valid @gmail.com address.");')

# 4. Update login payload
login_code = login_code.replace('body: JSON.stringify({ rollNo: email, password: pass })', 'body: JSON.stringify({ email: email, password: pass })')

# 5. Update userWithEmail
login_code = login_code.replace('if (data && data.user && data.user.rollNo) {', 'if (data && data.user) {')
login_code = login_code.replace('const userWithEmail = { ...data.user, email: data.user.email || (email.includes(\'@\') ? email : data.user.email || "") };', 'const userWithEmail = { ...data.user, email: email };')

# 6. Update handleRegister validation
login_code = login_code.replace('if (!regData.name || !regData.rollNo || !regData.email || !regData.pass || !regData.securityAnswer) {', 'if (!regData.name || !regData.email || !regData.pass || !regData.securityAnswer) {')
login_code = login_code.replace('if (!/^\\d{13}$/.test(regData.rollNo)) return alert("Roll Number must be exactly 13 digits.");', 'if (!regData.email.toLowerCase().endsWith("@gmail.com")) return alert("Please use a valid @gmail.com address.");')

# 7. Update register payload
login_code = login_code.replace('rollNo: regData.rollNo,', '')

# 8. Update register success
login_code = login_code.replace('setEmail(regData.rollNo);', 'setEmail(regData.email);')

# 9. Update closeForgot
login_code = login_code.replace('setForgotInfo({ rollNo: "", question: "", answer: "", newPass: "" });', 'setForgotInfo({ email: "", question: "", answer: "", newPass: "" });')

# 10. Update fetchForgotQuestion
login_code = login_code.replace('if (!forgotInfo.rollNo) return alert("Enter Roll Number first.");', 'if (!forgotInfo.email) return alert("Enter Email first.");')
login_code = login_code.replace('`${API_BASE_URL}/api/users/forgot-password/question/${forgotInfo.rollNo}`', '`${API_BASE_URL}/api/users/forgot-password/question/${forgotInfo.email}`')

# 11. Update handleForgotReset
login_code = login_code.replace('rollNo: forgotInfo.rollNo,', 'email: forgotInfo.email,')

# 12. Remove Roll Number field from Register UI completely
rollno_div = """                      <div>
                        <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, display: "block", letterSpacing: .8, textTransform: "uppercase" }}>Roll Number</label>
                        <input type="text" required value={regData.rollNo} onChange={e => setRegData(p => ({ ...p, rollNo: e.target.value }))} style={{ ...inpSt, marginTop: 6 }} placeholder="e.g. 2200123456789" />
                      </div>"""
login_code = login_code.replace(rollno_div, '')

# Change Grid layout of Register form (Name took 1fr 1fr, now it's just Name? Let's make it 1fr)
login_code = login_code.replace('<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>\n                      <div>\n                        <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, display: "block", letterSpacing: .8, textTransform: "uppercase" }}>Full Name</label>\n                        <input type="text" required value={regData.name} onChange={e => setRegData(p => ({ ...p, name: e.target.value }))} style={{ ...inpSt, marginTop: 6 }} placeholder="e.g. Dev Kumar" />\n                      </div>\n                    </div>', '<div>\n                        <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, display: "block", letterSpacing: .8, textTransform: "uppercase" }}>Full Name</label>\n                        <input type="text" required value={regData.name} onChange={e => setRegData(p => ({ ...p, name: e.target.value }))} style={{ ...inpSt, marginTop: 6 }} placeholder="e.g. Dev Kumar" />\n                      </div>')


# 13. Update Email Address placeholder in Register UI
login_code = login_code.replace('placeholder="you@aktu.ac.in"', 'placeholder="student@gmail.com"')

# 14. Update Login UI
login_code = login_code.replace('<label style={{ color: T.muted, fontSize: 11, fontWeight: 700, marginBottom: 6, display: "block", letterSpacing: .8, textTransform: "uppercase" }}>Roll Number</label>', '<label style={{ color: T.muted, fontSize: 11, fontWeight: 700, marginBottom: 6, display: "block", letterSpacing: .8, textTransform: "uppercase" }}>Email Address</label>')
login_code = login_code.replace('placeholder="e.g. 2200123456789"', 'placeholder="student@gmail.com"')

# 15. Update Forgot Password UI
login_code = login_code.replace('Enter your Roll Number to find your account.', 'Enter your Email to find your account.')
login_code = login_code.replace('placeholder="Roll Number" value={forgotInfo.rollNo}', 'placeholder="Email Address" value={forgotInfo.email}')
login_code = login_code.replace('onChange={e => setForgotInfo(p => ({ ...p, rollNo: e.target.value }))}', 'onChange={e => setForgotInfo(p => ({ ...p, email: e.target.value }))}')

# 16. Update tooltip "Please enter your registered Roll Number to log in"
login_code = login_code.replace('Please enter your registered Roll Number to log in.', 'Please enter your registered Email to log in.')


# Let's fix the grid for Full Name explicitly with regex to be safe
login_code = re.sub(
    r'<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>\s*<div>\s*<label[^>]*>Full Name</label>\s*<input[^>]*value=\{regData\.name\}[^>]*/>\s*</div>\s*</div>',
    r'<div>\n                        <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, display: "block", letterSpacing: .8, textTransform: "uppercase" }}>Full Name</label>\n                        <input type="text" required value={regData.name} onChange={e => setRegData(p => ({ ...p, name: e.target.value }))} style={{ ...inpSt, marginTop: 6 }} placeholder="e.g. Dev Kumar" />\n                      </div>',
    login_code
)

content = content[:start] + login_code + content[end:]

with open('Frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed Roll Number concept.")
