import re

with open('Backend/routes/userRoutes.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix login
login_code_old = """    const { rollNo, password } = req.body;
    if (!rollNo || !password) {
      return res.status(400).json({ success: false, message: "Roll Number and Password are required." });
    }
    if (typeof rollNo !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: "Invalid input format." });
    }

    const user = await User.findOne({ rollNo });"""

login_code_new = """    const email = req.body.email || req.body.rollNo;
    const password = req.body.password;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and Password are required." });
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: "Invalid input format." });
    }

    const user = await User.findOne({ email: email }) || await User.findOne({ rollNo: email });"""

content = content.replace(login_code_old, login_code_new)

# Fix register
reg_old = """    const { name, rollNo, branch, year, email, password, securityQuestion, securityAnswer,
      mobileNumber, casteCategory, familyIncome, isFeeWaiver, domicileState,
      hasIncomeCertificate, course } = req.body;

    if (!password || !securityAnswer) {
      return res.status(400).json({ success: false, message: "Password and Security Answer are required." });
    }
    if (!name || !rollNo || !branch || !year || !email || !securityQuestion) {
      return res.status(400).json({ success: false, message: "All required fields must be provided." });
    }"""

reg_new = """    const { name, branch, year, email, password, securityQuestion, securityAnswer,
      mobileNumber, casteCategory, familyIncome, isFeeWaiver, domicileState,
      hasIncomeCertificate, course } = req.body;
      
    const rollNo = req.body.rollNo || email;

    if (!password || !securityAnswer) {
      return res.status(400).json({ success: false, message: "Password and Security Answer are required." });
    }
    if (!name || !branch || !year || !email || !securityQuestion) {
      return res.status(400).json({ success: false, message: "All required fields must be provided." });
    }"""

content = content.replace(reg_old, reg_new)


# Fix Forgot Password Question
forgot_old = """router.get('/forgot-password/question/:rollNo', async (req, res) => {
  try {
    if (!checkForgotPasswordRateLimit(req.ip)) {
      return res.status(429).json({ success: false, message: "Too many attempts. Please try again later." });
    }

    const rollNo = req.params.rollNo;
    if (!rollNo || typeof rollNo !== 'string' || rollNo.length > 50) {
      return res.status(400).json({ success: false, message: "Invalid roll number." });
    }

    const user = await User.findOne({ rollNo }).select('securityQuestion');"""

forgot_new = """router.get('/forgot-password/question/:email', async (req, res) => {
  try {
    if (!checkForgotPasswordRateLimit(req.ip)) {
      return res.status(429).json({ success: false, message: "Too many attempts. Please try again later." });
    }

    const email = req.params.email;
    if (!email || typeof email !== 'string' || email.length > 50) {
      return res.status(400).json({ success: false, message: "Invalid email." });
    }

    const user = await User.findOne({ email: email }) || await User.findOne({ rollNo: email });
    if (user) {
      user.securityQuestion = user.securityQuestion || "Security question not set";
    }"""

content = content.replace(forgot_old, forgot_new)


# Fix Forgot Password Reset
reset_old = """    const { rollNo, securityAnswer, newPassword } = req.body;
    if (!rollNo || !securityAnswer || !newPassword) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    const user = await User.findOne({ rollNo });"""

reset_new = """    const { email, rollNo, securityAnswer, newPassword } = req.body;
    const lookupEmail = email || rollNo;
    if (!lookupEmail || !securityAnswer || !newPassword) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    const user = await User.findOne({ email: lookupEmail }) || await User.findOne({ rollNo: lookupEmail });"""

content = content.replace(reset_old, reset_new)


with open('Backend/routes/userRoutes.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated userRoutes.js")
