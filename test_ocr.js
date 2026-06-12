const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './.env.local' });

async function run() {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const imagePath = path.join(__dirname, 'public', 'cropped_debug.jpg');
    if (!fs.existsSync(imagePath)) {
      console.error("Image file does not exist at:", imagePath);
      return;
    }

    const imageBase64 = fs.readFileSync(imagePath).toString('base64');

    // Get expected rosters and teams (from a mockup or the real sheet)
    // To make it identical to what the app sends, let's look at what page.tsx does.
    // In page.tsx:
    // const res = await fetch("/api/scan", { imageBase64, rosterPlayers: validPlayers, teams: [team1, team2] })
    // Let's first fetch valid players from Google Sheets so we have the real roster context
    const { google } = require('googleapis');
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Jugadores_lista!A:N",
    });
    const rows = sheetRes.data.values || [];
    const parseDecimal = (val) => {
      if (!val) return 0;
      const normalized = val.trim().replace(",", ".");
      const parsed = parseFloat(normalized);
      return isNaN(parsed) ? 0 : parsed;
    };
    const rosterPlayers = rows
      .slice(3)
      .filter((row) => row[1])
      .map((row) => ({
        team: row[0] || "Desconocido",
        name: row[1],
      }));

    console.log("Total roster players fetched:", rosterPlayers.length);

    let rosterContext = "";
    if (rosterPlayers.length > 0) {
      rosterContext = `\n\nEXPECTED ROSTER PLAYERS (For Reference & High Precision Matching):\n` +
        rosterPlayers.map((p) => `- Username: "${p.name}" (Expected Team: "${p.team}")`).join("\n") +
        `\n\nUse this expected roster list to resolve and correct any slight spelling mistakes, special characters (like underscores, dashes), or OCR noise in the Player column. If a player row in the box score matches one of these expected usernames, map it to that username. If a player in the box score is NOT in this roster list, still extract and transcribe it exactly as it appears in the image (do not ignore them).`;
    }

    const prompt = `You are an advanced Spatial Vision OCR AI specialized in basketball box scores from NBA 2K.
Your objective is to read the attached scoreboard image and transcribe statistics for every player row with absolute columns alignment.

CRITICAL STEPS FOR PRECISE TRANSCRIPTION (SPATIAL HEADER MATCHING):
1. Locate the Column Header Row:
   Identify the horizontal row containing column headers (e.g., GRD, PTS, REB, AST, STL, BLK, FGM/FGA, 3PM/3PA).
   Note: There is NO header text for the Player/Username column; player names (gamer tags) are located on the far left of each row, next to the platform/avatar icons, to the left of the GRD column.
   
2. Establish Exact Horizontal Coordinates (X-axis Calibration):
   Determine the exact horizontal coordinate (or center line) of each of these columns:
   - PLAYER (the region on the far left containing the player gamer tags, to the left of the GRD column)
   - PTS
   - REB
   - AST
   - STL
   - BLK
   - FGM/FGA
   - 3PM/3PA

3. Read Stats Vertically (Y-axis Lineup Scan):
   For every player row in the scoreboard:
   - For the PLAYER column (gamer tags on the far left), extract the PlayStation/Xbox gamer ID (username) precisely as text. This column must NEVER be left empty or null unless the row is completely blank. Be very thorough in transcribing the exact spelling, case, and special characters (underscores, hyphens, numbers) of each username.
   - For each statistic (PTS, REB, AST, STL, BLK, FGM/FGA, 3PM/3PA), look directly vertically downwards from that column's X-axis position. Extract ONLY the number or fraction that falls directly inside that column's vertical alignment slice.
   - **PREFER EMPTY OVER GUESSING / SHIFTING for numeric stats**: If a cell under a numeric header (PTS, REB, AST, STL, BLK, FGM/FGA, 3PM/3PA) is blank, unreadable, or missing, do NOT shift numbers from adjacent columns to fill the gap. Set that field to null. (However, as stated above, you must always transcribe the PLAYER username text).
   - If there is any doubt about which column a number belongs to, set it to null and set the flag "low_confidence": true for that player.
   - Completely ignore and discard all other columns like GRD, FOULS, TO, FTM/FTA, team total rows, score overlays, and background details.

4. Identify Teams:
   - Assign each player to their correct team name.
   - If the team headers (e.g. team name text or logos) are visible above their respective table section, use them.
   - If team headers are NOT visible in the image (e.g. if the image is cropped or only shows the box score rows), look at the EXPECTED ROSTER PLAYERS list to see which team the player belongs to (for example, if you match the player to "BubaluRD-_-023", assign them to team "Criollos").
   - If a player is not in the expected roster, assign them to the same team as the other players in their 5-player section.

${rosterContext}

Output MUST be ONLY a raw JSON array of objects, with no markdown formatting (\`\`\`json) and no extra text.
JSON Structure per Player:
[
  {
    "username": "PlayerName",
    "team": "TeamName",
    "pts": 14 (or null),
    "reb": 0 (or null),
    "ast": 13 (or null),
    "stl": 1 (or null),
    "blk": 0 (or null),
    "fgm_fga": "7/14" (or null),
    "tpm_tpa": "0/2" (or null),
    "low_confidence": false (or true if any value was doubtful, blurry, or misaligned)
  }
]`;

    console.log("Calling OpenAI vision API...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Find the headers first to calibrate X positions, then transcribe stats vertically for each player row.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      temperature: 0.0,
    });

    const aiContent = response.choices[0]?.message?.content;
    console.log("\n--- RAW AI RESPONSE ---");
    console.log(aiContent);
    console.log("-----------------------\n");

  } catch (error) {
    console.error("ERROR:", error.message);
  }
}
run();
