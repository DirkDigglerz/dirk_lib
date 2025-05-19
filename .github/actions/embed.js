const https = require("https");

const { env } = process;

const repoFull = env.GITHUB_REPOSITORY || "unknown/unknown";
const [owner, repo] = repoFull.split("/");

const newVersion = env.RELEASE_TAG || "Unknown Version";
const newDescription = env.RELEASE_DESCRIPTION || "No description provided.";
const webhookUrl = env.WEBHOOK_URL;
const githubToken = env.GITHUB_TOKEN;

if (!webhookUrl) {
  console.error("❌ WEBHOOK_URL not set");
  process.exit(1);
}
if (!githubToken) {
  console.error("❌ GITHUB_TOKEN not set");
  process.exit(1);
}

// Helper to make a GET request to GitHub API
function githubApiGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path,
      method: "GET",
      headers: {
        "User-Agent": "Release-Webhook-Script",
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    };

    https
      .get(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`GitHub API returned status ${res.statusCode}`));
          }
        });
      })
      .on("error", reject);
  });
}

async function main() {
  try {
    // Fetch all releases, sorted latest first
    const releases = await githubApiGet(`/repos/${owner}/${repo}/releases`);

    // Find the release *before* the current tag (ignore if no previous)
    const previousRelease = releases.find(
      (r) => r.tag_name !== newVersion && !r.draft && !r.prerelease
    );

    // Compose description with changes from previous release to new one
    const previousBody = previousRelease ? previousRelease.body || "" : "";
    const description = `**Changes since ${previousRelease ? previousRelease.tag_name : "last release"}:**\n${newDescription}`;

    const title = `${repo} ${newVersion}`;
    const avatarUrl = `https://github.com/${owner}.png`;

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
  } catch (error) {
    console.error("❌ Error fetching GitHub releases:", error);
    process.exit(1);
  }
}

main();
