# Music Database — Restore Bundle

## Quick Start
1. Copy these files into your project folder.
2. Run MySQL schema:
   ```sql
   SOURCE /path/to/schema.sql;
   ```
3. Create `.env` from `.env.example` and fill DB credentials + SESSION_SECRET.
4. Install deps:
   ```bash
   npm i
   ```
5. Start the server:
   ```bash
   node session_based_auth.js
   ```
6. Open:
   - http://localhost:3000/signup.html
   - http://localhost:3000/login.html
   - http://localhost:3000/selectreview.html
   - http://localhost:3000/musicreview.html
   - http://localhost:3000/view_reviews.html?artistId=mgmt
