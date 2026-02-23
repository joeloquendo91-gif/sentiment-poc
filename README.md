# Sentiment Analysis POC
### Scrape → Classify → Analyze in one pipeline

---

## What This Does

Paste any URL from Reddit, G2, Capterra, or Trustpilot.
Get back structured JSON with:
- Overall sentiment + score (1-10)
- Themes with per-theme sentiment
- Pain points, praise points
- Competitor mentions
- Feature requests
- A stakeholder-ready summary

---

## Setup Steps

### 1. Get Your API Keys

**Firecrawl** (scraping)
- Go to https://firecrawl.dev
- Sign up → Dashboard → API Keys
- Free tier: 500 pages/month — plenty for POC

**Anthropic** (Claude analysis)
- Go to https://console.anthropic.com
- Sign up → API Keys → Create Key
- Add $5 credit — each analysis costs ~$0.01-0.03

---

### 2. Clone / Create the Project

```bash
mkdir sentiment-poc
cd sentiment-poc
# copy the pipeline.mjs, package.json, .env.example files here
```

---

### 3. Install Dependencies

```bash
npm install
```

---

### 4. Set Up Environment Variables

```bash
cp .env.example .env
```

Open `.env` and add your keys:
```
FIRECRAWL_API_KEY=fc-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

---

### 5. Load Your .env (Important!)

The script reads env vars from your shell. Load them before running:

```bash
export $(cat .env | xargs)
```

Or install dotenv and add `import 'dotenv/config'` to the top of pipeline.mjs:
```bash
npm install dotenv
```
Then add this as the very first line of pipeline.mjs:
```js
import 'dotenv/config';
```

---

### 6. Run It

```bash
node pipeline.mjs <url>
```

**Examples to try:**
```bash
# G2 reviews
node pipeline.mjs https://www.g2.com/products/notion/reviews

# Reddit thread
node pipeline.mjs https://www.reddit.com/r/projectmanagement/comments/[any-thread]

# Capterra
node pipeline.mjs https://www.capterra.com/p/[product]/reviews/
```

---

## Expected Output

```
🔍 Scraping: https://www.g2.com/products/notion/reviews
✅ Extracted 6420 characters

🤖 Analyzing with Claude...

════════════════════════════════════════════════════════════
📊 ANALYSIS RESULTS
════════════════════════════════════════════════════════════
URL:        https://www.g2.com/products/notion/reviews
Source:     g2
Sentiment:  🟡 MIXED (6/10)
Confidence: high

📌 SUMMARY
Users appreciate Notion's flexibility and all-in-one approach...

💬 KEY QUOTE
"It does everything but the learning curve is steep..."

🏷️  THEMES
  🟢 flexibility — positive
  🔴 onboarding — negative
  🟢 pricing — positive

🔴 PAIN POINTS
  • Steep learning curve for new users
  • Mobile app feels sluggish

🟢 PRAISE POINTS
  • Highly customizable workspace
  • Great for team wikis

⚔️  COMPETITOR MENTIONS
  • Confluence
  • Airtable

📦 RAW JSON OUTPUT (for Supabase/dashboard):
{ ... }
```

---

## Troubleshooting

**"Not enough content extracted"**
→ The page needs authentication or heavy JS rendering. Try a different URL or use Firecrawl's `waitFor` option.

**"Claude returned non-JSON"**
→ Rare. The prompt handles this but if it happens, the raw text will print — usually a timeout issue.

**Firecrawl 402 error**
→ Free tier exhausted. Check your dashboard at firecrawl.dev.

---

## Next Steps After POC Works

1. Store output in Supabase (add `@supabase/supabase-js`)
2. Build a simple Next.js UI to paste URLs
3. Add batch processing (loop over array of URLs)
4. Add Vercel deployment
5. Build the stakeholder dashboard