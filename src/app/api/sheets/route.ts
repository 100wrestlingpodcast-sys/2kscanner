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

// Helper functions for date normalization and parsing
function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.trim().replace(/[-.]/g, "/");
  const parts = clean.split("/");
  if (parts.length === 3) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);
    const year = p3 < 100 ? 2000 + p3 : p3;
    
    // Season heuristic: BSN 2K league games happen between March (3) and August (8)
    const isInsideSeason = (m: number) => m >= 3 && m <= 8;
    
    let month = p1;
    let day = p2;
    
    if (isInsideSeason(p1) && !isInsideSeason(p2)) {
      month = p1;
      day = p2;
    } else if (!isInsideSeason(p1) && isInsideSeason(p2)) {
      month = p2;
      day = p1;
    } else {
      // Default to MM/DD/YYYY if ambiguous or both are valid
      month = p1;
      day = p2;
    }
    
    return new Date(year, month - 1, day);
  }
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return new Date(clean);
  }
  
  return null;
}

function cleanAndCompareDates(d1: string, d2: string): boolean {
  if (!d1 || !d2) return false;
  const clean1 = d1.trim().replace(/[-.]/g, "/");
  const clean2 = d2.trim().replace(/[-.]/g, "/");
  if (clean1 === clean2) return true;
  
  const p1 = clean1.split("/");
  const p2 = clean2.split("/");
  
  if (p1.length === 3 && p2.length === 3) {
    const day1 = parseInt(p1[0], 10);
    const month1 = parseInt(p1[1], 10);
    const year1 = parseInt(p1[2], 10);
    
    const day2 = parseInt(p2[0], 10);
    const month2 = parseInt(p2[1], 10);
    const year2 = parseInt(p2[2], 10);
    
    const y1 = year1 < 100 ? 2000 + year1 : year1;
    const y2 = year2 < 100 ? 2000 + year2 : year2;
    
    if (y1 !== y2) return false;
    
    const matchSame = (day1 === day2 && month1 === month2);
    const matchFlipped = (day1 === month2 && month1 === day2);
    
    return matchSame || matchFlipped;
  }
  return false;
}

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
    const { data, destinations, semana, fecha, scores, winner, isForfeit } = await req.json();

    if (!data || !destinations) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const { scoreboard, individual } = destinations;
    
    // Autogenerar o buscar el Game ID
    let finalGameId = "BSN001";
    let dateStr = fecha || new Date().toLocaleDateString("es-PR", {
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

    // 3. Resolver Game ID y Fecha desde Resultados_Input y actualizar marcador
    let matchedGameId: string | null = null;
    let matchedDate: string | null = null;
    let matchedRowIndex: number | null = null;
    
    // Equipos escaneados
    const scannedTeams = Array.from(new Set(data.map((p: any) => p.team)))
      .map((t: any) => String(t).toLowerCase().trim());

    if (scannedTeams.length > 0) {
      try {
        const resInput = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "Resultados_Input!A1:I250",
        });
        const inputRows = resInput.data.values || [];
        
        const targetDateObj = parseSheetDate(fecha) || new Date();
        
        let bestCandidateRowIndex: number | null = null;
        let minDiffMs = Infinity;
        let bestCandidateGameId: string | null = null;
        let bestCandidateDate: string | null = null;

        let bestOverallRowIndex: number | null = null;
        let minOverallDiffMs = Infinity;
        let bestOverallGameId: string | null = null;
        let bestOverallDate: string | null = null;

        for (let i = 0; i < inputRows.length; i++) {
          const row = inputRows[i];
          const gId = row[0];
          const rSemana = row[1];
          const rDate = row[2];
          const homeTeam = row[3];
          const awayTeam = row[4];
          
          if (gId && homeTeam && awayTeam) {
            const normalizedHome = homeTeam.toLowerCase().trim();
            const normalizedAway = awayTeam.toLowerCase().trim();
            
            const matchesHome = scannedTeams.some(t => t.includes(normalizedHome) || normalizedHome.includes(t));
            const matchesAway = scannedTeams.some(t => t.includes(normalizedAway) || normalizedAway.includes(t));
            
            if (matchesHome && matchesAway) {
              // Si especificó semana específica, la semana debe coincidir
              if (semana && semana !== "Actual") {
                if (rSemana.toLowerCase().trim() === semana.toLowerCase().trim()) {
                  matchedGameId = gId;
                  matchedDate = rDate;
                  matchedRowIndex = i;
                  break;
                }
              } else {
                // Modo "Actual":
                // 1. Si coincide la fecha exacta (coincidencia robusta), es nuestro juego prioritario
                const isSameDate = cleanAndCompareDates(rDate, fecha);
                if (isSameDate) {
                  matchedGameId = gId;
                  matchedDate = rDate;
                  matchedRowIndex = i;
                  break;
                }
                
                // 2. Si no coincide exactamente, calculamos distancia de fecha
                const scheduledDateObj = parseSheetDate(rDate);
                if (scheduledDateObj) {
                  const diffMs = Math.abs(targetDateObj.getTime() - scheduledDateObj.getTime());
                  
                  // Candidato viable: marcador vacío
                  const ptsLocal = row[5];
                  const ptsVisitante = row[6];
                  const isEmptyScore = !ptsLocal && !ptsVisitante;
                  
                  if (isEmptyScore && diffMs < minDiffMs) {
                    minDiffMs = diffMs;
                    bestCandidateGameId = gId;
                    bestCandidateDate = rDate;
                    bestCandidateRowIndex = i;
                  }

                  // Candidato global (por si todos los partidos tienen marcador, seleccionamos el más cercano)
                  if (diffMs < minOverallDiffMs) {
                    minOverallDiffMs = diffMs;
                    bestOverallGameId = gId;
                    bestOverallDate = rDate;
                    bestOverallRowIndex = i;
                  }
                }
              }
            }
          }
        }

        // Si no hubo coincidencia exacta de fecha para la semana actual, usar el candidato vacío más cercano
        if (!matchedGameId && bestCandidateRowIndex !== null) {
          matchedGameId = bestCandidateGameId;
          matchedDate = bestCandidateDate;
          matchedRowIndex = bestCandidateRowIndex;
        }
        
        // Fallback: si no hay ninguno vacío, tomar el más cercano de fecha global
        if (!matchedGameId && bestOverallRowIndex !== null) {
          matchedGameId = bestOverallGameId;
          matchedDate = bestOverallDate;
          matchedRowIndex = bestOverallRowIndex;
        }

        // Fallback absoluto por equipos (primera fila encontrada)
        if (!matchedGameId) {
          for (let i = 0; i < inputRows.length; i++) {
            const row = inputRows[i];
            const gId = row[0];
            const homeTeam = row[3];
            const awayTeam = row[4];
            if (gId && homeTeam && awayTeam) {
              const normalizedHome = homeTeam.toLowerCase().trim();
              const normalizedAway = awayTeam.toLowerCase().trim();
              const matchesHome = scannedTeams.some(t => t.includes(normalizedHome) || normalizedHome.includes(t));
              const matchesAway = scannedTeams.some(t => t.includes(normalizedAway) || normalizedAway.includes(t));
              if (matchesHome && matchesAway) {
                matchedGameId = gId;
                matchedDate = row[2];
                matchedRowIndex = i;
                break;
              }
            }
          }
        }

        // Si encontramos el partido, actualizamos sus resultados en Resultados_Input
        if (matchedRowIndex !== null && matchedRowIndex !== undefined) {
          finalGameId = matchedGameId || "BSN001";
          
          // Modo Semana Actual & Modo Histórico: siempre actualizamos los marcadores y ganador del partido
          const rowNum = matchedRowIndex + 1;
          const row = inputRows[matchedRowIndex];
          const homeTeam = row[3];
          const awayTeam = row[4];
          
          let homeScore = 0;
          let awayScore = 0;
          
          const homeName = String(homeTeam).toLowerCase().trim();
          const awayName = String(awayTeam).toLowerCase().trim();
          
          // Buscar en scores del payload
          for (const [tName, val] of Object.entries(scores || {})) {
            const normTName = tName.toLowerCase().trim();
            if (normTName.includes(homeName) || homeName.includes(normTName)) {
              homeScore = Number(val);
            }
            if (normTName.includes(awayName) || awayName.includes(normTName)) {
              awayScore = Number(val);
            }
          }

          if (isForfeit) {
            const normWinnerName = String(winner).toLowerCase().trim();
            if (normWinnerName.includes(homeName) || homeName.includes(normWinnerName)) {
              homeScore = 20;
              awayScore = 0;
            } else {
              homeScore = 0;
              awayScore = 20;
            }
          }

          const targetDate = fecha || matchedDate || dateStr;

          // Escribir en Resultados_Input: Fecha (C), Equipo Local (D), Equipo Visitante (E), PTS Local (F), PTS Visitante (G), Ganador (H), Notas (I)
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Resultados_Input!C${rowNum}:I${rowNum}`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: [
                [
                  targetDate,
                  homeTeam,
                  awayTeam,
                  isForfeit ? homeScore : (homeScore || 0),
                  isForfeit ? awayScore : (awayScore || 0),
                  winner || "",
                  isForfeit ? "forfait" : ""
                ]
              ]
            }
          });

          dateStr = targetDate;
        } else {
          return NextResponse.json({ 
            error: `No se encontró ningún juego registrado para ${scannedTeams.join(" vs ")} ${semana !== "Actual" ? `en la "${semana}"` : ""} en la pestaña Resultados_Input. Por favor verifica que los nombres de los equipos coincidan con el calendario.` 
          }, { status: 404 });
        }

      } catch (err: any) {
        console.error("Error consultando/actualizando Resultados_Input:", err);
        return NextResponse.json({ error: "Error de servidor al sincronizar Resultados_Input: " + err.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: "No player stats found in request payload" }, { status: 400 });
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
          if (!p.username) return;

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
