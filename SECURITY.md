# Security Policy

## Supported Versions
Vidya-Setu currently supports security updates for the `main` branch.

## Reporting a Vulnerability
If you discover any security vulnerabilities in the Vidya-Setu platform, please do not disclose it publicly. 

Please report all security issues to the project maintainers directly via email or private issue tracker. 

### What to include in your report:
- A clear description of the vulnerability.
- Steps to reproduce the issue.
- Potential impact of the vulnerability.
- (Optional) Suggested mitigations or fixes.

You should receive an acknowledgment within 48 hours.

## Security Practices
- **Authentication:** All secure endpoints are protected using JWT (JSON Web Tokens) in HttpOnly cookies, guarding against XSS.
- **Authorization:** Admin-only routes require both a valid JWT and an `isAdmin: true` flag. 
- **Data Access:** Endpoints returning sensitive student data (like `AktuStudentOtr` or `ScholarshipApplication`) enforce strict Ownership checks (IDOR protection) ensuring students can only view their own data.
- **Input Validation:** AI routes and core data mutation endpoints validate inputs strictly to prevent prompt injection and NoSQL injection attacks.
- **Secrets Management:** We do not commit `.env` files or API keys. Always use `.env.example` as a template.
