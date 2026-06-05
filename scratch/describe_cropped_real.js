const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

async function run() {
  try {
    const imagePath = path.join(__dirname, '..', 'public', 'cropped_debug.jpg');
    if (!fs.existsSync(imagePath)) {
      console.error("Image file does not exist at:", imagePath);
      return;
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Str = imageBuffer.toString('base64');

    console.log("Sending describe request for cropped_debug.jpg...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional assistant helping to digitize structured sports box scores."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the scoreboard table from this cropped image into a structured markdown table. Show the exact columns: Player/Username, Team, PTS, REB, AST, STL, BLK, FGM/FGA, 3PM/3PA. Be extremely precise and write down each digit exactly as it is shown in the image.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Str}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      temperature: 0.0,
    });

    console.log("Transcription Result for cropped_debug.jpg:\n", response.choices[0]?.message?.content);

  } catch (e) {
    console.error("Error during describe:", e);
  }
}

run();
