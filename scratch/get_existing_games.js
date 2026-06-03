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
      range: "GAME_PLAYER_STATS!A1:E150",
    });

    console.log("Headers:", response.data.values[0]);
    console.log("Sample Rows:");
    console.log(response.data.values.slice(1, 40));
  } catch (error) {
    console.error("ERROR:", error.message);
  }
}
run();
