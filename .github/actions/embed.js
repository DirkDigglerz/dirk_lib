const https = require("https");

const { env } = process;

// Extract data from env variables or fallbacks
const repoFull = env.GITHUB_REPOSITORY || "unknown/unknown";
const [owner, repo] = repoFull.split("/");

// Use env vars from workflow or fallback values
const version = env.RELEASE_TAG || "Unknown Version";
const description = env.RELEASE_DESCRIPTION || "No description provided.";

const title = env.RELEASE_TITLE ? repo + ' ' + env.RELEASE_TITLE : `${repo} ${version}`;
const avatarUrl = `https://github.com/${owner}.png`;
const webhookUrl = env.WEBHOOK_URL;

if (!webhookUrl) {
  console.error("❌ WEBHOOK_URL not set");
  process.exit(1);
}

// Construct payload
const payload = JSON.stringify({
  content: "<@&1327654778934919230>",
  allowed_mentions: { parse: ["roles"] },
  embeds: [
    {
      title,
      description,
      color: 2067276,
      footer: {
        text: `🔄 Download the latest version of ${repo} to ensure compatibility.`,
      },
      thumbnail: {
        url: avatarUrl,
      },
      fields: [
        {
          name: "📥 Downloads",
          value: `[Get Latest Release From Portal](https://portal.cfx.re/assets/granted-assets)\n[Get Latest ${repo} Release](https://github.com/${owner}/${repo}/tree/main)`,
          inline: false
        }
      ]
    },
  ],
  components: [
    {
      type: 1,  // Action Row
      components: [
        {
          type: 2,  // Button
          style: 5,  // Link button
          label: "Get The Latest Release From Portal",
          url: "https://portal.cfx.re/assets/granted-assets",
        },
        {
          type: 2,  // Button
          style: 5,  // Link button
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
    console.log(`Status Code: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        console.error(`❌ Webhook failed with status: ${res.statusCode}`);
        if (data) console.error(`Response: ${data}`);
        process.exit(1);
      } else {
        console.log("✅ Webhook sent successfully.");
      }
    });
  }
);

req.on("error", (err) => {
  console.error("❌ Request error:", err);
  process.exit(1);
});

req.write(payload);
req.end();