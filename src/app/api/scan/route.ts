import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 60; // Allow more time for Vision API

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, rosterPlayers, teams } = await req.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    // Save image for debugging purposes
    try {
      const fs = require('fs');
      const path = require('path');
      const buffer = Buffer.from(imageBase64, 'base64');
      fs.writeFileSync(path.join(process.cwd(), 'public', 'cropped_debug.jpg'), buffer);
    } catch (e) {
      console.warn("Could not save debug image:", e);
    }

    let rosterContext = "";
    if (rosterPlayers && Array.isArray(rosterPlayers) && rosterPlayers.length > 0) {
      rosterContext = `\n\nEXPECTED ROSTER PLAYERS (For Reference & High Precision Matching):\n` +
        rosterPlayers.map((p: any) => `- Username: "${p.name}" (Expected Team: "${p.team}")`).join("\n") +
        `\n\nUse this expected roster list to resolve and correct any slight spelling mistakes, special characters (like underscores, dashes), or OCR noise in the Player column. If a player row in the box score matches one of these expected usernames, map it to that username. If a player in the box score is NOT in this roster list, still extract and transcribe it exactly as it appears in the image (do not ignore them).`;
    }

    let teamsContext = "";
    if (teams && Array.isArray(teams) && teams.length > 0) {
      teamsContext = `\n\nEXPECTED TEAMS:\n` +
        teams.map((t: any) => `- "${t}"`).join("\n") +
        `\n\nAssign each transcribed player to one of these expected teams based on which section/header of the box score they belong to.`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an advanced Spatial Vision OCR AI specialized in basketball box scores from NBA 2K.
Your objective is to read the attached scoreboard image and transcribe statistics for every player row with absolute columns alignment.

CRITICAL STEPS FOR PRECISE TRANSCRIPTION (SPATIAL HEADER MATCHING):
1. Locate the Column Header Row:
   Identify the horizontal row containing column headers. Look specifically for columns: PLAYER (or Player/Username), PTS, REB, AST, STL, BLK, FGM/FGA (or FG M/A), and 3PM/3PA (or 3P M/A).
   
2. Establish Exact Horizontal Coordinates (X-axis Calibration):
   Determine the exact horizontal coordinate (or center line) of each of these headers:
   - PLAYER
   - PTS
   - REB
   - AST
   - STL
   - BLK
   - FGM/FGA
   - 3PM/3PA

3. Read Stats Vertically (Y-axis Lineup Scan):
   For every player row in the scoreboard:
   - Extract the Playstation/Xbox gamer ID in the Player/Username column.
   - For each statistic (PTS, REB, AST, STL, BLK, FGM/FGA, 3PM/3PA), look directly vertically downwards from that header's X-axis position. Extract ONLY the number or fraction that falls directly inside that column's vertical alignment slice.
   - **PREFER EMPTY OVER GUESSING / SHIFTING**: If a cell under a header is blank, unreadable, or missing, do NOT shift numbers from adjacent columns to fill the gap. Set that field to null.
   - If there is any doubt about which column a number belongs to, set it to null and set the flag "low_confidence": true for that player.
   - Completely ignore and discard all other columns like GRD, FOULS, TO, FTM/FTA, team total rows, score overlays, and background details.

4. Identify Teams:
   Assign each player to their correct team name based on the team header above their table section.

${rosterContext}${teamsContext}

Output MUST be ONLY a raw JSON array of objects, with no markdown formatting (\`\`\`json) and no extra text.
JSON Structure per Player:
[
  {
    "username": "PlayerName",
    "team": "TeamName",
    "pts": 14 (or null),
    "reb": 0 (or null),
    "ast": 13 (or null),
    "stl": 1 (or null),
    "blk": 0 (or null),
    "fgm_fga": "7/14" (or null),
    "tpm_tpa": "0/2" (or null),
    "low_confidence": false (or true if any value was doubtful, blurry, or misaligned)
  }
]`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Find the headers first to calibrate X positions, then transcribe stats vertically for each player row.",
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
      temperature: 0.0,
    });

    const aiContent = response.choices[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error("Empty response from OpenAI");
    }

    // Clean up potential markdown formatting if the AI disobeys
    const cleanJson = aiContent.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const parsedData = JSON.parse(cleanJson);

    // Process the raw transcribed columns programmatically in the backend
    const processedData = parsedData.map((player: any) => {
      // Split FGM/FGA (e.g. "7/14" or "7-14")
      let fgm: number | "" = "";
      let fga: number | "" = "";
      if (player.fgm_fga) {
        const parts = String(player.fgm_fga).split(/[/\-]/);
        fgm = parseInt(parts[0], 10);
        if (isNaN(fgm)) fgm = "";
        fga = parseInt(parts[1], 10);
        if (isNaN(fga)) fga = "";
      }
      
      // Split 3PM/3PA (e.g. "3/6" or "3-6")
      let tpm: number | "" = "";
      let tpa: number | "" = "";
      if (player.tpm_tpa) {
        const parts = String(player.tpm_tpa).split(/[/\-]/);
        tpm = parseInt(parts[0], 10);
        if (isNaN(tpm)) tpm = "";
        tpa = parseInt(parts[1], 10);
        if (isNaN(tpa)) tpa = "";
      }

      // Convert all numeric values safely
      const parseVal = (val: any) => {
        if (val === null || val === undefined || val === "") return "";
        const parsed = parseInt(String(val), 10);
        return isNaN(parsed) ? "" : parsed;
      };

      return {
        username: player.username || "",
        team: player.team || "",
        pts: parseVal(player.pts),
        reb: parseVal(player.reb),
        ast: parseVal(player.ast),
        stl: parseVal(player.stl),
        blk: parseVal(player.blk),
        to: "", // Deprecated/ignored, kept empty for schema compatibility
        fouls: "", // Deprecated/ignored, kept empty for schema compatibility
        fgm,
        fga,
        tpm,
        tpa,
        low_confidence: player.low_confidence === true
      };
    });

    return NextResponse.json({ success: true, data: processedData });
  } catch (error: any) {
    console.error("OCR API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process image" },
      { status: 500 }
    );
  }
}
