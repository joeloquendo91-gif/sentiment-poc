import 'dotenv/config';
// pipeline.mjs — Sentiment Analysis POC
// Run: node pipeline.mjs <url>
// Example: node pipeline.mjs https://www.reddit.com/r/hubspot/comments/abc123/

import Anthropic from "@anthropic-ai/sdk";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!FIRECRAWL_API_KEY || !ANTHROPIC_API_KEY) {
  console.error("❌ Missing env vars. Check your .env file.");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ─── STEP 1: SCRAPE ────────────────────────────────────────────────────────
async function scrapeUrl(url) {
  console.log(`\n🔍 Scraping: ${url}`);

  // Reddit has a free JSON API — no scraper needed
  if (url.includes("reddit.com")) {
    const jsonUrl = url.replace(/\/?$/, ".json") + "?limit=100";
    const res = await fetch(jsonUrl, {
      headers: { "User-Agent": "sentiment-poc/0.1" },
    });
    const data = await res.json();

    // Extract post title + all comment bodies
    const post = data[0]?.data?.children[0]?.data;
    const comments = data[1]?.data?.children || [];
    const commentText = comments
      .map((c) => c.data?.body)
      .filter(Boolean)
      .join("\n\n");

    const text = `POST: ${post?.title}\n\n${post?.selftext}\n\nCOMMENTS:\n${commentText}`;
    console.log(`✅ Extracted ${text.length} characters`);
    return text;
  }

  // Firecrawl for everything else
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });

  const data = await res.json();
  if (!data.success) throw new Error(`Firecrawl error: ${JSON.stringify(data)}`);

  const text = data.data?.markdown || "";
  console.log(`✅ Extracted ${text.length} characters`);
  return text;
}

// ─── STEP 2: DETECT SOURCE TYPE ────────────────────────────────────────────
function detectSource(url) {
  if (url.includes("reddit.com")) return "reddit";
  if (url.includes("g2.com")) return "g2";
  if (url.includes("capterra.com")) return "capterra";
  if (url.includes("trustpilot.com")) return "trustpilot";
  return "other";
}

// ─── STEP 3: ANALYZE WITH CLAUDE ───────────────────────────────────────────
async function analyzeContent(text, sourceType, url) {
  console.log(`\n🤖 Analyzing with Claude...`);

  // Truncate to avoid token limits — first 8000 chars is usually enough
  const truncatedText = text.slice(0, 8000);

  const prompt = `You are a brand sentiment analyst. Analyze the following content from ${sourceType} and return ONLY valid JSON with no markdown, no code blocks, no explanation.

Return this exact structure:
{
  "overall_sentiment": "positive" | "negative" | "mixed" | "neutral",
  "sentiment_score": <number 1-10, where 1=very negative, 10=very positive>,
  "confidence": "high" | "medium" | "low",
  "themes": ["<theme1>", "<theme2>"],
  "sentiment_per_theme": {
    "<theme>": "positive" | "negative" | "mixed" | "neutral"
  },
  "pain_points": ["<specific complaint or frustration>"],
  "praise_points": ["<specific positive mentioned>"],
  "competitor_mentions": ["<competitor name>"],
  "feature_requests": ["<requested feature or improvement>"],
  "key_quote": "<single most representative sentence from the content>",
  "summary": "<2-3 sentence plain english summary for a stakeholder>"
}

Content to analyze:
---
${truncatedText}
---`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const rawResponse = message.content[0].text;

  // Parse JSON — Claude should return clean JSON but we handle edge cases
  let parsed;
  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    // Try to extract JSON if there's any wrapper text
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Claude returned non-JSON response: " + rawResponse);
    }
  }

  return parsed;
}

// ─── STEP 4: DISPLAY RESULTS ───────────────────────────────────────────────
function displayResults(url, sourceType, analysis) {
  const sentimentEmoji = {
    positive: "🟢",
    negative: "🔴",
    mixed: "🟡",
    neutral: "⚪",
  };

  console.log("\n" + "═".repeat(60));
  console.log("📊 ANALYSIS RESULTS");
  console.log("═".repeat(60));
  console.log(`URL:        ${url}`);
  console.log(`Source:     ${sourceType}`);
  console.log(
    `Sentiment:  ${sentimentEmoji[analysis.overall_sentiment]} ${analysis.overall_sentiment.toUpperCase()} (${analysis.sentiment_score}/10)`
  );
  console.log(`Confidence: ${analysis.confidence}`);

  console.log("\n📌 SUMMARY");
  console.log(analysis.summary);

  console.log("\n💬 KEY QUOTE");
  console.log(`"${analysis.key_quote}"`);

  if (analysis.themes?.length) {
    console.log("\n🏷️  THEMES");
    analysis.themes.forEach((theme) => {
      const s = analysis.sentiment_per_theme?.[theme] || "unknown";
      console.log(`  ${sentimentEmoji[s] || "•"} ${theme} — ${s}`);
    });
  }

  if (analysis.pain_points?.length) {
    console.log("\n🔴 PAIN POINTS");
    analysis.pain_points.forEach((p) => console.log(`  • ${p}`));
  }

  if (analysis.praise_points?.length) {
    console.log("\n🟢 PRAISE POINTS");
    analysis.praise_points.forEach((p) => console.log(`  • ${p}`));
  }

  if (analysis.competitor_mentions?.length) {
    console.log("\n⚔️  COMPETITOR MENTIONS");
    analysis.competitor_mentions.forEach((c) => console.log(`  • ${c}`));
  }

  if (analysis.feature_requests?.length) {
    console.log("\n💡 FEATURE REQUESTS");
    analysis.feature_requests.forEach((f) => console.log(`  • ${f}`));
  }

  console.log("\n" + "═".repeat(60));
  console.log("📦 RAW JSON OUTPUT (for Supabase/dashboard):");
  console.log(JSON.stringify({ url, source_type: sourceType, ...analysis }, null, 2));
  console.log("═".repeat(60) + "\n");
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error("Usage: node pipeline.mjs <url>");
    console.error("Example: node pipeline.mjs https://www.g2.com/products/hubspot/reviews");
    process.exit(1);
  }

  try {
    const sourceType = detectSource(url);
    const rawText = await scrapeUrl(url);

    if (!rawText || rawText.length < 100) {
      throw new Error("Not enough content extracted from URL. The page may require auth or JS rendering.");
    }

    const analysis = await analyzeContent(rawText, sourceType, url);
    displayResults(url, sourceType, analysis);
  } catch (err) {
    console.error("\n❌ Pipeline failed:", err.message);
    process.exit(1);
  }
}

main();
