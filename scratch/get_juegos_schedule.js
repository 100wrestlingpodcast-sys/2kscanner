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

    // Inspect Juegos
    const resJuegos = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Juegos!A1:H20",
    });
    console.log("=== JUEGOS SHEET ===");
    console.log("Headers:", resJuegos.data.values ? resJuegos.data.values[0] : "None");
    console.log("Sample Rows:", resJuegos.data.values ? resJuegos.data.values.slice(1, 10) : "None");

    // Inspect Schedule
    const resSchedule = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Schedule!A1:H20",
    });
    console.log("\n=== SCHEDULE SHEET ===");
    console.log("Headers:", resSchedule.data.values ? resSchedule.data.values[0] : "None");
    console.log("Sample Rows:", resSchedule.data.values ? resSchedule.data.values.slice(1, 10) : "None");

  } catch (error) {
    console.error("ERROR:", error.message);
  }
}
run();
