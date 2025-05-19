
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

    const previousTag = env.PREVIOUS_TAG || "latest_production";
    console.log(`Fetching commits between ${previousTag} and ${version || 'HEAD'}`);
    
    // Prepare the API request to get commits between tags/branches
   const apiPath = `/repos/${owner}/${repo}/commits?per_page=10`;
    
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
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            const commits = response.commits;
            
            if (commits && commits.length > 0) {
              // Format commits into a nice description
              let description = defaultDescription ? defaultDescription + "\n\n**Latest Changes:**\n" : "**Latest Changes:**\n";
              
              // Limit to 10 most recent commits to avoid too long descriptions
              const recentCommits = commits.slice(-10);
              
              recentCommits.forEach(commit => {
                // Format commit message: remove newlines and truncate if needed
                let message = commit.commit.message.split('\n')[0];
                if (message.length > 100) {
                  message = message.substring(0, 97) + '...';
                }
                
                // Add commit to description with link to commit
                description += `• ${message} ([${commit.sha.substring(0, 7)}](${commit.html_url}))\n`;
              });
              
              if (commits.length > 10) {
                description += `\n*...and ${commits.length - 10} more commits not shown*`;
              }
              
              resolve(description);
            } else {
              console.log("No commits found between releases");
              resolve(defaultDescription);
            }
          } catch (err) {
            console.error("❌ Error parsing GitHub API response:", err);
            resolve(defaultDescription);
          }
        } else {
          console.error(`❌ GitHub API returned status code ${res.statusCode}`);
          console.error(data);
          resolve(defaultDescription);
        }
      });
    });
    
    req.on('error', (err) => {
      console.error("❌ Error fetching commits:", err);
      resolve(defaultDescription);
    });
    
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
    // Get the description with latest commits
    const description = await fetchLatestCommits();
    
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
  } catch (error) {
    console.error("❌ Error in webhook process:", error);
    process.exit(1);
  }
}

// Run the webhook
sendWebhook();