const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const imagePath = '/Users/albertoaliceahernandez/.gemini/antigravity/brain/dbeedbc5-4bdf-42e6-9f34-4822ee864a65/media__1779886873315.png';
    if (!fs.existsSync(imagePath)) {
      console.error("Image file does not exist at:", imagePath);
      return;
    }

    console.log("Reading image...");
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Str = imageBuffer.toString('base64');

    console.log("Sending scan request to dev server...");
    const response = await fetch('http://localhost:3000/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ imageBase64: base64Str })
    });

    console.log("Response status:", response.status);
    const result = await response.json();
    console.log("Scan Result:", JSON.stringify(result, null, 2));

  } catch (e) {
    console.error("Error during scan test:", e);
  }
}

run();
