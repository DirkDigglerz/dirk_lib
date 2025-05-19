const https = require("https");

const { env } = process;

const fs = require("fs");

// Load event data
const eventPath = env.GITHUB_EVENT_PATH;
const eventData = JSON.parse(fs.readFileSync(eventPath, "utf8"));

// Extract data
const repoFull = env.GITHUB_REPOSITORY || "unknown/unknown";
const [owner, repo] = repoFull.split("/");
const version = eventData.release?.tag_name || "Unknown Version";
const description = eventData.release?.body || "No description provided.";
const title = `${repo} ${version}`;
const avatarUrl = `https://github.com/${owner}.png`;
const webhookUrl = env.WEBHOOK_URL;

if (!webhookUrl) {
  console.error("❌ WEBHOOK_URL not set");
  process.exit(1);
}

// Construct payload
const payload = JSON.stringify({
  content: "<@&1337224918710095882>",
  allowed_mentions: { parse: ["roles"] },
  embeds: [
    {
      title,
      description,
      color: 15105570,
      footer: {
        text: `🔄 Download the latest version of ${repo} to ensure compatibility.`,
      },
      image: {
        url: avatarUrl,
      },
    },
  ],
  components: [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 5,
          label: "Get The Latest Release From Portal",
          url: "https://portal.cfx.re/assets/granted-assets",
        },
        {
          type: 2,
          style: 5,
          label: `Get The Latest ${repo} Release`,
          url: `https://github.com/${owner}/${repo}/tree/main`,
        },
      ],
    },
  ],
});

// Send the webhook via HTTPS
const url = new URL(webhookUrl);
const req = https.request(
  {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
  },
  (res) => {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      console.error(`❌ Webhook failed with status: ${res.statusCode}`);
      res.resume();
      process.exit(1);
    } else {
      console.log("✅ Webhook sent successfully.");
    }
  }
);

req.on("error", (err) => {
  console.error("❌ Request error:", err);
  process.exit(1);
});

req.write(payload);
req.end();
