import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

// Configuración de Auth para Google Sheets
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "getPlayers") {
      // Obtenemos la lista de jugadores válidos desde la pestaña Jugadores_lista
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Jugadores_lista!A:N", // Columnas A a la N para incluir todas las estadísticas principales
      });

      const rows = response.data.values;
      if (!rows || rows.length < 4) {
        return NextResponse.json({ success: true, players: [] });
      }

      // Función auxiliar para parsear decimales que contengan comas o puntos
      const parseDecimal = (val: string) => {
        if (!val) return 0;
        const normalized = val.trim().replace(",", ".");
        const parsed = parseFloat(normalized);
        return isNaN(parsed) ? 0 : parsed;
      };

      // Los datos reales empiezan en la fila 4 (index 3)
      const players = rows
        .slice(3) // Saltamos las primeras 3 filas de encabezado
        .filter((row) => row[1]) // Removemos filas sin nombre
        .map((row) => ({
          team: row[0] || "Desconocido",
          name: row[1],
          gp: parseInt(row[2]) || 0,
          pts: parseInt(row[3]) || 0,
          ppg: parseDecimal(row[4]),
          reb: parseInt(row[5]) || 0,
          rpg: parseDecimal(row[6]),
          ast: parseInt(row[7]) || 0,
          apg: parseDecimal(row[8]),
          stl: parseInt(row[9]) || 0,
          spg: parseDecimal(row[10]),
          blk: parseInt(row[11]) || 0,
          bpg: parseDecimal(row[12]),
          pos: row[13] || "N/A"
        }));
      
      return NextResponse.json({ success: true, players });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Sheets GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { data, destinations, semana } = await req.json();

    if (!data || !destinations) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const { scoreboard, individual } = destinations;
    
    // Autogenerar o buscar el Game ID
    let finalGameId = "BSN001";
    let dateStr = new Date().toLocaleDateString("es-PR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    // 1. Obtener todas las filas de GAME_PLAYER_STATS para duplicados/auto-id
    let idRows: any[] = [];
    try {
      const idRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "GAME_PLAYER_STATS!A:K", // Traer hasta la K (BLK) para verificar duplicados
      });
      idRows = idRes.data.values || [];
    } catch (e) {
      console.warn("Error leyendo GAME_PLAYER_STATS para duplicados/auto-id:", e);
    }

    // 2. Verificar duplicados exactos (Scoreboard Signature)
    if (idRows.length > 1) {
      const incomingSignature = data
        .map((p: any) => `${p.username.toLowerCase()}-${p.pts || 0}-${p.reb || 0}-${p.ast || 0}`)
        .sort()
        .join("|");

      const gamesSignatures: Record<string, string[]> = {};
      idRows.slice(1).forEach(row => {
        const gId = row[0];
        const pName = (row[4] || "").toLowerCase();
        const pPts = row[5] || "0";
        const pAst = row[6] || "0";
        const pReb = row[7] || "0";
        
        if (gId && pName) {
          if (!gamesSignatures[gId]) gamesSignatures[gId] = [];
          gamesSignatures[gId].push(`${pName}-${pPts}-${pReb}-${pAst}`);
        }
      });

      for (const [gId, sigArray] of Object.entries(gamesSignatures)) {
        const existingSignature = sigArray.sort().join("|");
        if (incomingSignature === existingSignature) {
          return NextResponse.json({ 
            error: `Este scoreboard ya fue registrado anteriormente bajo el juego ${gId}. No se pueden subir datos duplicados.` 
          }, { status: 409 });
        }
      }
    }

    // 3. Resolver Game ID y Fecha
    if (semana && semana !== "Actual") {
      try {
        const resInput = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "Resultados_Input!A1:E250",
        });
        const inputRows = resInput.data.values || [];
        
        // Equipos escaneados
        const scannedTeams = Array.from(new Set(data.map((p: any) => p.team)))
          .map((t: any) => String(t).toLowerCase().trim());
        
        let matchedGameId: string | null = null;
        let matchedDate: string | null = null;
        
        for (const row of inputRows) {
          const gId = row[0];
          const rSemana = row[1];
          const rDate = row[2];
          const homeTeam = row[3];
          const awayTeam = row[4];
          
          if (gId && rSemana && homeTeam && awayTeam) {
            if (rSemana.toLowerCase().trim() === semana.toLowerCase().trim()) {
              const normalizedHome = homeTeam.toLowerCase().trim();
              const normalizedAway = awayTeam.toLowerCase().trim();
              
              const matchesHome = scannedTeams.some(t => t.includes(normalizedHome) || normalizedHome.includes(t));
              const matchesAway = scannedTeams.some(t => t.includes(normalizedAway) || normalizedAway.includes(t));
              
              if (matchesHome && matchesAway) {
                matchedGameId = gId;
                matchedDate = rDate;
                break;
              }
            }
          }
        }
        
        if (matchedGameId) {
          finalGameId = matchedGameId;
          if (matchedDate) {
            dateStr = matchedDate;
          }
        } else {
          return NextResponse.json({ 
            error: `No se encontró ningún juego registrado para ${scannedTeams.join(" vs ")} en la "${semana}" en la pestaña Resultados_Input. Por favor verifica que los nombres de los equipos coincidan con el calendario.` 
          }, { status: 404 });
        }
      } catch (err: any) {
        console.error("Error consultando Resultados_Input para juego histórico:", err);
        return NextResponse.json({ error: "Error de servidor al buscar el juego histórico: " + err.message }, { status: 500 });
      }
    } else {
      // Auto-incrementar Game ID
      if (idRows.length > 1) {
        const lastId = idRows[idRows.length - 1][0];
        if (lastId && lastId.startsWith("BSN")) {
          const numPart = parseInt(lastId.replace("BSN", ""), 10);
          if (!isNaN(numPart)) {
            finalGameId = `BSN${String(numPart + 1).padStart(3, '0')}`;
          }
        }
      }
    }

    // 1. SCOREBOARD -> Añadir nueva fila en GAME_PLAYER_STATS
    if (scoreboard) {
      // Inicialización dinámica y autocuración de cabeceras en GAME_PLAYER_STATS
      try {
        const headerRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "GAME_PLAYER_STATS!A1:R1",
        });
        const headers = headerRes.data.values ? headerRes.data.values[0] : [];
        const expectedHeaders = [
          "Game ID", "Date", "Equipos", "Equipos", "Player", "PTS", "AST", "REB",
          "STL", "BLK", "FG_MADE", "FG_ATTEMPTED", "THREE_MADE", "RESULT", "DID_PLAY",
          "THREE_ATTEMPTED", "TURNOVERS", "FOULS"
        ];
        
        if (headers.length < 18 || !headers[11] || headers[11] !== "FG_ATTEMPTED" || headers[15] !== "THREE_ATTEMPTED") {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: "GAME_PLAYER_STATS!A1:R1",
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: [expectedHeaders]
            }
          });
        }
      } catch (err) {
        console.warn("No se pudo verificar o actualizar las cabeceras de GAME_PLAYER_STATS:", err);
      }

      const rowsToAppend = data.map((p: any) => {
        const numVal = (v: any) => (v === "" || v === null || v === undefined) ? 0 : Number(v);
        return [
          finalGameId,
          dateStr,
          p.team, // Equipo local
          p.opponent || "", // Equipo visita
          p.username,
          numVal(p.pts),
          numVal(p.ast),
          numVal(p.reb),
          numVal(p.stl),
          numVal(p.blk),
          numVal(p.fgm),
          numVal(p.fga), // FG_ATTEMPTED
          numVal(p.tpm), // THREE_MADE
          p.result || "", // RESULT (W/L)
          "TRUE", // DID_PLAY
          numVal(p.tpa), // THREE_ATTEMPTED
          numVal(p.to), // TURNOVERS
          numVal(p.fouls) // FOULS
        ];
      });

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "GAME_PLAYER_STATS!A:R",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: rowsToAppend
        }
      });
    }

    // 2. INDIVIDUAL -> Sumar totales en Jugadores_lista
    if (individual) {
      // Obtener el estado actual de la hoja para saber en qué fila está cada jugador y cuáles son sus totales
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Jugadores_lista!A:M",
      });
      const rows = response.data.values;
      
      const updateData: any[] = [];

      if (rows && rows.length > 3) {
        data.forEach((p: any) => {
          if (!p.nameMatched) return;

          // Buscar en qué fila está (ignorando mayúsculas)
          const rowIndex = rows.findIndex((r) => r[1] && r[1].trim().toLowerCase() === p.username.trim().toLowerCase());
          
          if (rowIndex !== -1) {
            const rowNum = rowIndex + 1; // Google Sheets es 1-indexed
            const currentRow = rows[rowIndex];

            // Parsear stats actuales (si están vacíos, asume 0)
            const currentGP = parseInt(currentRow[2] || "0", 10);
            const currentPTS = parseInt(currentRow[3] || "0", 10);
            const currentREB = parseInt(currentRow[5] || "0", 10);
            const currentAST = parseInt(currentRow[7] || "0", 10);
            const currentSTL = parseInt(currentRow[9] || "0", 10);
            const currentBLK = parseInt(currentRow[11] || "0", 10);

            // Preparar las actualizaciones de celdas individuales para no pisar las fórmulas de PPG, RPG, etc.
            // C=GP, D=PTS, F=REB, H=AST, J=STL, L=BLK
            updateData.push({ range: `Jugadores_lista!C${rowNum}`, values: [[currentGP + 1]] });
            updateData.push({ range: `Jugadores_lista!D${rowNum}`, values: [[currentPTS + (p.pts || 0)]] });
            updateData.push({ range: `Jugadores_lista!F${rowNum}`, values: [[currentREB + (p.reb || 0)]] });
            updateData.push({ range: `Jugadores_lista!H${rowNum}`, values: [[currentAST + (p.ast || 0)]] });
            updateData.push({ range: `Jugadores_lista!J${rowNum}`, values: [[currentSTL + (p.stl || 0)]] });
            updateData.push({ range: `Jugadores_lista!L${rowNum}`, values: [[currentBLK + (p.blk || 0)]] });
          }
        });

        // Ejecutar la actualización en masa (Batch Update)
        if (updateData.length > 0) {
          await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
              valueInputOption: "USER_ENTERED",
              data: updateData
            }
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: "Stats guardados exitosamente en sus respectivos destinos" });
  } catch (error: any) {
    console.error("Sheets POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
