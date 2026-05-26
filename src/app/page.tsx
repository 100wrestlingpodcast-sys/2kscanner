'use client';

import React, { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DragDropZone } from "@/components/ui/DragDropZone";
import { 
  Users, UploadCloud, Globe, Database, CheckCircle, 
  Edit3, AlertCircle, LogOut, Loader2, Plus, Trash2, Key, HelpCircle, Trophy, Bell
} from "lucide-react";
import Login from "@/components/Login";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  query, 
  orderBy 
} from "firebase/firestore";

interface ValidPlayer {
  name: string;
  team: string;
  gp: number;
  pts: number;
  ppg: number;
  reb: number;
  rpg: number;
  ast: number;
  apg: number;
  stl: number;
  spg: number;
  blk: number;
  bpg: number;
  pos: string;
}

interface ScannedPlayer {
  id: string;
  username: string;
  team: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgm: number;
  tpm: number;
  nameMatched: boolean;
}

interface CaptainProfile {
  role: 'captain' | 'admin' | '';
  authorized: boolean;
  team: string;
  username: string;
  activeView: 'admin' | 'experience';
}

const TEAM_THEMES: Record<string, { primary: string; secondary: string; glow: string; logo: string }> = {
  'Capitanes': { primary: '#facc15', secondary: '#000000', glow: 'rgba(250, 204, 21, 0.6)', logo: 'capitanes.png' },
  'Gigantes': { primary: '#ef4444', secondary: '#facc15', glow: 'rgba(239, 68, 68, 0.6)', logo: 'gigantes.png' },
  'Vaqueros': { primary: '#2563eb', secondary: '#f97316', glow: 'rgba(37, 99, 235, 0.6)', logo: 'vaqueros.png' },
  'Leones': { primary: '#ef4444', secondary: '#ffffff', glow: 'rgba(220, 38, 38, 0.6)', logo: 'leones.png' },
  'Indios': { primary: '#16a34a', secondary: '#ffffff', glow: 'rgba(22, 163, 74, 0.6)', logo: 'indios.png' },
  'Atléticos': { primary: '#0ea5e9', secondary: '#f97316', glow: 'rgba(14, 165, 233, 0.6)', logo: 'atleticos.png' },
  'Atleticos': { primary: '#0ea5e9', secondary: '#f97316', glow: 'rgba(14, 165, 233, 0.6)', logo: 'atleticos.png' },
  'Piratas': { primary: '#991b1b', secondary: '#ffffff', glow: 'rgba(153, 27, 27, 0.6)', logo: 'piratas.png' },
  'Criollos': { primary: '#d946ef', secondary: '#ec4899', glow: 'rgba(217, 70, 239, 0.6)', logo: 'criollos.png' },
  'Osos': { primary: '#3b82f6', secondary: '#facc15', glow: 'rgba(59, 130, 246, 0.6)', logo: 'osos.png' },
  'Cangrejeros': { primary: '#ea580c', secondary: '#ffffff', glow: 'rgba(234, 88, 12, 0.6)', logo: 'cangrejeros.png' },
  'Maratonistas': { primary: '#eab308', secondary: '#ef4444', glow: 'rgba(234, 179, 8, 0.6)', logo: 'coamo.png' },
  'Cariduros': { primary: '#10b981', secondary: '#ffffff', glow: 'rgba(16, 185, 129, 0.6)', logo: 'cariduros.png' }
};

const getTeamTheme = (teamName: string) => {
  if (!teamName) return { primary: '#38bdf8', secondary: '#1e3a8a', glow: 'rgba(56,189,248,0.4)', logo: 'bsn_logo.png' };
  const key = Object.keys(TEAM_THEMES).find(k => teamName.toLowerCase().trim().includes(k.toLowerCase().trim()) || k.toLowerCase().trim().includes(teamName.toLowerCase().trim()));
  return key ? TEAM_THEMES[key] : { primary: '#38bdf8', secondary: '#1e3a8a', glow: 'rgba(56,189,248,0.4)', logo: 'bsn_logo.png' };
};

const getPlayerPPG = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return 10 + (Math.abs(hash) % 150) / 10;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [lang, setLang] = useState<'en' | 'es'>('es');
  const [destinations, setDestinations] = useState({ scoreboard: true, individual: true });
  const [isScanning, setIsScanning] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedPlayer[]>([]);
  const [validPlayers, setValidPlayers] = useState<ValidPlayer[]>([]);

  // Perfil del Capitán / Administrador
  const [captainProfile, setCaptainProfile] = useState<CaptainProfile>({
    role: "",
    authorized: false,
    team: "",
    username: "",
    activeView: "admin"
  });

  // Variables de Modal de Configuración
  const [profileRole, setProfileRole] = useState<'captain' | 'admin' | ''>('');
  const [profileTeam, setProfileTeam] = useState("");
  const [profileUser, setProfileUser] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [adminError, setAdminError] = useState("");
  const [simulatedTeam, setSimulatedTeam] = useState("");

  // Variables para la clave de subida de estadísticas
  const [showUploadAuth, setShowUploadAuth] = useState(false);
  const [uploadKey, setUploadKey] = useState("");
  const [uploadKeyError, setUploadKeyError] = useState("");

  const [pendingGames, setPendingGames] = useState<any[]>([]);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [editingGameData, setEditingGameData] = useState<any[]>([]);
  const [editingGameDestinations, setEditingGameDestinations] = useState({ scoreboard: true, individual: true });

  useEffect(() => {
    if (!user || captainProfile.role !== 'admin') return;

    const q = query(collection(db, "pending_games"), orderBy("submittedAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const games = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPendingGames(games);
    }, (err) => {
      console.error("Error listening to pending games:", err);
    });

    return () => unsubscribe();
  }, [user, captainProfile.role]);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch("/api/sheets?action=getPlayers");
        const data = await res.json();
        if (data.players) {
          setValidPlayers(data.players);
        }
      } catch (e) {
        console.error("Error fetching valid players", e);
      }
    };
    fetchPlayers();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("bsn_captain_profile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCaptainProfile(parsed);
        if (parsed.role === 'admin' && parsed.team) {
          setSimulatedTeam(parsed.team);
        }
      } catch (e) {
        console.error("Error parsing captain profile", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const isExperienceMode = captainProfile.role === 'admin' && captainProfile.activeView === 'experience';
    const activeTeam = captainProfile.role === 'captain' 
      ? captainProfile.team 
      : (isExperienceMode ? simulatedTeam : "");

    const activeTheme = getTeamTheme(activeTeam);
    document.body.style.backgroundColor = '#06060A';
    if (activeTeam) {
      document.body.style.backgroundImage = `
        radial-gradient(circle at 50% 35%, ${activeTheme.primary}16, transparent 65%),
        radial-gradient(circle at 85% 20%, ${activeTheme.primary}08, transparent 45%),
        radial-gradient(circle at 15% 80%, ${activeTheme.secondary || activeTheme.primary}06, transparent 45%)
      `;
      document.body.style.backgroundBlendMode = 'normal, normal, normal';
    } else {
      document.body.style.backgroundImage = `
        radial-gradient(circle at 80% 20%, ${activeTheme.primary}08, transparent 45%),
        radial-gradient(circle at 20% 80%, ${activeTheme.secondary}04, transparent 45%)
      `;
      document.body.style.backgroundBlendMode = 'normal, normal';
    }
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.transition = 'background 0.5s ease-in-out, background-color 0.5s ease-in-out';
  }, [captainProfile.role, captainProfile.activeView, captainProfile.team, simulatedTeam, user]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const toggleLanguage = () => {
    setLang(lang === 'en' ? 'es' : 'en');
  };

  const toggleDestination = (key: 'scoreboard' | 'individual') => {
    setDestinations(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveCaptainProfile = (role: 'captain' | 'admin', team: string, username: string, authState = false) => {
    const profile: CaptainProfile = {
      role,
      authorized: authState,
      team: role === 'captain' ? team : '',
      username: role === 'captain' ? username : 'Administrador',
      activeView: role === 'captain' ? 'experience' : 'admin'
    };
    setCaptainProfile(profile);
    localStorage.setItem("bsn_captain_profile", JSON.stringify(profile));
  };

  const handleVerifyAdminCode = () => {
    setAdminError("");
    const secretCode = process.env.NEXT_PUBLIC_ADMIN_PASSCODE || "adminbsn2k";
    if (adminCode.trim().toUpperCase() === secretCode.trim().toUpperCase()) {
      const profile: CaptainProfile = {
        role: 'admin',
        authorized: true,
        team: '',
        username: 'Administrador de la Liga',
        activeView: 'admin'
      };
      setCaptainProfile(profile);
      localStorage.setItem("bsn_captain_profile", JSON.stringify(profile));
      setAdminCode("");
    } else {
      setAdminError(lang === 'en' ? "Invalid authorization code." : "Código de autorización incorrecto.");
    }
  };

  const handleResetCaptainProfile = () => {
    setCaptainProfile({ role: "", authorized: false, team: "", username: "", activeView: "admin" });
    setProfileRole('');
    setProfileTeam("");
    setProfileUser("");
    setAdminCode("");
    setAdminError("");
    setSimulatedTeam("");
    localStorage.removeItem("bsn_captain_profile");
  };

  const handleToggleAdminView = (view: 'admin' | 'experience') => {
    const updated = { ...captainProfile, activeView: view };
    if (view === 'admin') {
      updated.team = "";
    } else {
      // Por defecto, escoge el primer equipo de la lista
      const uniqueTeams = Array.from(new Set(validPlayers.map(p => p.team))).sort();
      const defaultTeam = simulatedTeam || uniqueTeams[0] || "";
      updated.team = defaultTeam;
      setSimulatedTeam(defaultTeam);
    }
    setCaptainProfile(updated);
    localStorage.setItem("bsn_captain_profile", JSON.stringify(updated));
  };

  const handleSimulateTeamChange = (teamName: string) => {
    setSimulatedTeam(teamName);
    const updated = { ...captainProfile, team: teamName };
    setCaptainProfile(updated);
    localStorage.setItem("bsn_captain_profile", JSON.stringify(updated));
  };

  const handleImageSelected = async (file: File) => {
    setIsScanning(true);
    setScannedData([]);
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Str = (reader.result as string).split(",")[1];

        const scanRes = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64Str }),
        });
        const scanData = await scanRes.json();
        
        if (scanData.error) {
          alert("Error de IA: " + scanData.error);
          setIsScanning(false);
          return;
        }

        const processedData = scanData.data.map((player: any, index: number) => {
          const normalizedUsername = player.username?.trim();
          const matchedPlayer = validPlayers.find(
            (p) => p.name.trim().toLowerCase() === normalizedUsername.toLowerCase()
          );

          return {
            id: String(Date.now() + index),
            username: normalizedUsername || "",
            team: matchedPlayer ? matchedPlayer.team : (player.team || activeTeam || ""),
            pts: player.pts || 0,
            reb: player.reb || 0,
            ast: player.ast || 0,
            stl: player.stl || 0,
            blk: player.blk || 0,
            fgm: player.fgm || 0,
            tpm: player.tpm || 0,
            nameMatched: !!matchedPlayer,
          };
        });

        setScannedData(processedData);
        setIsScanning(false);
        setIsReviewing(true);
      };
      
      reader.onerror = () => {
        alert("Error al leer el archivo.");
        setIsScanning(false);
      };
    } catch (error) {
      console.error(error);
      alert("Error al procesar la imagen.");
      setIsScanning(false);
    }
  };

  const handleManualMode = () => {
    setScannedData([
      {
        id: String(Date.now()),
        username: "",
        team: activeTeam || (validPlayers[0]?.team || ""),
        pts: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        fgm: 0,
        tpm: 0,
        nameMatched: false
      }
    ]);
    setIsReviewing(true);
  };

  const handleAddRow = () => {
    setScannedData(prev => [
      ...prev,
      {
        id: String(Date.now()),
        username: "",
        team: activeTeam || (validPlayers[0]?.team || ""),
        pts: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        fgm: 0,
        tpm: 0,
        nameMatched: false
      }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setScannedData(prev => prev.filter(p => p.id !== id));
  };

  const handleUploadToPendingFirestore = async () => {
    setIsScanning(true);
    try {
      const teamPoints: Record<string, number> = {};
      scannedData.forEach(p => {
        teamPoints[p.team] = (teamPoints[p.team] || 0) + p.pts;
      });

      const teams = Object.keys(teamPoints);
      let winningTeam = "";
      if (teams.length >= 2) {
        winningTeam = teamPoints[teams[0]] > teamPoints[teams[1]] ? teams[0] : teams[1];
      } else if (teams.length === 1) {
        winningTeam = teams[0];
      }

      const finalData = scannedData.map(p => {
        const opponent = teams.find(t => t !== p.team) || "Desconocido";
        const result = p.team === winningTeam ? "W" : "L";
        return { ...p, opponent, result };
      });

      await addDoc(collection(db, "pending_games"), {
        submittedBy: captainProfile.username || "Capitán",
        submittedAt: new Date().toISOString(),
        team: activeTeam,
        data: finalData,
        destinations: destinations
      });

      alert(lang === 'en' 
        ? "Stats sent successfully! Awaiting league administrator review." 
        : "¡Estadísticas enviadas con éxito! Quedaron en cola para revisión del Administrador de la Liga.");
      
      setIsReviewing(false);
      setScannedData([]);
    } catch (err: any) {
      console.error("Firestore Upload Error: ", err);
      alert(lang === 'en' ? "Error saving stats to review queue." : "Error al guardar las estadísticas en la cola de revisión.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirm = async () => {
    if (scannedData.length === 0) {
      alert(lang === 'en' ? "Please add at least one player." : "Por favor añade al menos un jugador.");
      return;
    }

    const hasErrors = scannedData.some(p => !p.nameMatched);
    if (hasErrors) {
      alert(lang === 'en' ? "Please correct unmatched names before uploading." : "Por favor corrige los nombres no encontrados antes de subir.");
      return;
    }

    if (captainProfile.role === 'captain') {
      await handleUploadToPendingFirestore();
    } else {
      setShowUploadAuth(true);
      setUploadKey("");
      setUploadKeyError("");
    }
  };

  const handleExecuteUpload = async () => {
    setUploadKeyError("");
    if (uploadKey.trim().toLowerCase() === "bsn2k") {
      setShowUploadAuth(false);
      
      const teamPoints: Record<string, number> = {};
      scannedData.forEach(p => {
        teamPoints[p.team] = (teamPoints[p.team] || 0) + p.pts;
      });

      const teams = Object.keys(teamPoints);
      let winningTeam = "";
      if (teams.length >= 2) {
        winningTeam = teamPoints[teams[0]] > teamPoints[teams[1]] ? teams[0] : teams[1];
      } else if (teams.length === 1) {
        winningTeam = teams[0];
      }

      const finalData = scannedData.map(p => {
        const opponent = teams.find(t => t !== p.team) || "Desconocido";
        const result = p.team === winningTeam ? "W" : "L";
        return { ...p, opponent, result };
      });
      
      try {
        setIsScanning(true); // Mostrar spinner
        const res = await fetch("/api/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: finalData, destinations })
        });
        const resData = await res.json();
        
        setIsScanning(false);
        if (resData.success) {
          alert(lang === 'en' ? "Stats Uploaded Successfully!" : "¡Estadísticas subidas con éxito a Google Sheets!");
          setIsReviewing(false);
          setScannedData([]);
        } else {
          alert("Error: " + resData.error);
        }
      } catch (err) {
        setIsScanning(false);
        alert("Network Error");
      }
    } else {
      setUploadKeyError(lang === 'en' ? "Invalid upload key." : "Clave de envío incorrecta.");
    }
  };

  const handlePendingDataChange = (index: number, field: string, value: any) => {
    setEditingGameData(prev => prev.map((p, idx) => {
      if (idx === index) {
        const updated = { 
          ...p, 
          [field]: field === 'username' || field === 'team' ? value : Number(value) 
        };
        const matchedPlayer = validPlayers.find(
          (vp) => vp.name.trim().toLowerCase() === updated.username.trim().toLowerCase() && 
                  vp.team.trim().toLowerCase() === updated.team.trim().toLowerCase()
        );
        updated.nameMatched = !!matchedPlayer;
        return updated;
      }
      return p;
    }));
  };

  const handleAddRowToPending = () => {
    setEditingGameData(prev => [
      ...prev,
      {
        id: String(Date.now()),
        username: "",
        team: editingGameData[0]?.team || validPlayers[0]?.team || "",
        pts: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        fgm: 0,
        tpm: 0,
        nameMatched: false
      }
    ]);
  };

  const handleRemoveRowFromPending = (index: number) => {
    setEditingGameData(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleApprovePendingGame = async (gameId: string) => {
    if (editingGameData.length === 0) {
      alert(lang === 'en' ? "Please add at least one player." : "Por favor añade al menos un jugador.");
      return;
    }

    const hasErrors = editingGameData.some(p => !p.nameMatched);
    if (hasErrors) {
      alert(lang === 'en' ? "Please correct unmatched names before approving." : "Por favor corrige los nombres no encontrados antes de aprobar.");
      return;
    }

    if (!confirm(lang === 'en' ? "Are you sure you want to approve and register this game?" : "¿Estás seguro de que deseas aprobar y registrar este partido en Google Sheets?")) {
      return;
    }

    setIsScanning(true);
    try {
      const teamPoints: Record<string, number> = {};
      editingGameData.forEach(p => {
        teamPoints[p.team] = (teamPoints[p.team] || 0) + p.pts;
      });

      const teams = Object.keys(teamPoints);
      let winningTeam = "";
      if (teams.length >= 2) {
        winningTeam = teamPoints[teams[0]] > teamPoints[teams[1]] ? teams[0] : teams[1];
      } else if (teams.length === 1) {
        winningTeam = teams[0];
      }

      const finalData = editingGameData.map(p => {
        const opponent = teams.find(t => t !== p.team) || "Desconocido";
        const result = p.team === winningTeam ? "W" : "L";
        return { ...p, opponent, result };
      });

      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: finalData, destinations: editingGameDestinations })
      });
      const resData = await res.json();

      if (resData.success) {
        await deleteDoc(doc(db, "pending_games", gameId));
        alert(lang === 'en' ? "Game approved and registered successfully!" : "¡Partido aprobado y registrado exitosamente en Google Sheets!");
        setEditingGameId(null);
        setEditingGameData([]);
      } else {
        alert("Error de Google Sheets: " + resData.error);
      }
    } catch (err: any) {
      console.error("Approval Error:", err);
      alert(lang === 'en' ? "Network or database error during approval." : "Error de red o base de datos durante la aprobación.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleRejectPendingGame = async (gameId: string) => {
    if (!confirm(lang === 'en' ? "Are you sure you want to REJECT and delete this game? This action cannot be undone." : "¿Estás seguro de que deseas RECHAZAR y eliminar este partido? Esta acción no se puede deshacer y los datos se perderán.")) {
      return;
    }

    setIsScanning(true);
    try {
      await deleteDoc(doc(db, "pending_games", gameId));
      alert(lang === 'en' ? "Game rejected and deleted." : "Partido rechazado y eliminado con éxito.");
      if (editingGameId === gameId) {
        setEditingGameId(null);
        setEditingGameData([]);
      }
    } catch (err: any) {
      console.error("Rejection Error:", err);
      alert(lang === 'en' ? "Error deleting pending game." : "Error al eliminar el partido pendiente.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleDataChange = (id: string, field: keyof ScannedPlayer, value: string) => {
    setScannedData(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { 
          ...p, 
          [field]: field === 'username' || field === 'team' ? value : Number(value) 
        };
        
        // Validar si el jugador existe en el roster oficial del equipo
        const matchedPlayer = validPlayers.find(
          (vp) => vp.name.trim().toLowerCase() === updated.username.trim().toLowerCase() && 
                  vp.team.trim().toLowerCase() === updated.team.trim().toLowerCase()
        );
        updated.nameMatched = !!matchedPlayer;
        
        return updated;
      }
      return p;
    }));
  };

  // Traducciones completas en es y en
  const t = {
    en: {
      subtitle: "AI-Powered Scoreboard Detection",
      uploadTitle: "Upload Results",
      destTitle: "Save Destinations",
      selectOneOrBoth: "Select one or both",
      destScoreboard: "General Scoreboard (GAME_PLAYER_STATS)",
      destIndividual: "Individual Stats (Jugadores_lista)",
      recentGames: "Recent Games",
      scanning: "Scanning Image...",
      reviewData: "Review Data",
      confirmUpload: "Confirm & Upload",
      cancel: "Cancel",
      unmatchedError: "Unmatched Name",
      fixNames: "Fix unmatched names",
      aiWarning: "⚠️ The AI can make mistakes. Please verify that all stats are correct before uploading.",
      manualEntry: "Enter Stats Manually",
      addPlayer: "+ Add Player",
      topScorers: "Top Scorers (Season)",
      topScorersTeam: "Top Scorers",
      captainProfile: "Captain Profile",
      captainAverages: "Season Stats",
      changeProfile: "Change Profile",
      roleSelect: "Select Access Role",
      roleSelectDesc: "Configure your role to personalize the BSN 2K system.",
      roleCaptain: "Team Captain",
      roleAdmin: "League Admin",
      adminWaiting: "League Authorization Pending",
      adminWaitingDesc: "Waiting for authorization from the Main League Administrator. Enter the access key to unlock instantly.",
      enterPasscode: "Passcode",
      verifyCode: "Authorize Access",
      back: "Back",
      adminMode: "League Admin Mode (Global)",
      experienceMode: "Team Experience Mode",
      simulateTeam: "Simulate Team",
      noTeamSelected: "No team selected",
      logout: "Log Out",
      seasonAverages: "Your Season Averages",
      gpLabel: "GP",
      ppgLabel: "PPG",
      rpgLabel: "RPG",
      apgLabel: "APG",
      emptyRoster: "Roster empty or unselected"
    },
    es: {
      subtitle: "Detección de Tableros con IA",
      uploadTitle: "Subir Resultados",
      destTitle: "Destinos de Guardado",
      selectOneOrBoth: "Selecciona uno o ambos",
      destScoreboard: "Scoreboard General (GAME_PLAYER_STATS)",
      destIndividual: "Stats Individuales (Jugadores_lista)",
      recentGames: "Juegos Recientes",
      scanning: "Escaneando...",
      reviewData: "Revisar Datos del Partido",
      confirmUpload: "Confirmar y Subir",
      cancel: "Cancelar",
      unmatchedError: "Nombre no coincide",
      fixNames: "Corrige los nombres",
      aiWarning: "⚠️ La IA puede cometer errores. Por favor corrobora que todos los números estén en orden antes de subir.",
      manualEntry: "Ingresar Datos Manualmente",
      addPlayer: "+ Añadir Jugador",
      topScorers: "Líderes de Anotación (Temporada)",
      topScorersTeam: "Líderes de Anotación",
      captainProfile: "Perfil de Capitán",
      captainAverages: "Estadísticas de Temporada",
      changeProfile: "Cambiar",
      roleSelect: "Perfil de Entrada",
      roleSelectDesc: "Selecciona tu perfil de acceso para personalizar la plataforma BSN 2K.",
      roleCaptain: "Capitán de Equipo",
      roleAdmin: "Administrador de la Liga",
      adminWaiting: "Acceso Pendiente de Autorización",
      adminWaitingDesc: "Esperando autorización del Administrador Mayoritario. Ingresa la clave secreta de la liga para desbloquear de inmediato.",
      enterPasscode: "Clave de Autorización",
      verifyCode: "Verificar Clave",
      back: "Volver",
      adminMode: "Panel Administrador Global",
      experienceMode: "Experiencia de Equipo",
      simulateTeam: "Simular Roster",
      noTeamSelected: "Ningún equipo seleccionado",
      logout: "Salir",
      seasonAverages: "Tus Promedios de Temporada",
      gpLabel: "JJ",
      ppgLabel: "PPG",
      rpgLabel: "RPG",
      apgLabel: "APG",
      emptyRoster: "Roster vacío o no seleccionado"
    }
  };

  if (authLoading) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><Loader2 className="w-12 h-12 text-red-500 animate-spin" /></div>;
  if (!user) return <Login />;

  const needsProfileSetup = user && !captainProfile.role;
  const isPendingAdminAuth = captainProfile.role === 'admin' && !captainProfile.authorized;

  // Lógica de perfil activo e identidades temáticas
  const isExperienceMode = captainProfile.role === 'admin' && captainProfile.activeView === 'experience';
  const activeTeam = captainProfile.role === 'captain' 
    ? captainProfile.team 
    : (isExperienceMode ? simulatedTeam : "");
    
  const activeUser = captainProfile.role === 'captain'
    ? captainProfile.username
    : "";

  const theme = getTeamTheme(activeTeam);
  
  // Roster del equipo activo
  const teamPlayers = activeTeam
    ? validPlayers.filter(p => p.team.toLowerCase().trim() === activeTeam.toLowerCase().trim())
    : [];

  // Lista de todos los equipos únicos de la liga
  const uniqueTeams = Array.from(new Set(validPlayers.map(p => p.team))).sort();

  // Averages reales del Capitán
  const captainStats = activeUser 
    ? validPlayers.find(p => p.name.toLowerCase().trim() === activeUser.toLowerCase().trim()) 
    : null;

  // Estadísticas dinámicas de líderes del widget lateral
  const activeScorers = activeTeam
    ? teamPlayers
        .map(p => ({ name: p.name, team: p.team, pts: p.ppg > 0 ? p.ppg : getPlayerPPG(p.name) }))
        .sort((a, b) => b.pts - a.pts)
        .slice(0, 5)
    : validPlayers
        .map(p => ({ name: p.name, team: p.team, pts: p.ppg > 0 ? p.ppg : getPlayerPPG(p.name) }))
        .sort((a, b) => b.pts - a.pts)
        .slice(0, 5);

  return (
    <div 
      className="min-h-screen p-6 md:p-12 font-sans text-white selection:bg-bsn-neon selection:text-black transition-all duration-500 bg-transparent"
      style={{
        ['--color-bsn-neon' as any]: theme.primary,
        ['--color-bsn-blue' as any]: theme.secondary,
        ['--color-bsn-light-blue' as any]: theme.primary,
        ['--color-bsn-red' as any]: theme.secondary,
        ['--color-bsn-dark-red' as any]: '#7f1d1d'
      } as React.CSSProperties}
    >
      {/* Modal de Selección de Roles */}
      {needsProfileSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
          <GlassCard glowColor="neon" className="max-w-xl w-full p-8 border border-bsn-neon/30 shadow-[0_0_40px_rgba(56,189,248,0.2)]">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-bsn-neon/10 flex items-center justify-center border border-bsn-neon/30 mb-4 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
                <Users className="w-8 h-8 text-bsn-neon animate-pulse" />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-bsn-neon to-white">{t[lang].roleSelect}</h2>
              <p className="text-gray-400 text-sm mt-2 mb-6">{t[lang].roleSelectDesc}</p>
            </div>

            {profileRole === '' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => setProfileRole('captain')}
                  className="flex flex-col items-center justify-center p-6 bg-white/5 border border-white/10 hover:border-bsn-neon/60 hover:bg-bsn-neon/5 rounded-2xl transition-all duration-300 group text-center"
                >
                  <Trophy className="w-10 h-10 text-gray-400 group-hover:text-bsn-neon mb-3 transition-colors" />
                  <span className="font-black uppercase tracking-wider text-base mb-1">{t[lang].roleCaptain}</span>
                  <span className="text-xs text-gray-500 font-medium">Panel personalizado con temática y estadísticas de tu roster</span>
                </button>

                <button 
                  onClick={() => setProfileRole('admin')}
                  className="flex flex-col items-center justify-center p-6 bg-white/5 border border-white/10 hover:border-bsn-neon/60 hover:bg-bsn-neon/5 rounded-2xl transition-all duration-300 group text-center"
                >
                  <Key className="w-10 h-10 text-gray-400 group-hover:text-bsn-neon mb-3 transition-colors" />
                  <span className="font-black uppercase tracking-wider text-base mb-1">{t[lang].roleAdmin}</span>
                  <span className="text-xs text-gray-500 font-medium">Acceso total a la liga, perfiles globales y simulación múltiple</span>
                </button>
              </div>
            ) : profileRole === 'captain' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Equipo</label>
                  <select 
                    value={profileTeam} 
                    onChange={(e) => { setProfileTeam(e.target.value); setProfileUser(""); }} 
                    className="w-full bg-black/60 border border-white/20 rounded-xl p-3 outline-none text-white focus:border-bsn-neon text-sm font-medium transition-colors"
                  >
                    <option value="">-- Selecciona tu Equipo --</option>
                    {Array.from(new Set(validPlayers.map(p => p.team))).sort().map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Tu Jugador / Username</label>
                  <select 
                    value={profileUser} 
                    onChange={(e) => setProfileUser(e.target.value)} 
                    className="w-full bg-black/60 border border-white/20 rounded-xl p-3 outline-none text-white focus:border-bsn-neon text-sm font-medium transition-colors"
                    disabled={!profileTeam}
                  >
                    <option value="">-- Selecciona tu Jugador --</option>
                    {validPlayers
                      .filter(p => p.team === profileTeam)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(player => (
                        <option key={player.name} value={player.name}>{player.name}</option>
                      ))}
                  </select>
                </div>
                <div className="flex gap-4 pt-2">
                  <button 
                    onClick={() => { setProfileRole(''); setProfileTeam(''); setProfileUser(''); }}
                    className="w-1/3 py-3 border border-white/20 text-gray-300 font-bold uppercase text-sm rounded-xl tracking-wider hover:bg-white/5 transition-colors"
                  >
                    {t[lang].back}
                  </button>
                  <button 
                    onClick={() => {
                      if (profileTeam && profileUser) {
                        handleSaveCaptainProfile('captain', profileTeam, profileUser, true);
                      } else {
                        alert("Por favor selecciona tu equipo y jugador.");
                      }
                    }} 
                    disabled={!profileTeam || !profileUser}
                    className="w-2/3 py-3 bg-gradient-to-r from-bsn-neon to-bsn-blue text-white font-black uppercase text-sm rounded-xl tracking-wider hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(56,189,248,0.3)]"
                  >
                    Comenzar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-xs font-semibold leading-relaxed">
                  🔐 {t[lang].adminWaitingDesc}
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">{t[lang].enterPasscode}</label>
                  <input 
                    type="password"
                    placeholder="••••••••"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 focus:border-bsn-neon rounded-xl p-3 outline-none text-white text-sm font-semibold tracking-widest transition-colors"
                  />
                  {adminError && <p className="text-red-500 text-xs font-bold mt-1">{adminError}</p>}
                </div>
                <div className="flex gap-4 pt-2">
                  <button 
                    onClick={() => { setProfileRole(''); setAdminCode(''); setAdminError(''); }}
                    className="w-1/3 py-3 border border-white/20 text-gray-300 font-bold uppercase text-sm rounded-xl tracking-wider hover:bg-white/5 transition-colors"
                  >
                    {t[lang].back}
                  </button>
                  <button 
                    onClick={handleVerifyAdminCode}
                    disabled={!adminCode}
                    className="w-2/3 py-3 bg-gradient-to-r from-bsn-neon to-bsn-blue text-white font-black uppercase text-sm rounded-xl tracking-wider hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(56,189,248,0.3)]"
                  >
                    {t[lang].verifyCode}
                  </button>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Lockscreen para Administradores de la Liga sin Autorizar */}
      {isPendingAdminAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
          <GlassCard glowColor="red" className="max-w-md w-full p-8 border border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.2)]">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30 mb-4">
                <Key className="w-8 h-8 text-red-500 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-white">{t[lang].adminWaiting}</h2>
              <p className="text-gray-400 text-sm mt-2">{t[lang].adminWaitingDesc}</p>
            </div>
            <div className="space-y-4">
              <input 
                type="password"
                placeholder="••••••••"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                className="w-full bg-black/60 border border-white/20 focus:border-red-500 rounded-xl p-3 outline-none text-white text-sm font-semibold tracking-widest transition-colors text-center"
              />
              {adminError && <p className="text-red-500 text-xs font-bold text-center">{adminError}</p>}
              <button 
                onClick={handleVerifyAdminCode}
                disabled={!adminCode}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase text-sm rounded-xl tracking-wider disabled:opacity-50 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.3)]"
              >
                {t[lang].verifyCode}
              </button>
              <button 
                onClick={handleResetCaptainProfile}
                className="w-full py-3 border border-white/10 text-gray-400 font-bold uppercase text-xs rounded-xl hover:bg-white/5 transition-colors"
              >
                {t[lang].back}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Cabecera de la Aplicación */}
      <header className="flex flex-col xl:flex-row justify-between items-center mb-12 gap-6 xl:gap-0">
        <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
          <a href="/" className="hover:scale-105 transition-transform duration-300">
            <img 
              src={activeTeam ? `/${theme.logo}` : "/bsn_logo.png"} 
              alt="Team Logo" 
              className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-[0_0_10px_var(--color-bsn-neon)] transition-all duration-500" 
              onError={(e) => { (e.target as any).src = "/bsn_logo.png"; }}
            />
          </a>
          <div>
            <a href="/">
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-bsn-neon to-white drop-shadow-[0_0_10px_rgba(56,189,248,0.2)] hover:opacity-90 transition-opacity">
                {activeTeam ? activeTeam.toUpperCase() : "2K Stats Scanner"}
              </h1>
            </a>
            <p className="text-gray-400 mt-2 font-medium tracking-wide flex flex-col md:flex-row items-center gap-2">
              {captainProfile.role === 'admin' ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-bold text-red-500">ADMIN GLOBAL:</span>
                  <span className="text-gray-300 font-bold">
                    {captainProfile.activeView === 'admin' ? t[lang].adminMode : `${t[lang].experienceMode} (${activeTeam || t[lang].noTeamSelected})`}
                  </span>
                </span>
              ) : (
                <span className="font-bold text-bsn-neon">
                  {captainProfile.username ? `Capitán: ${captainProfile.username}` : t[lang].subtitle}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Toggles y Botones de Control de Administrador y Sesión */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          {captainProfile.role === 'admin' && (
            <div className="flex items-center bg-black/60 border border-white/10 rounded-xl p-1 gap-1">
              <button 
                onClick={() => handleToggleAdminView('admin')}
                className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${captainProfile.activeView === 'admin' ? 'bg-bsn-neon text-black' : 'text-gray-400 hover:text-white'}`}
              >
                Vista Admin
              </button>
              <button 
                onClick={() => handleToggleAdminView('experience')}
                className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${captainProfile.activeView === 'experience' ? 'bg-bsn-neon text-black' : 'text-gray-400 hover:text-white'}`}
              >
                Experiencia
              </button>
            </div>
          )}

          {isExperienceMode && (
            <div className="flex items-center bg-black/60 border border-white/10 rounded-xl p-1.5 gap-2">
              <span className="text-[10px] font-black uppercase text-gray-500 pl-1">{t[lang].simulateTeam}:</span>
              <select 
                value={simulatedTeam} 
                onChange={(e) => handleSimulateTeamChange(e.target.value)}
                className="bg-black border border-white/10 rounded-lg p-1 outline-none text-xs font-bold text-white focus:border-bsn-neon"
              >
                {uniqueTeams.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            {captainProfile.role && (
              <button 
                onClick={handleResetCaptainProfile} 
                className="flex items-center space-x-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-black uppercase tracking-wider transition-colors"
              >
                <Users className="w-4 h-4 text-bsn-neon" />
                <span>{t[lang].changeProfile}</span>
              </button>
            )}
            <button 
              onClick={toggleLanguage} 
              className="flex items-center space-x-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-black uppercase tracking-wider transition-colors"
            >
              <Globe className="w-4 h-4 text-gray-400" />
              <span>{lang === 'en' ? 'ES' : 'EN'}</span>
            </button>
            <button 
              onClick={handleLogout} 
              className="flex items-center space-x-2 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 rounded-lg text-xs font-black uppercase tracking-wider transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{t[lang].logout}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Panel Izquierdo: Creador/Escáner de Estadísticas */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* COLA DE APROBACIONES PENDIENTES (Solo para Administradores de la Liga) */}
          {captainProfile.role === 'admin' && (
            <GlassCard glowColor={pendingGames.length > 0 ? "neon" : "none"} className="p-6 border border-white/5 relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                  <Bell className={`w-6 h-6 ${pendingGames.length > 0 ? 'text-yellow-500 animate-bounce' : 'text-gray-400'}`} />
                  <h2 className="text-xl font-black uppercase tracking-wide">
                    {lang === 'en' ? "Pending Approvals" : "Aprobaciones Pendientes"}
                  </h2>
                </div>
                {pendingGames.length > 0 && (
                  <span className="px-3 py-1 bg-yellow-500/15 border border-yellow-500/30 text-yellow-500 text-[10px] font-black uppercase rounded-full animate-pulse">
                    {pendingGames.length} {lang === 'en' ? "Awaiting" : "En Espera"}
                  </span>
                )}
              </div>

              {pendingGames.length === 0 ? (
                <div className="p-6 bg-white/5 border border-white/5 rounded-xl text-center">
                  <CheckCircle className="w-8 h-8 text-bsn-neon mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-bold text-gray-400">
                    {lang === 'en' ? "All caught up! No pending approvals." : "¡Al día! No hay partidos pendientes de aprobación."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingGames.map((game) => {
                    const isEditingThisGame = editingGameId === game.id;
                    const gameTheme = getTeamTheme(game.team);
                    
                    return (
                      <div 
                        key={game.id} 
                        className="bg-black/45 border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/10"
                        style={{ borderLeft: `4px solid ${gameTheme.primary}` }}
                      >
                        {/* Cabecera del juego pendiente */}
                        <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-black/40 border border-white/10 rounded-xl p-1.5 flex items-center justify-center shrink-0">
                              <img 
                                src={`/${gameTheme.logo}`} 
                                alt={game.team} 
                                className="w-full h-full object-contain"
                                onError={(e) => { (e.target as any).src = "/bsn_logo.png"; }}
                              />
                            </div>
                            <div>
                              <h3 className="font-black text-sm uppercase text-white tracking-tight">
                                {game.team} {game.data[0]?.opponent ? `vs ${game.data[0].opponent}` : ""}
                              </h3>
                              <p className="text-[10px] text-gray-400 font-bold uppercase">
                                {lang === 'en' ? "Submitted by: " : "Subido por: "}<span className="text-bsn-neon font-black">{game.submittedBy}</span>
                              </p>
                              <p className="text-[8px] text-gray-500 font-bold mt-0.5">
                                {new Date(game.submittedAt).toLocaleString("es-PR")}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                            <button 
                              onClick={() => {
                                if (isEditingThisGame) {
                                  setEditingGameId(null);
                                  setEditingGameData([]);
                                } else {
                                  setEditingGameId(game.id);
                                  setEditingGameData(game.data);
                                  setEditingGameDestinations(game.destinations || { scoreboard: true, individual: true });
                                }
                              }}
                              className="px-4 py-2 border border-white/10 hover:border-bsn-neon bg-white/5 hover:bg-bsn-neon/5 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                            >
                              {isEditingThisGame ? (lang === 'en' ? "Collapse" : "Contraer") : (lang === 'en' ? "Review & Edit" : "Revisar y Editar")}
                            </button>
                            <button 
                              onClick={() => handleRejectPendingGame(game.id)}
                              className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                            >
                              {lang === 'en' ? "Reject" : "Rechazar"}
                            </button>
                          </div>
                        </div>

                        {/* Editor del juego expandido */}
                        {isEditingThisGame && (
                          <div className="border-t border-white/5 bg-black/30 p-4 space-y-4">
                            <div className="flex flex-wrap gap-4 items-center justify-between p-3.5 bg-black/40 border border-white/5 rounded-xl">
                              <span className="text-xs font-black text-gray-400 uppercase">{lang === 'en' ? "Select Destinations:" : "Destinos del Registro:"}</span>
                              <div className="flex gap-4">
                                <label className="flex items-center space-x-2 cursor-pointer select-none">
                                  <input 
                                    type="checkbox" 
                                    checked={editingGameDestinations.scoreboard} 
                                    onChange={() => setEditingGameDestinations(prev => ({ ...prev, scoreboard: !prev.scoreboard }))}
                                    className="w-4 h-4 accent-bsn-neon bg-black border border-white/20 rounded"
                                  />
                                  <span className="text-xs font-bold text-gray-300">Scoreboard</span>
                                </label>
                                <label className="flex items-center space-x-2 cursor-pointer select-none">
                                  <input 
                                    type="checkbox" 
                                    checked={editingGameDestinations.individual} 
                                    onChange={() => setEditingGameDestinations(prev => ({ ...prev, individual: !prev.individual }))}
                                    className="w-4 h-4 accent-bsn-neon bg-black border border-white/20 rounded"
                                  />
                                  <span className="text-xs font-bold text-gray-300">{lang === 'en' ? 'Players list' : 'Lista Jugadores'}</span>
                                </label>
                              </div>
                            </div>

                            <div className="overflow-x-auto border border-white/10 rounded-xl bg-black/30 backdrop-blur-md">
                              <table className="w-full text-left min-w-[650px] border-collapse">
                                <thead>
                                  <tr className="bg-black/50 border-b border-white/10 text-bsn-neon uppercase text-[9px] font-black tracking-wider">
                                    <th className="p-3">Equipo</th>
                                    <th className="p-3">Jugador / Username</th>
                                    <th className="p-3 text-center w-14">PTS</th>
                                    <th className="p-3 text-center w-14">REB</th>
                                    <th className="p-3 text-center w-14">AST</th>
                                    <th className="p-3 text-center w-14">STL</th>
                                    <th className="p-3 text-center w-14">BLK</th>
                                    {editingGameDestinations.scoreboard && (
                                      <>
                                        <th className="p-3 text-center w-14">FGM</th>
                                        <th className="p-3 text-center w-14">3PM</th>
                                      </>
                                    )}
                                    <th className="p-3 text-center w-10">Acción</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {editingGameData.map((player, idx) => {
                                    const isRowMatched = player.nameMatched;
                                    const teamRoster = validPlayers.filter(vp => vp.team.toLowerCase().trim() === player.team.toLowerCase().trim());
                                    
                                    return (
                                      <tr 
                                        key={idx} 
                                        className={`transition-colors duration-200 ${!isRowMatched ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-white/5'}`}
                                      >
                                        <td className="p-2">
                                          <select 
                                            value={player.team} 
                                            onChange={(e) => handlePendingDataChange(idx, 'team', e.target.value)}
                                            className="bg-black border border-white/15 text-white rounded-lg p-2 text-xs font-bold outline-none focus:border-bsn-neon w-32"
                                          >
                                            {uniqueTeams.map(t => (
                                              <option key={t} value={t}>{t}</option>
                                            ))}
                                          </select>
                                        </td>

                                        <td className="p-2">
                                          <div className="flex flex-col gap-1">
                                            <select 
                                              value={player.username} 
                                              onChange={(e) => handlePendingDataChange(idx, 'username', e.target.value)}
                                              className={`bg-black border text-white rounded-lg p-2 text-xs font-bold outline-none focus:border-bsn-neon w-40 ${!isRowMatched ? 'border-red-500/40 text-red-400' : 'border-white/15'}`}
                                            >
                                              <option value="">-- Selecciona Jugador --</option>
                                              {teamRoster.map(vp => (
                                                <option key={vp.name} value={vp.name}>{vp.name}</option>
                                              ))}
                                            </select>
                                            {!isRowMatched && (
                                              <span className="text-[8px] font-black text-red-500 flex items-center gap-0.5 mt-0.5">
                                                <AlertCircle className="w-2.5 h-2.5" />
                                                {t[lang].unmatchedError}
                                              </span>
                                            )}
                                          </div>
                                        </td>

                                        <td className="p-2">
                                          <input 
                                            type="number" 
                                            value={player.pts} 
                                            onChange={(e) => handlePendingDataChange(idx, 'pts', e.target.value)}
                                            className="w-12 bg-black border border-white/10 rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon"
                                            min="0"
                                          />
                                        </td>
                                        <td className="p-2">
                                          <input 
                                            type="number" 
                                            value={player.reb} 
                                            onChange={(e) => handlePendingDataChange(idx, 'reb', e.target.value)}
                                            className="w-12 bg-black border border-white/10 rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon"
                                            min="0"
                                          />
                                        </td>
                                        <td className="p-2">
                                          <input 
                                            type="number" 
                                            value={player.ast} 
                                            onChange={(e) => handlePendingDataChange(idx, 'ast', e.target.value)}
                                            className="w-12 bg-black border border-white/10 rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon"
                                            min="0"
                                          />
                                        </td>
                                        <td className="p-2">
                                          <input 
                                            type="number" 
                                            value={player.stl} 
                                            onChange={(e) => handlePendingDataChange(idx, 'stl', e.target.value)}
                                            className="w-12 bg-black border border-white/10 rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon"
                                            min="0"
                                          />
                                        </td>
                                        <td className="p-2">
                                          <input 
                                            type="number" 
                                            value={player.blk} 
                                            onChange={(e) => handlePendingDataChange(idx, 'blk', e.target.value)}
                                            className="w-12 bg-black border border-white/10 rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon"
                                            min="0"
                                          />
                                        </td>
                                        {editingGameDestinations.scoreboard && (
                                          <>
                                            <td className="p-2">
                                              <input 
                                                type="number" 
                                                value={player.fgm} 
                                                onChange={(e) => handlePendingDataChange(idx, 'fgm', e.target.value)}
                                                className="w-12 bg-black border border-white/10 rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon"
                                                min="0"
                                              />
                                            </td>
                                            <td className="p-2">
                                              <input 
                                                type="number" 
                                                value={player.tpm} 
                                                onChange={(e) => handlePendingDataChange(idx, 'tpm', e.target.value)}
                                                className="w-12 bg-black border border-white/10 rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon"
                                                min="0"
                                              />
                                            </td>
                                          </>
                                        )}
                                        
                                        <td className="p-2 text-center">
                                          <button 
                                            onClick={() => handleRemoveRowFromPending(idx)}
                                            className="p-1.5 text-red-400 hover:text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                              <button 
                                onClick={handleAddRowToPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 hover:border-bsn-neon hover:bg-bsn-neon/5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors w-full sm:w-auto justify-center"
                              >
                                <Plus className="w-3.5 h-3.5 text-bsn-neon" />
                                <span>{t[lang].addPlayer}</span>
                              </button>

                              <div className="flex gap-3 w-full sm:w-auto justify-end">
                                <button 
                                  onClick={() => { setEditingGameId(null); setEditingGameData([]); }} 
                                  className="px-4 py-2 border border-white/10 text-gray-400 hover:text-white rounded-lg text-xs font-black uppercase tracking-wider transition-colors"
                                >
                                  {lang === 'en' ? "Cancel" : "Cancelar"}
                                </button>
                                <button 
                                  onClick={() => handleApprovePendingGame(game.id)}
                                  className="px-5 py-2 bg-gradient-to-r from-bsn-neon to-bsn-blue hover:opacity-90 text-black font-black uppercase text-xs rounded-lg tracking-wider transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)]"
                                >
                                  {lang === 'en' ? "Approve & Submit" : "Confirmar y Aprobar"}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          )}

          <GlassCard glowColor={isReviewing ? "none" : "neon"} className="p-8 border border-white/5 relative overflow-hidden">
            
            {/* Banner de Advertencia de IA / AI Disclaimer */}
            <div className="w-full bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-yellow-400 text-xs font-bold leading-relaxed">{t[lang].aiWarning}</p>
            </div>

            {/* Configuración de Guardado / Destino de Stats */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 bg-black/40 border border-white/5 rounded-2xl mb-8 gap-4 md:gap-0">
              <div>
                <h3 className="text-sm font-black uppercase text-gray-400 tracking-wider mb-1">{t[lang].destTitle}</h3>
                <p className="text-xs text-gray-500">Decide a qué hojas de cálculo se enviarán los datos recopilados.</p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-black uppercase text-bsn-neon tracking-wider sm:text-left text-right">{t[lang].selectOneOrBoth}</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <label className="flex items-center space-x-3 cursor-pointer group select-none">
                    <input 
                      type="checkbox" 
                      checked={destinations.scoreboard} 
                      onChange={() => toggleDestination('scoreboard')} 
                      className="w-5 h-5 accent-bsn-neon rounded bg-black/60 border border-white/20 focus:ring-0 focus:ring-offset-0" 
                    />
                    <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">Scoreboard</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer group select-none">
                    <input 
                      type="checkbox" 
                      checked={destinations.individual} 
                      onChange={() => toggleDestination('individual')} 
                      className="w-5 h-5 accent-bsn-neon rounded bg-black/60 border border-white/20 focus:ring-0 focus:ring-offset-0" 
                    />
                    <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">{lang === 'en' ? 'Players list' : 'Lista Jugadores'}</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 mb-6">
              {isReviewing ? <Edit3 className="w-6 h-6 text-bsn-neon animate-pulse" /> : <UploadCloud className="w-6 h-6 text-bsn-neon" />}
              <h2 className="text-2xl font-black uppercase tracking-wide">
                {isReviewing ? t[lang].reviewData : t[lang].uploadTitle}
              </h2>
            </div>

            {!isReviewing ? (
              <div className="space-y-6">
                <DragDropZone onImageSelected={handleImageSelected} />
                
                <div className="flex items-center justify-center">
                  <div className="w-full border-t border-white/5" />
                  <span className="px-4 text-xs font-black uppercase tracking-widest text-gray-600">o</span>
                  <div className="w-full border-t border-white/5" />
                </div>

                <div className="flex justify-center">
                  <button 
                    onClick={handleManualMode}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-white/5 border border-white/10 hover:border-bsn-neon hover:bg-bsn-neon/5 rounded-xl font-black uppercase text-xs tracking-wider transition-all duration-300 transform hover:scale-105 active:scale-95"
                  >
                    <Plus className="w-4 h-4 text-bsn-neon" />
                    <span>{t[lang].manualEntry}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Editor Interactivo de Estadísticas */}
                <div className="overflow-x-auto border border-white/10 rounded-xl bg-black/30 backdrop-blur-md">
                  <table className="w-full text-left min-w-[700px] border-collapse">
                    <thead>
                      <tr className="bg-black/50 border-b border-white/10 text-bsn-neon uppercase text-[10px] font-black tracking-wider">
                        <th className="p-4">Equipo</th>
                        <th className="p-4">Jugador / Username</th>
                        <th className="p-4 text-center w-16">PTS</th>
                        <th className="p-4 text-center w-16">REB</th>
                        <th className="p-4 text-center w-16">AST</th>
                        <th className="p-4 text-center w-16">STL</th>
                        <th className="p-4 text-center w-16">BLK</th>
                        {destinations.scoreboard && (
                          <>
                            <th className="p-4 text-center w-16">FGM</th>
                            <th className="p-4 text-center w-16">3PM</th>
                          </>
                        )}
                        <th className="p-4 text-center w-12">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {scannedData.map((player) => {
                        const isRowMatched = player.nameMatched;
                        const teamRoster = validPlayers.filter(vp => vp.team.toLowerCase().trim() === player.team.toLowerCase().trim());
                        
                        return (
                          <tr 
                            key={player.id} 
                            className={`transition-colors duration-300 ${!isRowMatched ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-white/5'}`}
                          >
                            {/* Selector de Equipo */}
                            <td className="p-3">
                              <select 
                                value={player.team} 
                                onChange={(e) => handleDataChange(player.id, 'team', e.target.value)}
                                className="bg-black/40 border border-white/10 text-white rounded-lg p-2 text-xs font-bold outline-none focus:border-bsn-neon w-36"
                              >
                                {uniqueTeams.map(team => (
                                  <option key={team} value={team}>{team}</option>
                                ))}
                              </select>
                            </td>

                            {/* Selector de Jugador / Username de Roster */}
                            <td className="p-3">
                              <div className="flex flex-col gap-1">
                                <select 
                                  value={player.username} 
                                  onChange={(e) => handleDataChange(player.id, 'username', e.target.value)}
                                  className={`bg-black/40 border text-white rounded-lg p-2 text-xs font-bold outline-none focus:border-bsn-neon w-44 ${!isRowMatched ? 'border-red-500/40 text-red-400' : 'border-white/10'}`}
                                >
                                  <option value="">-- Selecciona Jugador --</option>
                                  {teamRoster.map(vp => (
                                    <option key={vp.name} value={vp.name}>{vp.name}</option>
                                  ))}
                                </select>
                                {!isRowMatched && (
                                  <span className="text-[9px] font-black text-red-500 flex items-center gap-1 mt-0.5">
                                    <AlertCircle className="w-3 h-3" />
                                    {t[lang].unmatchedError}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Campos Numéricos de Stats */}
                            <td className="p-3">
                              <input 
                                type="number" 
                                value={player.pts} 
                                onChange={(e) => handleDataChange(player.id, 'pts', e.target.value)}
                                className="w-14 bg-black/40 border border-white/10 rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon"
                                min="0"
                              />
                            </td>
                            <td className="p-3">
                              <input 
                                type="number" 
                                value={player.reb} 
                                onChange={(e) => handleDataChange(player.id, 'reb', e.target.value)}
                                className="w-14 bg-black/40 border border-white/10 rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon"
                                min="0"
                              />
                            </td>
                            <td className="p-3">
                              <input 
                                type="number" 
                                value={player.ast} 
                                onChange={(e) => handleDataChange(player.id, 'ast', e.target.value)}
                                className="w-14 bg-black/40 border border-white/10 rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon"
                                min="0"
                              />
                            </td>
                            <td className="p-3">
                              <input 
                                type="number" 
                                value={player.stl} 
                                onChange={(e) => handleDataChange(player.id, 'stl', e.target.value)}
                                className="w-14 bg-black/40 border border-white/10 rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon"
                                min="0"
                              />
                            </td>
                            <td className="p-3">
                              <input 
                                type="number" 
                                value={player.blk} 
                                onChange={(e) => handleDataChange(player.id, 'blk', e.target.value)}
                                className="w-14 bg-black/40 border border-white/10 rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon"
                                min="0"
                              />
                            </td>
                            {destinations.scoreboard && (
                              <>
                                <td className="p-3">
                                  <input 
                                    type="number" 
                                    value={player.fgm} 
                                    onChange={(e) => handleDataChange(player.id, 'fgm', e.target.value)}
                                    className="w-14 bg-black/40 border border-white/10 rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon"
                                    min="0"
                                  />
                                </td>
                                <td className="p-3">
                                  <input 
                                    type="number" 
                                    value={player.tpm} 
                                    onChange={(e) => handleDataChange(player.id, 'tpm', e.target.value)}
                                    className="w-14 bg-black/40 border border-white/10 rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon"
                                    min="0"
                                  />
                                </td>
                              </>
                            )}
                            
                            {/* Acción Eliminar Fila */}
                            <td className="p-3 text-center">
                              <button 
                                onClick={() => handleRemoveRow(player.id)}
                                className="p-2 text-red-400 hover:text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Controles de la Tabla */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <button 
                    onClick={handleAddRow}
                    className="flex items-center gap-2 px-4 py-2 border border-white/10 hover:border-bsn-neon hover:bg-bsn-neon/5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors w-full sm:w-auto justify-center"
                  >
                    <Plus className="w-4 h-4 text-bsn-neon" />
                    <span>{t[lang].addPlayer}</span>
                  </button>

                  <div className="flex gap-4 w-full sm:w-auto justify-end">
                    <button 
                      onClick={() => { setIsReviewing(false); setScannedData([]); }} 
                      className="px-5 py-3 border border-white/10 text-gray-400 hover:text-white rounded-lg text-xs font-black uppercase tracking-wider transition-colors"
                    >
                      {t[lang].cancel}
                    </button>
                    <NeonButton onClick={handleConfirm} className="w-full sm:w-auto text-xs font-black">
                      {t[lang].confirmUpload}
                    </NeonButton>
                  </div>
                </div>
              </div>
            )}

            {isScanning && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-14 h-14 text-bsn-neon animate-spin" />
                <p className="text-bsn-neon font-black uppercase tracking-widest text-sm animate-pulse">{t[lang].scanning}</p>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Panel Derecho: Perfil de Capitán & Líderes de Anotación */}
        <div className="space-y-8">
          
          {/* Tarjeta de Capitán de Roster (Stats de Temporada Reales) */}
          {activeTeam && activeUser && (
            <GlassCard glowColor="neon" className="p-6 border border-bsn-neon/20 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-bsn-neon/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center space-x-4 mb-6 border-b border-white/5 pb-4">
                <div className="w-16 h-16 rounded-xl bg-black/40 border border-bsn-neon/20 p-2 flex items-center justify-center">
                  <img 
                    src={`/${theme.logo}`} 
                    alt="Team Logo" 
                    className="w-full h-full object-contain" 
                    onError={(e) => { (e.target as any).src = "/bsn_logo.png"; }}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase text-white tracking-tight">{activeUser}</h3>
                  <p className="text-xs text-bsn-neon font-bold uppercase tracking-wider">{activeTeam}</p>
                  {captainStats && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-bsn-neon/10 border border-bsn-neon/30 text-bsn-neon text-[9px] font-black uppercase rounded">
                      Pos: {captainStats.pos}
                    </span>
                  )}
                </div>
              </div>

              {/* Estadísticas de Temporada del Capitán */}
              {captainStats ? (
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-400">{t[lang].seasonAverages}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-black/30 border border-white/5 rounded-xl text-center">
                      <p className="text-2xl font-black text-white">{captainStats.gp}</p>
                      <p className="text-[9px] font-black uppercase text-gray-500 mt-1">{t[lang].gpLabel}</p>
                    </div>
                    <div className="p-3 bg-black/30 border border-white/5 rounded-xl text-center">
                      <p className="text-2xl font-black text-bsn-neon">{captainStats.ppg.toFixed(1)}</p>
                      <p className="text-[9px] font-black uppercase text-gray-500 mt-1">{t[lang].ppgLabel}</p>
                    </div>
                    <div className="p-3 bg-black/30 border border-white/5 rounded-xl text-center">
                      <p className="text-2xl font-black text-white">{captainStats.rpg.toFixed(1)}</p>
                      <p className="text-[9px] font-black uppercase text-gray-500 mt-1">{t[lang].rpgLabel}</p>
                    </div>
                    <div className="p-3 bg-black/30 border border-white/5 rounded-xl text-center">
                      <p className="text-2xl font-black text-white">{captainStats.apg.toFixed(1)}</p>
                      <p className="text-[9px] font-black uppercase text-gray-500 mt-1">{t[lang].apgLabel}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-white/5 border border-white/5 rounded-xl text-center">
                  <p className="text-xs text-gray-500 font-bold">{t[lang].emptyRoster}</p>
                </div>
              )}
            </GlassCard>
          )}

          {/* Tarjeta de Líderes de Anotación (Personalizada por Equipo) */}
          <GlassCard className="p-6 border border-white/5 border-t-4 border-t-bsn-neon overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-bsn-neon/5 rounded-full blur-3xl pointer-events-none" />
            
            <h2 className="text-xl font-black uppercase tracking-tight mb-5 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-bsn-neon" />
              <span>
                {activeTeam ? `${t[lang].topScorersTeam} - ${activeTeam.toUpperCase()}` : t[lang].topScorers}
              </span>
            </h2>

            <div className="space-y-3">
              {activeScorers.length > 0 ? (
                activeScorers.map((player, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between p-3.5 bg-black/45 border border-white/5 rounded-xl hover:border-bsn-neon/20 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 text-xs font-black rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-black text-sm text-white tracking-tight">{player.name}</p>
                        {!activeTeam && (
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{player.team}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-bsn-neon font-black text-base">{player.pts.toFixed(1)}</p>
                      <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">PPG</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 bg-white/5 border border-white/5 rounded-xl text-center">
                  <Loader2 className="w-6 h-6 text-bsn-neon animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-500 font-bold">Cargando estadísticas de liga...</p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

      </div>

      {/* Roster Watermark Logo de Fondo (Efecto Grunge) */}
      {activeTeam && (
        <div className="fixed bottom-[-50px] right-[-50px] w-[45vw] h-[45vw] max-w-[450px] max-h-[450px] opacity-[0.16] pointer-events-none z-0 select-none overflow-hidden transition-all duration-700 ease-in-out">
          <img 
            src={`/${theme.logo}`} 
            alt="Team Watermark" 
            className="w-full h-full object-contain filter drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]"
            onError={(e) => { (e.target as any).style.display = 'none'; }}
          />
        </div>
      )}

      {/* Modal de Autorización de Envío a Google Sheets */}
      {showUploadAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-6">
          <GlassCard glowColor="neon" className="max-w-md w-full p-8 border border-bsn-neon/30 shadow-[0_0_30px_rgba(56,189,248,0.2)]">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-bsn-neon/10 flex items-center justify-center border border-bsn-neon/30 mb-4 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
                <Database className="w-8 h-8 text-bsn-neon animate-pulse" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-bsn-neon to-white">
                {lang === 'en' ? "Authorize Sync" : "Autorizar Envío"}
              </h2>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                {lang === 'en' 
                  ? "Enter the secure upload key to submit statistics to Google Sheets." 
                  : "Ingresa la clave de envío segura para subir las estadísticas a Google Sheets."}
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  {lang === 'en' ? "Upload Key" : "Clave de Envío"}
                </label>
                <input 
                  type="password"
                  placeholder="••••••••"
                  value={uploadKey}
                  onChange={(e) => setUploadKey(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && uploadKey) handleExecuteUpload(); }}
                  className="w-full bg-black/60 border border-white/20 focus:border-bsn-neon rounded-xl p-3 outline-none text-white text-sm font-semibold tracking-widest transition-colors text-center"
                />
                {uploadKeyError && <p className="text-red-500 text-xs font-bold text-center mt-2">{uploadKeyError}</p>}
              </div>
              <div className="flex gap-4 pt-2">
                <button 
                  onClick={() => setShowUploadAuth(false)}
                  className="w-1/3 py-3 border border-white/10 text-gray-400 font-bold uppercase text-xs rounded-xl hover:bg-white/5 transition-colors"
                >
                  {t[lang].cancel}
                </button>
                <button 
                  onClick={handleExecuteUpload}
                  disabled={!uploadKey}
                  className="w-2/3 py-3 bg-gradient-to-r from-bsn-neon to-bsn-blue text-white font-black uppercase text-xs rounded-xl tracking-wider disabled:opacity-50 transition-colors shadow-[0_0_20px_rgba(56,189,248,0.3)]"
                >
                  {lang === 'en' ? "Submit" : "Enviar"}
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
