const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

async function run() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "GAME_PLAYER_STATS!A1:D3000",
    });

    const rows = response.data.values || [];
    console.log("Total rows in GAME_PLAYER_STATS:", rows.length);
    
    // Group rows by Game ID and find Date, Home/Away Teams
    const games = {};
    rows.slice(1).forEach(row => {
      const gameId = row[0];
      const date = row[1];
      const team1 = row[2];
      const team2 = row[3];
      if (gameId) {
        if (!games[gameId]) {
          games[gameId] = { date, teams: new Set() };
        }
        if (team1) games[gameId].teams.add(team1);
        if (team2) games[gameId].teams.add(team2);
      }
    });

    console.log("Unique Games found:");
    const sortedGameIds = Object.keys(games).sort();
    sortedGameIds.forEach(id => {
      console.log(`- ${id}: Date=${games[id].date}, Teams=[${Array.from(games[id].teams).join(", ")}]`);
    });

  } catch (error) {
    console.error("ERROR:", error.message);
  }
}
run();
