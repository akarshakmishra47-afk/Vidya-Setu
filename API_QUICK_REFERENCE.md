# Quick Reference: Job API Endpoints

## Base URL
```
http://localhost:5000/api/jobs
```

---

## 1. Get All Jobs (Default)
```bash
GET /api/jobs
```
**Returns:** Up to 100 jobs, sorted by newest first
**Response:**
```json
{
  "success": true,
  "count": 100,
  "jobs": [ {...}, {...} ]
}
```

---

## 2. Get Jobs with Limit
```bash
GET /api/jobs?limit=50
```
**Parameters:**
- `limit` (optional, max 500, default 100)

---

## 3. Filter by Type
```bash
# Get only internships
GET /api/jobs?type=internship

# Get only jobs
GET /api/jobs?type=job
```

---

## 4. Search Jobs
```bash
GET /api/jobs?search=react
```
**Searches in:** title, company, location, tags

**Examples:**
```bash
GET /api/jobs?search=python
GET /api/jobs?search=bangalore
GET /api/jobs?search=machine%20learning
```

---

## 5. Combined Filters
```bash
# Internships with limit 25
GET /api/jobs?type=internship&limit=25

# Search for Python internships
GET /api/jobs?type=internship&search=python

# All filters together
GET /api/jobs?type=internship&search=react&limit=50
```

---

## 6. Check Refresh Status
```bash
GET /api/jobs/status
```
**Returns:** Detailed refresh information
**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 95,
    "internships": 32,
    "jobs": 63,
    "remotive": 15,
    "arbeitnow": 18,
    "manual": 50,
    "web": 12
  },
  "refresh": {
    "isRefreshing": false,
    "lastRefreshTime": "2026-08-08T15:30:45.123Z",
    "lastRefreshError": null,
    "refreshIntervalMs": 3600000,
    "nextRefreshTime": "2026-08-08T16:30:45.123Z",
    "refreshDurationMs": 8945
  },
  "autoRefresh": {
    "enabled": true,
    "intervalMinutes": 60
  }
}
```

---

## 7. Manually Trigger Refresh
```bash
POST /api/jobs/refresh
```
**Returns:** Success status and updated stats
**Response:**
```json
{
  "success": true,
  "message": "Manual refresh completed",
  "result": {
    "status": "success",
    "jobsAdded": 97,
    "totalInDB": 147
  },
  "stats": {
    "total": 147,
    "internships": 42,
    "jobs": 105
  }
}
```

**Error if already refreshing:**
```json
{
  "error": "Refresh already in progress",
  "message": "Please wait for the current refresh to complete before triggering another."
}
```
(HTTP 429)

---

## 8. Create a Manual Job
```bash
POST /api/jobs
Content-Type: application/json

{
  "title": "Software Engineer Intern",
  "company": "Acme Tech",
  "location": "New Delhi",
  "salary": "₹15,000/mo",
  "badge": "New 🆕",
  "tags": ["Node.js", "React", "MongoDB"],
  "desc": "Join our team to build amazing products...",
  "primaryType": "Internship",
  "secondaryType": "Paid",
  "applyUrl": "https://example.com/apply",
  "deadline": "2026-09-30",
  "experience": "Fresher",
  "isAktu": true,
  "companyLogo": "https://example.com/logo.png"
}
```
**Note:** `source` is automatically set to `'manual'` and will never be auto-deleted

---

## 9. Get Single Job
```bash
GET /api/jobs/:id
```
Replace `:id` with MongoDB job ID
**Response:**
```json
{
  "success": true,
  "job": { ...job object... }
}
```

---

## 10. Delete a Job
```bash
DELETE /api/jobs/:id
```
Replace `:id` with MongoDB job ID
**Response:**
```json
{
  "success": true,
  "message": "Job deleted successfully"
}
```

---

## 11. Legacy: Get Stats Summary
```bash
GET /api/jobs/stats/summary
```
**Response:**
```json
{
  "total": 95,
  "paid": 25,
  "free": 7,
  "aktuJobs": 40,
  "webFetched": 12,
  "manual": 50
}
```

---

## 12. Legacy: Manual Fetch (fetch-latest)
```bash
POST /api/jobs/fetch-latest
```
**Note:** This is an alias for `/refresh`, kept for backward compatibility

---

## Environment Variables

Add to `.env` file in Backend folder:

```bash
# Change auto-refresh interval (in milliseconds)
# Default: 3600000 (60 minutes)
JOBS_REFRESH_MS=1800000  # 30 minutes
```

---

## Response Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (new job) |
| 400 | Bad request |
| 404 | Not found |
| 429 | Refresh in progress (try again later) |
| 500 | Server error |

---

## Example Usage (cURL)

```bash
# Test server connectivity
curl "http://localhost:5000/api/jobs/status"

# Get 10 internships
curl "http://localhost:5000/api/jobs?type=internship&limit=10"

# Search for React jobs
curl "http://localhost:5000/api/jobs?search=react&limit=20"

# Manually refresh
curl -X POST "http://localhost:5000/api/jobs/refresh"

# Create a new job
curl -X POST "http://localhost:5000/api/jobs" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Software Engineer",
    "company": "Tech Corp",
    "location": "Remote",
    "salary": "₹10,00,000",
    "badge": "Hot",
    "tags": ["Node.js"],
    "desc": "Join our team",
    "primaryType": "Job",
    "secondaryType": "Full-Time",
    "applyUrl": "https://example.com",
    "deadline": "2026-12-31",
    "experience": "Fresher",
    "isAktu": true,
    "companyLogo": ""
  }'
```

---

**Last Updated:** August 8, 2026
**API Version:** 1.0
**Auto-Refresh:** Enabled (60 minutes default)
