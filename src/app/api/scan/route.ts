import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 60; // Allow more time for Vision API

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert OCR AI tailored for NBA 2K Pro-Am Box Scores.
Your job is to read the attached screenshot of the box score and extract the stats for ALL players.
You MUST output ONLY a raw JSON array of objects, with no markdown formatting (\`\`\`json) and no extra text.

Rules:
1. Detect the "Team" for each player. Usually, the scoreboard is split into two teams (e.g., Home/Away, Top/Bottom, Left/Right). Use team names if visible, otherwise use "Equipo 1" and "Equipo 2".
2. Extract the exact PlayStation/Xbox username. Pay strict attention to spelling, capitalization, underscores, and numbers.
3. Extract the following stats precisely:
   - PTS (Points)
   - REB (Rebounds)
   - AST (Assists)
   - STL (Steals)
   - BLK (Blocks)
   - FGM (Field Goals Made - usually the first number in the FG ratio like '12/20' -> 12)
   - 3PM (3-Pointers Made - usually the first number in the 3PT ratio like '5/8' -> 5)

Output format required:
[
  {
    "username": "PlayerName",
    "team": "TeamName",
    "pts": 20,
    "reb": 5,
    "ast": 10,
    "stl": 2,
    "blk": 1,
    "fgm": 8,
    "tpm": 4
  }
]`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the stats from this NBA 2K Pro-Am scoreboard.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      temperature: 0.1,
    });

    const aiContent = response.choices[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error("Empty response from OpenAI");
    }

    // Clean up potential markdown formatting if the AI disobeys
    const cleanJson = aiContent.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const parsedData = JSON.parse(cleanJson);

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("OCR API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process image" },
      { status: 500 }
    );
  }
}
