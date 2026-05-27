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
          role: "user",
          content: [
            {
              type: "text",
              text: "Please transcribe all text and numbers you see in this cropped box score image. List each row clearly, showing player names/usernames and their stats columns.",
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

    console.log("Transcription Result:\n", response.choices[0]?.message?.content);

  } catch (e) {
    console.error("Error during describe:", e);
  }
}

run();
