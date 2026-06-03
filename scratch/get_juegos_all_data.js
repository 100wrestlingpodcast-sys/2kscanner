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

    // Inspect Juegos completely
    const resJuegos = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Juegos!A1:H100",
    });
    console.log("=== JUEGOS SHEET ===");
    console.log("Total rows found:", resJuegos.data.values ? resJuegos.data.values.length : 0);
    if (resJuegos.data.values) {
      for (let i = 0; i < Math.min(25, resJuegos.data.values.length); i++) {
        console.log(`Row ${i}:`, resJuegos.data.values[i]);
      }
    }

    // Inspect PROCESSED_GAMES
    const resProcessed = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "PROCESSED_GAMES!A1:D30",
    });
    console.log("\n=== PROCESSED_GAMES SHEET ===");
    console.log("Headers:", resProcessed.data.values ? resProcessed.data.values[0] : "None");
    console.log("Sample Rows:", resProcessed.data.values ? resProcessed.data.values.slice(1, 15) : "None");

  } catch (error) {
    console.error("ERROR:", error.message);
  }
}
run();
