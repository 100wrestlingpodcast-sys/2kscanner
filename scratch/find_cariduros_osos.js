const { google } = require('googleapis');
require('dotenv').config({ path: '/Users/aaliceahernandez/Downloads/2k scanner/app-scanner-2k/.env.local' });

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
    console.log("Total rows:", rows.length);
    console.log("Games matching Cariduros vs Osos:");
    rows.forEach((row, index) => {
      const home = (row[3] || "").toLowerCase().trim();
      const away = (row[4] || "").toLowerCase().trim();
      if ((home.includes("cariduros") && away.includes("osos")) || (home.includes("osos") && away.includes("cariduros"))) {
        console.log(`Row ${index + 1}:`, row);
      }
    });
  } catch (error) {
    console.error("ERROR:", error.message);
  }
}
run();
