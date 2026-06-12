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
    console.log("Details for row 22 (BSN021) and row 116 (BSN110):");
    [22, 116].forEach(rowNum => {
      const row = rows[rowNum - 1];
      console.log(`\nRow ${rowNum}:`);
      if (row) {
        row.forEach((cell, idx) => {
          console.log(`  Col ${idx} (${String.fromCharCode(65 + idx)}): value="${cell}" (type: ${typeof cell}, length: ${cell ? cell.length : 0})`);
        });
      } else {
        console.log("  No row found");
      }
    });

    console.log("\nDetails for row 8 (BSN007) and row 115 (BSN109):");
    [8, 115].forEach(rowNum => {
      const row = rows[rowNum - 1];
      console.log(`\nRow ${rowNum}:`);
      if (row) {
        row.forEach((cell, idx) => {
          console.log(`  Col ${idx} (${String.fromCharCode(65 + idx)}): value="${cell}" (type: ${typeof cell}, length: ${cell ? cell.length : 0})`);
        });
      } else {
        console.log("  No row found");
      }
    });

  } catch (error) {
    console.error("ERROR:", error.message);
  }
}
run();
