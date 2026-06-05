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
      range: "Resultados_Input!A1:I500",
    });

    const rows = response.data.values || [];
    console.log("Total rows in Resultados_Input:", rows.length);
    
    const weeks = new Set();
    const gamesByWeek = {};

    rows.slice(1).forEach(row => {
      const gameId = row[0];
      const week = row[1];
      const date = row[2];
      const home = row[3];
      const away = row[4];
      if (week && week.startsWith("Semana")) {
        weeks.add(week);
        if (!gamesByWeek[week]) {
          gamesByWeek[week] = [];
        }
        gamesByWeek[week].push({ gameId, date, home, away });
      }
    });

    console.log("Unique Weeks:", Array.from(weeks));
    console.log("\nGames by week:");
    for (const week of Object.keys(gamesByWeek).sort()) {
      console.log(`\n--- ${week} (${gamesByWeek[week].length} games) ---`);
      gamesByWeek[week].forEach(g => {
        console.log(`  - ${g.gameId}: ${g.home} vs ${g.away} (${g.date})`);
      });
    }

  } catch (error) {
    console.error("ERROR:", error.message);
  }
}
run();
