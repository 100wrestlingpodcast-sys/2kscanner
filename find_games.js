const { google } = require('googleapis');
require('dotenv').config({ path: './.env.local' });

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
    console.log("ALL Cariduros vs Osos OR Leones vs Osos games:");
    rows.forEach((row, index) => {
      const gId = row[0];
      const date = row[2];
      const home = (row[3] || "").toLowerCase().trim();
      const away = (row[4] || "").toLowerCase().trim();
      if (
        (home.includes("cariduros") && away.includes("osos")) || 
        (home.includes("osos") && away.includes("cariduros")) ||
        (home.includes("leones") && away.includes("osos")) ||
        (home.includes("osos") && away.includes("leones"))
      ) {
        console.log(`Row ${index + 1}: ID=${gId}, Date=${date}, Home=${row[3]}, Away=${row[4]}, Scores=${row[5]}-${row[6]}, Winner=${row[7]}`);
      }
    });
  } catch (error) {
    console.error("ERROR:", error.message);
  }
}
run();
