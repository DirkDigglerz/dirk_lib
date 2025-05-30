const https = require("https");

const { env } = process;

// Extract data from env variables or fallbacks
const repoFull = env.GITHUB_REPOSITORY || "unknown/unknown";
const [owner, repo] = repoFull.split("/");

// Use env vars from workflow or fallback values
const version = env.RELEASE_TAG || "Unknown Version";
const previousTag = env.PREVIOUS_TAG || null;
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

// Function to fetch commits between releases
async function fetchReleaseCommits() {
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
    console.log(`- PREVIOUS_TAG: ${previousTag || "not set"}`);
    console.log(`- GITHUB_TOKEN present: ${!!githubToken}`);
    
    let apiPath;
    
    if (previousTag) {
      // Compare between previous tag and current tag
      apiPath = `/repos/${owner}/${repo}/compare/${previousTag}...${version}`;
      console.log(`Comparing tags: ${previousTag} to ${version}`);
    } else {
      // If no previous tag, get commits for this tag/release
      apiPath = `/repos/${owner}/${repo}/commits?sha=${version}&per_page=50`;
      console.log(`Getting commits for tag: ${version}`);
    }
    
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
              
              // Handle different response formats based on API endpoint
              let commits = [];
              if (previousTag) {
                // Response from compare API
                console.log(`API data received. Found ${response.commits?.length || 0} commits between tags`);
                commits = response.commits || [];
              } else {
                // Response from commits API
                console.log(`API data received. Found ${response.length || 0} commits for tag`);
                commits = response || [];
              }

              let description = defaultDescription
                ? defaultDescription + "\n\n**Changes in this release:**\n"
                : "**Changes in this release:**\n";

              if (commits.length > 0) {
                // Filter out chore and merge commits
                const filteredCommits = commits.filter(commit => {
                  const msg = commit.commit.message.toLowerCase();
                  return !msg.startsWith("chore:") && !msg.startsWith("merge");
                });

                if (filteredCommits.length > 0) {
                  filteredCommits.slice(0, 30).forEach(commit => {
                    let message = commit.commit.message.split('\n')[0];
                    if (message.length > 100) {
                      message = message.substring(0, 97) + '...';
                    }
                    description += `• ${message} ([${commit.sha.substring(0, 7)}](${commit.html_url}))\n`;
                  });
                  
                  if (filteredCommits.length > 30) {
                    description += `\n*...and ${filteredCommits.length - 30} more commits*\n`;
                  }
                } else {
                  description += "No relevant commits found in this release.\n";
                }

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
      link: `https://github.com/${owner}/${repo}/releases/tag/${version}`,
      label: 'Latest Release from Github',
    };

// Main function to run the webhook
async function sendWebhook() {
  try {
    console.log("Starting webhook process...");
    // Get the description with release commits
    const description = await fetchReleaseCommits();
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