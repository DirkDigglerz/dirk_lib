const https = require("https");

const { env } = process;

// Extract data from env variables or fallbacks
const repoFull = env.GITHUB_REPOSITORY || "unknown/unknown";
const [owner, repo] = repoFull.split("/");

// Use env vars from workflow or fallback values
const version = env.RELEASE_TAG || "Unknown Version";
const defaultDescription = env.RELEASE_DESCRIPTION || "No description provided.";
const isPrivate = env.IS_PRIVATE_REPO === "true";

const title = env.RELEASE_TITLE ? repo + ' ' + env.RELEASE_TITLE : `${repo} ${version}`;
const avatarUrl = `https://github.com/${owner}.png`;
const webhookUrl = env.WEBHOOK_URL;
const githubToken = env.GITHUB_TOKEN;

if (!webhookUrl) {
  console.error("❌ WEBHOOK_URL not set");
  process.exit(1);
}

// Function to fetch the latest commits
async function fetchLatestCommits() {
  return new Promise((resolve, reject) => {
    // Default in case we can't fetch commits
    if (!githubToken) {
      console.warn("⚠️ GITHUB_TOKEN not set, skipping commit fetch");
      resolve(defaultDescription);
      return;
    }

    console.log("Env variables:");
    console.log(`- GITHUB_REPOSITORY: ${env.GITHUB_REPOSITORY}`);
    console.log(`- RELEASE_TAG: ${version}`);
    console.log(`- PREVIOUS_TAG: ${env.PREVIOUS_TAG || "release"}`);
    console.log(`- GITHUB_TOKEN present: ${!!githubToken}`);
    
    // Get the most recent commits directly instead of comparing tags
    const apiPath = `/repos/${owner}/${repo}/commits?per_page=10`;
    console.log(`Using API path: ${apiPath}`);
    
    const options = {
      hostname: "api.github.com",
      path: apiPath,
      method: "GET",
      headers: {
        "User-Agent": `${repo}-release-webhook`,
        "Authorization": `token ${githubToken}`,
        "Accept": "application/vnd.github.v3+json"
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          console.log(`GitHub API response status: ${res.statusCode}`);

          if (res.statusCode === 200) {
            try {
              const response = JSON.parse(data);
              console.log(`API data received. Found ${response.length || 0} commits`);

              let description = defaultDescription
                ? defaultDescription + "\n\n**Latest Changes:**\n"
                : "**Latest Changes:**\n";

              const commits = response || [];

              if (commits.length > 0) {
                commits.slice(0, 10).forEach(commit => {
                  let message = commit.commit.message.split('\n')[0];
                  if (message.length > 100) {
                    message = message.substring(0, 97) + '...';
                  }
                  description += `• ${message} ([${commit.sha.substring(0, 7)}](${commit.html_url}))\n`;
                });

                resolve(description);
              } else {
                console.log("No commits found");
                resolve(defaultDescription);
              }
            } catch (parseError) {
              console.error('❌ Failed to parse GitHub response JSON:', parseError);
              resolve(defaultDescription);
            }
          } else {
            console.error(`❌ GitHub API returned status code ${res.statusCode}`);
            console.error(`Full response: ${data}`);
            resolve(defaultDescription);
          }
        } catch (err) {
          console.error('❌ Unexpected error while processing GitHub response:', err);
          resolve(defaultDescription);
        }
      });
          
    req.on('error', (err) => {
      console.error("❌ Error fetching commits:", err);
      resolve(defaultDescription);
    });
    
    console.log("Sending GitHub API request...");
    req.end();
  });
}

// Determine the appropriate download links based on repository visibility
const downloadLinks = isPrivate 
  ? {
      link: "https://portal.cfx.re/assets/granted-assets",
      label: "Latest Release from CFX Portal",
    }
  : {
      // LINK TO LATEST RELEASE
      link: `https://github.com/${owner}/${repo}/releases/tag/latest_production`,
      label: 'Latest Release from Github',
    };

// Main function to run the webhook
async function sendWebhook() {
  try {
    console.log("Starting webhook process...");
    // Get the description with latest commits
    const description = await fetchLatestCommits();
    console.log("Commit description generated:", description.substring(0, 100) + "...");
    
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
              name: "📥 Download",
              value: `[${downloadLinks.label}](${downloadLinks.link})`,
              inline: false
            }
          ]
        },
      ],
    });

    console.log("Webhook payload prepared, sending to Discord...");

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
  } catch (error) {
    console.error("❌ Error in webhook process:", error);
    process.exit(1);
  }
}

// Run the webhook
sendWebhook();