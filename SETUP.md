# Rinqr B2B Setup — Copy-Paste Terminal Commands
# Follow these IN ORDER. Each step takes 2–5 minutes.

# ════════════════════════════════════════════════
# STEP 1 — Sign up for Resend (do this in browser)
# ════════════════════════════════════════════════
# 1. Go to https://resend.com and sign up
# 2. Click "API Keys" → "Create API Key" → name it "rinqr-leads"
# 3. COPY THE KEY (starts with re_) — you need it below

# ════════════════════════════════════════════════
# STEP 2 — Add secrets to Cloudflare
# Run each command, paste the value when prompted
# ════════════════════════════════════════════════

npx wrangler secret put RESEND_API_KEY
# Paste your re_xxxxx key from Resend

npx wrangler secret put ADMIN_KEY
# Make up any long secret, e.g: rinqr-admin-2026-xk9q
# SAVE THIS — you need it to create properties later

# ════════════════════════════════════════════════
# STEP 3 — Create KV namespace
# ════════════════════════════════════════════════

npx wrangler kv namespace create "RINQR_DB"
# This prints an id like: "id": "abc123..."
# COPY THAT ID and paste it into wrangler.jsonc
# where it says: "id": "PASTE_YOUR_KV_ID_HERE"

# ════════════════════════════════════════════════
# STEP 4 — Create D1 database
# ════════════════════════════════════════════════

npx wrangler d1 create rinqr-db
# This prints a database_id like: "database_id": "xyz789..."
# COPY THAT ID and paste it into wrangler.jsonc
# where it says: "database_id": "PASTE_YOUR_D1_ID_HERE"

# ════════════════════════════════════════════════
# STEP 5 — Create the database tables
# ════════════════════════════════════════════════

npx wrangler d1 execute rinqr-db --file=schema.sql
# You should see: ✅ Executed SQL

# ════════════════════════════════════════════════
# STEP 6 — Deploy everything
# ════════════════════════════════════════════════

npx wrangler deploy
# Your site + all API functions are now live

# ════════════════════════════════════════════════
# STEP 7 — Test the contact form
# ════════════════════════════════════════════════
# Go to your live site → property.html → fill out the form
# You should receive an email at yatish@getrinqr.com

# If it fails, run this to see live error logs:
npx wrangler tail

# ════════════════════════════════════════════════
# STEP 8 — Create your first B2B property
# (do this after a pilot is confirmed)
# ════════════════════════════════════════════════

# Replace the values below with the real property info:
curl -X POST https://rinqr.workers.dev/api/admin/create-property \
  -H "Content-Type: application/json" \
  -H "x-admin-key: YOUR_ADMIN_KEY_HERE" \
  -d '{
    "name": "Oak Ridge Apartments",
    "address": "1240 Oak Ridge Blvd, Edison NJ 08820",
    "managerEmail": "manager@oakridge.com",
    "units": 120
  }'

# The response gives you:
#   property.code      → e.g. "OAKRID26" — give this to the property manager
#   instructions.dashboardUrl  → send this URL to the manager
#   instructions.activationNote → what to tell residents

# ════════════════════════════════════════════════
# DONE! What the property manager gets:
# ════════════════════════════════════════════════
# 1. A property code (e.g. OAKRID26) to distribute to residents
# 2. A dashboard URL: getrinqr.com/property.html?id=THEIR_ID
#    (shows real scan data once residents start activating tags)
# 3. Residents go to getrinqr.com/activate.html and enter the code
#    — their tag automatically links to the property

# ════════════════════════════════════════════════
# TROUBLESHOOTING
# ════════════════════════════════════════════════
# See live logs:         npx wrangler tail
# Query D1 database:     npx wrangler d1 execute rinqr-db --command="SELECT * FROM tags"
# List KV keys:          npx wrangler kv key list --binding=RINQR_DB
