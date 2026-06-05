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
      range: "Resultados_Input!A1:N10",
    });

    const rows = response.data.values;
    if (!rows) {
      console.log("No data found in Resultados_Input");
      return;
    }

    console.log("Resultados_Input headers and first 5 rows:");
    rows.slice(0, 6).forEach((row, i) => console.log(`${i}: ${JSON.stringify(row)}`));

  } catch (error) {
    console.error("ERROR:", error.message);
  }
}
run();
