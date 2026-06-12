'use client';

import React, { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DragDropZone } from "@/components/ui/DragDropZone";
import { CropTool } from "@/components/ui/CropTool";
import { HDInteractiveViewer } from "@/components/ui/HDInteractiveViewer";
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
  pts: number | "";
  reb: number | "";
  ast: number | "";
  stl: number | "";
  blk: number | "";
  to: number | "";
  fouls: number | "";
  fgm: number | "";
  fga: number | "";
  tpm: number | "";
  tpa: number | "";
  nameMatched: boolean;
  lowConfidence?: boolean;
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
  const [selectedWeek, setSelectedWeek] = useState<string>("Actual");

  useEffect(() => {
    if (selectedWeek !== "Actual") {
      setDestinations({ scoreboard: true, individual: false });
    } else {
      setDestinations({ scoreboard: true, individual: true });
    }
  }, [selectedWeek]);

  const [isScanning, setIsScanning] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedPlayer[]>([]);
  const [validPlayers, setValidPlayers] = useState<ValidPlayer[]>([]);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [croppedPreviewSrc, setCroppedPreviewSrc] = useState<string | null>(null);
  const [manualEdits, setManualEdits] = useState<Record<string, Record<string, boolean>>>({});

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

  const [isProfileLoaded, setIsProfileLoaded] = useState(false);

  // States for Resultados_Input
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  });
  const [customScores, setCustomScores] = useState<Record<string, number | string>>({});
  const [selectedWinner, setSelectedWinner] = useState<string>("");
  const [isForfeit, setIsForfeit] = useState<boolean>(false);

  // States for Admin editing of Resultados_Input
  const [editingGameFecha, setEditingGameFecha] = useState<string>("");
  const [editingGameScores, setEditingGameScores] = useState<Record<string, number | string>>({});
  const [editingGameWinner, setEditingGameWinner] = useState<string>("");
  const [editingGameIsForfeit, setEditingGameIsForfeit] = useState<boolean>(false);

  // Date Conversion Helpers
  const convertInputDateToSheetFormat = (dateStr: string): string => {
    if (!dateStr) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split("-");
      return `${month}/${day}/${year}`;
    }
    return dateStr;
  };

  const convertSheetDateToInputFormat = (dateStr: string): string => {
    if (!dateStr) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return dateStr;
  };

  const handleToggleForfeit = (checked: boolean) => {
    setIsForfeit(checked);
    if (checked) {
      const teams = Array.from(new Set(scannedData.map(p => p.team))).filter(Boolean);
      const currentWinner = selectedWinner || teams[0] || "";
      const newScores: Record<string, number> = {};
      teams.forEach(t => {
        newScores[t] = (t === currentWinner) ? 20 : 0;
      });
      setCustomScores(newScores);
    } else {
      // Recalculate from scannedData
      const newScores: Record<string, number> = {};
      scannedData.forEach(p => {
        if (!p.team) return;
        const ptsNum = p.pts === "" ? 0 : Number(p.pts);
        newScores[p.team] = (newScores[p.team] || 0) + ptsNum;
      });
      setCustomScores(newScores);
      
      const teams = Object.keys(newScores);
      if (teams.length >= 2) {
        const winner = Number(newScores[teams[0]]) > Number(newScores[teams[1]]) ? teams[0] : teams[1];
        setSelectedWinner(winner);
      } else if (teams.length === 1) {
        setSelectedWinner(teams[0]);
      }
    }
  };

  const handleWinnerChange = (winnerName: string) => {
    setSelectedWinner(winnerName);
    if (isForfeit) {
      const teams = Array.from(new Set(scannedData.map(p => p.team))).filter(Boolean);
      const newScores: Record<string, number> = {};
      teams.forEach(t => {
        newScores[t] = (t === winnerName) ? 20 : 0;
      });
      setCustomScores(newScores);
    }
  };

  const handleEditingToggleForfeit = (checked: boolean) => {
    setEditingGameIsForfeit(checked);
    if (checked) {
      const teams = Array.from(new Set(editingGameData.map(p => p.team))).filter(Boolean);
      const currentWinner = editingGameWinner || teams[0] || "";
      const newScores: Record<string, number> = {};
      teams.forEach(t => {
        newScores[t] = (t === currentWinner) ? 20 : 0;
      });
      setEditingGameScores(newScores);
    } else {
      // Recalculate from editingGameData
      const newScores: Record<string, number> = {};
      editingGameData.forEach(p => {
        if (!p.team) return;
        const ptsNum = p.pts === "" ? 0 : Number(p.pts);
        newScores[p.team] = (newScores[p.team] || 0) + ptsNum;
      });
      setEditingGameScores(newScores);
      
      const teams = Object.keys(newScores);
      if (teams.length >= 2) {
        const winner = Number(newScores[teams[0]]) > Number(newScores[teams[1]]) ? teams[0] : teams[1];
        setEditingGameWinner(winner);
      } else if (teams.length === 1) {
        setEditingGameWinner(teams[0]);
      }
    }
  };

  const handleEditingWinnerChange = (winnerName: string) => {
    setEditingGameWinner(winnerName);
    if (editingGameIsForfeit) {
      const teams = Array.from(new Set(editingGameData.map(p => p.team))).filter(Boolean);
      const newScores: Record<string, number> = {};
      teams.forEach(t => {
        newScores[t] = (t === winnerName) ? 20 : 0;
      });
      setEditingGameScores(newScores);
    }
  };

  useEffect(() => {
    if (!user || !isProfileLoaded || captainProfile.role !== 'admin') return;

    const q = query(collection(db, "pending_games"), orderBy("submittedAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const games = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPendingGames(games);
    }, (err) => {
      console.warn("No se pudo escuchar la cola de partidos pendientes (permisos insuficientes):", err);
    });

    return () => unsubscribe();
  }, [user, isProfileLoaded, captainProfile.role]);

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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setAuthLoading(true);
        setIsProfileLoaded(false);
        try {
          const { doc, getDoc } = await import("firebase/firestore");
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const profileData = userDoc.data();
            const loadedProfile: CaptainProfile = {
              role: profileData.role || "",
              authorized: profileData.role === "admin" ? true : !!profileData.uid,
              team: profileData.team || "",
              username: profileData.role === "captain" ? profileData.playerName : (profileData.username || ""),
              activeView: profileData.role === "admin" ? "admin" : "experience"
            };
            setCaptainProfile(loadedProfile);
            localStorage.setItem("bsn_captain_profile", JSON.stringify(loadedProfile));
            if (profileData.role === "admin" && profileData.team) {
              setSimulatedTeam(profileData.team);
            }
          } else {
            // Fallback al localStorage si no hay documento en Firestore
            const saved = localStorage.getItem("bsn_captain_profile");
            if (saved) {
              const parsed = JSON.parse(saved);
              setCaptainProfile(parsed);
            }
          }
        } catch (e) {
          console.error("Error al cargar el perfil de Firestore:", e);
        } finally {
          setIsProfileLoaded(true);
          setAuthLoading(false);
        }
      } else {
        setIsProfileLoaded(true);
        setAuthLoading(false);
      }
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

  const findClosestTeam = (rawTeam: string, teamsList: string[]): string => {
    if (!rawTeam) return "";
    const normalizedRaw = rawTeam.toLowerCase().trim();
    
    // 1. Coincidencia exacta
    const exact = teamsList.find(t => t.toLowerCase().trim() === normalizedRaw);
    if (exact) return exact;
    
    // 2. Coincidencia de subcadena (ej: "Criollos" en "CriollosDeCaguas")
    const contained = teamsList.find(t => 
      normalizedRaw.includes(t.toLowerCase().trim()) || 
      t.toLowerCase().trim().includes(normalizedRaw)
    );
    if (contained) return contained;
    
    // 3. Mapeo de municipios comunes del BSN
    const keyMap: Record<string, string> = {
      "caguas": "Criollos",
      "santurce": "Cangrejeros",
      "bayamon": "Vaqueros",
      "ponce": "Leones",
      "mayaguez": "Indios",
      "german": "Atléticos",
      "quebradillas": "Piratas",
      "manati": "Osos",
      "coamo": "Maratonistas",
      "fajardo": "Cariduros",
      "guaynabo": "Mets",
      "carolina": "Gigantes"
    };
    
    for (const [key, val] of Object.entries(keyMap)) {
      if (normalizedRaw.includes(key)) {
        const match = teamsList.find(t => 
          t.toLowerCase().includes(val.toLowerCase()) || 
          val.toLowerCase().includes(t.toLowerCase())
        );
        if (match) return match;
      }
    }
    
    return "";
  };

  const getLevenshteinDistance = (a: string, b: string): number => {
    const tmp: number[][] = [];
    let i: number, j: number;
    for (i = 0; i <= a.length; i++) {
      tmp[i] = [i];
    }
    for (j = 0; j <= b.length; j++) {
      tmp[0][j] = j;
    }
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        tmp[i][j] = Math.min(
          tmp[i - 1][j] + 1, // deletion
          tmp[i][j - 1] + 1, // insertion
          tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
        );
      }
    }
    return tmp[a.length][b.length];
  };

  const findClosestPlayer = (rawUsername: string, rawTeam: string, playersList: ValidPlayer[]) => {
    if (!rawUsername) return undefined;
    const normRawUser = rawUsername.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normRawTeam = rawTeam.toLowerCase().trim();
    
    // Buscar primero dentro del equipo detectado
    const sameTeamPlayers = playersList.filter(p => {
      const normPlayerTeam = p.team.toLowerCase().trim();
      return normRawTeam.includes(normPlayerTeam) || normPlayerTeam.includes(normRawTeam);
    });
    
    // 1. Coincidencia exacta de username limpio en el mismo equipo
    const matchInTeamExact = sameTeamPlayers.find(p => {
      const normPName = p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      return normRawUser === normPName;
    });
    if (matchInTeamExact) return matchInTeamExact;
    
    // 2. Fuzzy match en el mismo equipo (Levenshtein)
    let bestMatchInTeam: ValidPlayer | undefined = undefined;
    let minDistanceInTeam = Infinity;
    
    sameTeamPlayers.forEach(p => {
      const normPName = p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const distance = getLevenshteinDistance(normRawUser, normPName);
      // Permitir una tolerancia de diferencia basada en la longitud
      const maxTolerated = Math.max(2, Math.floor(normPName.length * 0.35));
      if (distance <= maxTolerated && distance < minDistanceInTeam) {
        minDistanceInTeam = distance;
        bestMatchInTeam = p;
      }
    });
    
    if (bestMatchInTeam) return bestMatchInTeam;
    
    // 3. Coincidencia exacta global
    const matchGlobalExact = playersList.find(p => {
      const normPName = p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      return normRawUser === normPName;
    });
    if (matchGlobalExact) return matchGlobalExact;
    
    // 4. Fuzzy match global
    let bestMatchGlobal: ValidPlayer | undefined = undefined;
    let minDistanceGlobal = Infinity;
    
    playersList.forEach(p => {
      const normPName = p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const distance = getLevenshteinDistance(normRawUser, normPName);
      const maxTolerated = Math.max(2, Math.floor(normPName.length * 0.35));
      if (distance <= maxTolerated && distance < minDistanceGlobal) {
        minDistanceGlobal = distance;
        bestMatchGlobal = p;
      }
    });
    
    return bestMatchGlobal;
  };

  const handleImageSelected = async (file: File) => {
    setScannedData([]);
    setCroppedPreviewSrc(null);
    setManualEdits({});
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const resultStr = reader.result as string;
        const base64Str = resultStr.split(',')[1];
        setCroppedPreviewSrc(resultStr);
        await handleCropScanned(base64Str);
      };
      reader.readAsDataURL(file);
      
      reader.onerror = () => {
        alert("Error al leer el archivo.");
      };
    } catch (error) {
      console.error(error);
      alert("Error al procesar la imagen.");
    }
  };

  const handleCropScanned = async (base64Str: string) => {
    setIsScanning(true);
    setScannedData([]);
    setCropImageSrc(null);
    setManualEdits({});
    
    try {
      const scanRes = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          imageBase64: base64Str,
          rosterPlayers: validPlayers.map(p => ({ name: p.name, team: p.team })),
          teams: Array.from(new Set(validPlayers.map(p => p.team)))
        }),
      });
      const scanData = await scanRes.json();
      
      if (scanData.error) {
        alert("Error de IA: " + scanData.error);
        setIsScanning(false);
        return;
      }

      const processedData = scanData.data.map((player: any, index: number) => {
        const rawUsername = player.username?.trim() || "";
        const rawTeam = player.team?.trim() || "";
        
        const uniqueTeamsList = Array.from(new Set(validPlayers.map(p => p.team))).sort();
        
        const matchedPlayer = findClosestPlayer(rawUsername, rawTeam, validPlayers);
        const matchedTeamName = matchedPlayer 
          ? matchedPlayer.team 
          : (findClosestTeam(rawTeam, uniqueTeamsList) || activeTeam || "");

        return {
          id: String(Date.now() + index),
          username: matchedPlayer ? matchedPlayer.name : rawUsername,
          team: matchedTeamName,
          pts: (player.pts === null || player.pts === undefined || player.pts === "") ? "" : player.pts,
          reb: (player.reb === null || player.reb === undefined || player.reb === "") ? "" : player.reb,
          ast: (player.ast === null || player.ast === undefined || player.ast === "") ? "" : player.ast,
          stl: (player.stl === null || player.stl === undefined || player.stl === "") ? "" : player.stl,
          blk: (player.blk === null || player.blk === undefined || player.blk === "") ? "" : player.blk,
          to: "",
          fouls: "",
          fgm: (player.fgm === null || player.fgm === undefined || player.fgm === "") ? "" : player.fgm,
          fga: (player.fga === null || player.fga === undefined || player.fga === "") ? "" : player.fga,
          tpm: (player.tpm === null || player.tpm === undefined || player.tpm === "") ? "" : player.tpm,
          tpa: (player.tpa === null || player.tpa === undefined || player.tpa === "") ? "" : player.tpa,
          nameMatched: !!matchedPlayer,
          lowConfidence: !!player.low_confidence,
        };
      });

      setScannedData(processedData);
      
      // Calculate initial scores & winner
      const initialScores: Record<string, number> = {};
      processedData.forEach((p: any) => {
        if (!p.team) return;
        const ptsNum = p.pts === "" ? 0 : Number(p.pts);
        initialScores[p.team] = (initialScores[p.team] || 0) + ptsNum;
      });
      setCustomScores(initialScores);
      
      const teams = Object.keys(initialScores);
      if (teams.length >= 2) {
        const winner = Number(initialScores[teams[0]]) > Number(initialScores[teams[1]]) ? teams[0] : teams[1];
        setSelectedWinner(winner);
      } else if (teams.length === 1) {
        setSelectedWinner(teams[0]);
      }
      setIsForfeit(false);

      setIsScanning(false);
      setIsReviewing(true);
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
        pts: "",
        reb: "",
        ast: "",
        stl: "",
        blk: "",
        to: "",
        fouls: "",
        fgm: "",
        fga: "",
        tpm: "",
        tpa: "",
        nameMatched: false
      }
    ]);
    setCustomScores({});
    setSelectedWinner("");
    setIsForfeit(false);
    setIsReviewing(true);
  };

  const handleAddRow = () => {
    setScannedData(prev => [
      ...prev,
      {
        id: String(Date.now()),
        username: "",
        team: activeTeam || (validPlayers[0]?.team || ""),
        pts: "",
        reb: "",
        ast: "",
        stl: "",
        blk: "",
        to: "",
        fouls: "",
        fgm: "",
        fga: "",
        tpm: "",
        tpa: "",
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
      const cleanPlayer = (p: any) => ({
        ...p,
        pts: p.pts === "" ? 0 : Number(p.pts),
        reb: p.reb === "" ? 0 : Number(p.reb),
        ast: p.ast === "" ? 0 : Number(p.ast),
        stl: p.stl === "" ? 0 : Number(p.stl),
        blk: p.blk === "" ? 0 : Number(p.blk),
        to: p.to === "" ? 0 : Number(p.to),
        fouls: p.fouls === "" ? 0 : Number(p.fouls),
        fgm: p.fgm === "" ? 0 : Number(p.fgm),
        fga: p.fga === "" ? 0 : Number(p.fga),
        tpm: p.tpm === "" ? 0 : Number(p.tpm),
        tpa: p.tpa === "" ? 0 : Number(p.tpa),
      });

      const teamPoints: Record<string, number> = {};
      scannedData.forEach(p => {
        const ptsNum = p.pts === "" ? 0 : Number(p.pts);
        teamPoints[p.team] = (teamPoints[p.team] || 0) + ptsNum;
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
        return { ...cleanPlayer(p), opponent, result };
      });

      await addDoc(collection(db, "pending_games"), {
        submittedBy: captainProfile.username || "Capitán",
        submittedAt: new Date().toISOString(),
        team: activeTeam,
        data: finalData,
        destinations: destinations,
        semana: selectedWeek || "",
        fecha: convertInputDateToSheetFormat(selectedDate),
        scores: customScores,
        winner: selectedWinner,
        isForfeit: isForfeit
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
    if (hasErrors && destinations.individual) {
      alert(lang === 'en' ? "Please correct unmatched names before uploading." : "Por favor corrige los nombres no encontrados antes de subir.");
      return;
    }

    const hasEmptyOrLowConfidence = scannedData.some(p => {
      const isEmpty = p.pts === "" || p.reb === "" || p.ast === "" || p.stl === "" || p.blk === "" || p.fgm === "" || p.fga === "" || p.tpm === "" || p.tpa === "";
      return isEmpty;
    });
    
    if (hasEmptyOrLowConfidence) {
      alert(lang === 'en'
        ? "Some player stats are empty or unread. Please review and fill in all values in yellow/amber before submitting."
        : "Hay estadísticas de jugadores vacías o no detectadas. Por favor, revisa y completa todos los valores resaltados en amarillo/ámbar antes de enviar.");
      return;
    }

    const hasLogicalErrors = scannedData.some(p => {
      const hasFgError = Number(p.fgm || 0) > Number(p.fga || 0);
      const has3pError = Number(p.tpm || 0) > Number(p.tpa || 0);
      const has3pGreaterFgError = Number(p.tpm || 0) > Number(p.fgm || 0);
      return hasFgError || has3pError || has3pGreaterFgError;
    });

    if (hasLogicalErrors) {
      alert(lang === 'en'
        ? "Some player stats contain mathematical errors (e.g. FGM > FGA or TPM > TPA). Please correct them before submitting."
        : "Algunas estadísticas contienen errores matemáticos (ej: FGM > FGA o TPM > TPA). Por favor, corrígelos antes de enviar.");
      return;
    }

    const isConfirmed = confirm(lang === 'en' 
      ? "Are you sure you want to submit these stats to the league?" 
      : "¿Estás seguro de que deseas enviar estas estadísticas a la liga?");
      
    if (!isConfirmed) return;

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
      
      const cleanPlayer = (p: any) => ({
        ...p,
        pts: p.pts === "" ? 0 : Number(p.pts),
        reb: p.reb === "" ? 0 : Number(p.reb),
        ast: p.ast === "" ? 0 : Number(p.ast),
        stl: p.stl === "" ? 0 : Number(p.stl),
        blk: p.blk === "" ? 0 : Number(p.blk),
        to: p.to === "" ? 0 : Number(p.to),
        fouls: p.fouls === "" ? 0 : Number(p.fouls),
        fgm: p.fgm === "" ? 0 : Number(p.fgm),
        fga: p.fga === "" ? 0 : Number(p.fga),
        tpm: p.tpm === "" ? 0 : Number(p.tpm),
        tpa: p.tpa === "" ? 0 : Number(p.tpa),
      });

      const teamPoints: Record<string, number> = {};
      scannedData.forEach(p => {
        const ptsNum = p.pts === "" ? 0 : Number(p.pts);
        teamPoints[p.team] = (teamPoints[p.team] || 0) + ptsNum;
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
        return { ...cleanPlayer(p), opponent, result };
      });
      
      try {
        setIsScanning(true); // Mostrar spinner
        const res = await fetch("/api/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: finalData,
            destinations,
            semana: selectedWeek,
            fecha: convertInputDateToSheetFormat(selectedDate),
            scores: customScores,
            winner: selectedWinner,
            isForfeit: isForfeit
          })
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
    setEditingGameData(prev => {
      const updatedData = prev.map((p, idx) => {
        if (idx === index) {
          const parsedValue = (field === 'username' || field === 'team')
            ? value
            : (value === "" ? "" : Number(value));
          const updated = { 
            ...p, 
            [field]: parsedValue 
          };
          const matchedPlayer = validPlayers.find(
            (vp) => vp.name.trim().toLowerCase() === updated.username.trim().toLowerCase() && 
                    vp.team.trim().toLowerCase() === updated.team.trim().toLowerCase()
          );
          updated.nameMatched = !!matchedPlayer;
          return updated;
        }
        return p;
      });

      // Recalculate scores if not forfeit
      if (!editingGameIsForfeit) {
        const newScores: Record<string, number> = {};
        updatedData.forEach(p => {
          if (!p.team) return;
          const ptsNum = p.pts === "" ? 0 : Number(p.pts);
          newScores[p.team] = (newScores[p.team] || 0) + ptsNum;
        });
        setEditingGameScores(newScores);
        
        const teams = Object.keys(newScores);
        if (teams.length >= 2) {
          const winner = Number(newScores[teams[0]]) > Number(newScores[teams[1]]) ? teams[0] : teams[1];
          setEditingGameWinner(winner);
        } else if (teams.length === 1) {
          setEditingGameWinner(teams[0]);
        }
      }

      return updatedData;
    });
  };

  const handleAddRowToPending = () => {
    setEditingGameData(prev => [
      ...prev,
      {
        id: String(Date.now()),
        username: "",
        team: editingGameData[0]?.team || validPlayers[0]?.team || "",
        pts: "",
        reb: "",
        ast: "",
        stl: "",
        blk: "",
        to: "",
        fouls: "",
        fgm: "",
        fga: "",
        tpm: "",
        tpa: "",
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
    if (hasErrors && editingGameDestinations.individual) {
      alert(lang === 'en' ? "Please correct unmatched names before approving." : "Por favor corrige los nombres no encontrados antes de aprobar.");
      return;
    }

    if (!confirm(lang === 'en' ? "Are you sure you want to approve and register this game?" : "¿Estás seguro de que deseas aprobar y registrar este partido en Google Sheets?")) {
      return;
    }

    setIsScanning(true);
    try {
      const cleanPlayer = (p: any) => ({
        ...p,
        pts: p.pts === "" ? 0 : Number(p.pts),
        reb: p.reb === "" ? 0 : Number(p.reb),
        ast: p.ast === "" ? 0 : Number(p.ast),
        stl: p.stl === "" ? 0 : Number(p.stl),
        blk: p.blk === "" ? 0 : Number(p.blk),
        to: p.to === "" ? 0 : Number(p.to),
        fouls: p.fouls === "" ? 0 : Number(p.fouls),
        fgm: p.fgm === "" ? 0 : Number(p.fgm),
        fga: p.fga === "" ? 0 : Number(p.fga),
        tpm: p.tpm === "" ? 0 : Number(p.tpm),
        tpa: p.tpa === "" ? 0 : Number(p.tpa),
      });

      const teamPoints: Record<string, number> = {};
      editingGameData.forEach(p => {
        const ptsNum = p.pts === "" ? 0 : Number(p.pts);
        teamPoints[p.team] = (teamPoints[p.team] || 0) + ptsNum;
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
        return { ...cleanPlayer(p), opponent, result };
      });

      const pendingGameObj = pendingGames.find(g => g.id === gameId);
      const gameSemana = pendingGameObj?.semana || "";

      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: finalData,
          destinations: editingGameDestinations,
          semana: gameSemana,
          fecha: convertInputDateToSheetFormat(editingGameFecha),
          scores: editingGameScores,
          winner: editingGameWinner,
          isForfeit: editingGameIsForfeit
        })
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
    // Record manual edit
    setManualEdits(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: true
      }
    }));

    setScannedData(prev => {
      const updatedData = prev.map(p => {
        if (p.id === id) {
          const parsedValue = (field === 'username' || field === 'team')
            ? value
            : (value === "" ? "" : Number(value));
          const updated = { 
            ...p, 
            [field]: parsedValue
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
      });

      // Recalculate scores if not forfeit
      if (!isForfeit) {
        const newScores: Record<string, number> = {};
        updatedData.forEach(p => {
          if (!p.team) return;
          const ptsNum = p.pts === "" ? 0 : Number(p.pts);
          newScores[p.team] = (newScores[p.team] || 0) + ptsNum;
        });
        setCustomScores(newScores);
        
        const teams = Object.keys(newScores);
        if (teams.length >= 2) {
          const winner = Number(newScores[teams[0]]) > Number(newScores[teams[1]]) ? teams[0] : teams[1];
          setSelectedWinner(winner);
        } else if (teams.length === 1) {
          setSelectedWinner(teams[0]);
        }
      }

      return updatedData;
    });
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
                              {game.semana && game.semana !== "Actual" && (
                                <span className="inline-block bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[8px] font-black uppercase px-2 py-0.5 rounded-md mt-1 tracking-widest">
                                  📅 {game.semana}
                                </span>
                              )}
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
                                  
                                  let initialScores = game.scores || {};
                                  let initialWinner = game.winner || "";
                                  if (Object.keys(initialScores).length === 0) {
                                    // Auto-calculate from game.data
                                    const teamPoints: Record<string, number> = {};
                                    game.data.forEach((p: any) => {
                                      if (!p.team) return;
                                      const ptsNum = p.pts === "" ? 0 : Number(p.pts);
                                      teamPoints[p.team] = (teamPoints[p.team] || 0) + ptsNum;
                                    });
                                    initialScores = teamPoints;
                                    
                                    const teams = Object.keys(teamPoints);
                                    if (teams.length >= 2) {
                                      initialWinner = teamPoints[teams[0]] > teamPoints[teams[1]] ? teams[0] : teams[1];
                                    } else if (teams.length === 1) {
                                      initialWinner = teams[0];
                                    }
                                  }
                                  setEditingGameFecha(convertSheetDateToInputFormat(game.fecha || ""));
                                  setEditingGameScores(initialScores);
                                  setEditingGameWinner(initialWinner);
                                  setEditingGameIsForfeit(game.isForfeit || false);
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
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-gray-400 uppercase">{lang === 'en' ? "Select Destinations:" : "Destinos del Registro:"}</span>
                                {game.semana && game.semana !== "Actual" && (
                                  <span className="text-[10px] text-yellow-500 font-bold uppercase mt-1">
                                    📅 {lang === 'en' ? `WEEK: ${game.semana} (Historical Scoreboard Only)` : `SEMANA: ${game.semana} (Solo Scoreboard Histórico)`}
                                  </span>
                                )}
                              </div>
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

                            {/* Panel de Resultados para Admin (Resultados_Input) */}
                            {(!game.semana || game.semana === "Actual") ? (
                              <div className="p-4 bg-black/40 border border-white/5 rounded-xl space-y-3">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-2">
                                  <div>
                                    <h4 className="text-xs font-black uppercase text-bsn-neon tracking-wider">
                                      {lang === 'en' ? 'Results Details (Resultados_Input)' : 'Detalles de Resultados (Resultados_Input)'}
                                    </h4>
                                  </div>
                                  <label className="flex items-center space-x-2 cursor-pointer select-none mt-1 sm:mt-0">
                                    <input 
                                      type="checkbox" 
                                      checked={editingGameIsForfeit} 
                                      onChange={(e) => handleEditingToggleForfeit(e.target.checked)}
                                      className="w-3.5 h-3.5 accent-red-500 rounded bg-black/60 border border-white/20" 
                                    />
                                    <span className="text-[10px] font-black uppercase tracking-wider text-red-400">
                                      {lang === 'en' ? 'Forfeit (Default Win)' : 'Forfeit (Victoria por Default)'}
                                    </span>
                                  </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {/* Fecha */}
                                  <div className="flex flex-col justify-center">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                                      {lang === 'en' ? 'Date played' : 'Fecha del juego'}
                                    </label>
                                    <input 
                                      type="date" 
                                      value={editingGameFecha} 
                                      onChange={(e) => setEditingGameFecha(e.target.value)}
                                      className="bg-black/60 border border-white/10 focus:border-bsn-neon rounded-lg p-2 outline-none text-white text-xs font-bold w-full"
                                    />
                                  </div>

                                  {/* Scores de Equipos */}
                                  <div className="md:col-span-2 grid grid-cols-2 gap-3">
                                    {Array.from(new Set(editingGameData.map(p => p.team))).filter(Boolean).map((teamName) => (
                                      <div key={teamName} className="flex flex-col justify-center">
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 truncate">
                                          {lang === 'en' ? `Points ${teamName}` : `Puntos ${teamName}`}
                                        </label>
                                        <input 
                                          type="number" 
                                          value={editingGameScores[teamName] ?? 0} 
                                          onChange={(e) => {
                                            const val = e.target.value === "" ? "" : Number(e.target.value);
                                            setEditingGameScores(prev => ({ ...prev, [teamName]: val }));
                                          }}
                                          disabled={editingGameIsForfeit}
                                          className="bg-black/60 border border-white/10 focus:border-bsn-neon rounded-lg p-2 outline-none text-white text-xs font-bold w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                          min="0"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Ganador */}
                                <div className="flex flex-col sm:flex-row justify-between items-center bg-black/20 p-2 rounded-lg border border-white/5 gap-2">
                                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                    {lang === 'en' ? 'Winner:' : 'Ganador:'}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {Array.from(new Set(editingGameData.map(p => p.team))).filter(Boolean).map((teamName) => (
                                      <button
                                        key={teamName}
                                        onClick={() => handleEditingWinnerChange(teamName)}
                                        type="button"
                                        className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all border ${
                                          editingGameWinner === teamName 
                                            ? 'bg-bsn-neon border-bsn-neon text-black' 
                                            : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                                        }`}
                                      >
                                        {teamName}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-[10px] font-semibold leading-relaxed">
                                📅 {lang === 'en'
                                  ? "Historical Mode: Results (scores, date, and winner) for this week are already registered in Google Sheets and will not be modified."
                                  : "Modo Histórico: Los resultados de esta semana (marcador, fecha y ganador) ya están registrados en Google Sheets y no serán modificados."}
                              </div>
                            )}

                            {editingGameDestinations.scoreboard && (
                              <div className="p-3 bg-bsn-neon/10 border border-bsn-neon/20 rounded-xl text-bsn-neon text-[10px] font-bold flex items-center justify-between mt-2">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-bsn-neon animate-ping shrink-0" />
                                  {lang === 'en' 
                                    ? "📝 Scroll table right to view/edit shot attempts (FGM/FGA & 3PM/3PA) ➡️" 
                                    : "📝 Desliza la tabla a la derecha para ver/editar intentos de tiros (FGM/FGA y 3PM/3PA) ➡️"}
                                </span>
                              </div>
                            )}

                            <div className="overflow-x-auto custom-scrollbar border border-white/10 rounded-xl bg-black/30 backdrop-blur-md">
                              <table className="w-full text-left min-w-[850px] border-collapse">
                                <thead>
                                  <tr className="bg-black/50 border-b border-white/10 text-bsn-neon uppercase text-[9px] font-black tracking-wider">
                                    <th className="p-3">Equipo</th>
                                    <th className="p-3">Jugador / Username</th>
                                    <th className="p-3 text-center w-14">PTS</th>
                                    <th className="p-3 text-center w-12">REB</th>
                                    <th className="p-3 text-center w-12">AST</th>
                                    <th className="p-3 text-center w-12">STL</th>
                                    <th className="p-3 text-center w-12">BLK</th>
                                    {editingGameDestinations.scoreboard && (
                                      <>
                                        <th className="p-3 text-center w-28">FG (M/A)</th>
                                        <th className="p-3 text-center w-28">3P (M/A)</th>
                                      </>
                                    )}
                                    <th className="p-3 text-center w-10">Acción</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-xs">
                                  {editingGameData.map((player, idx) => {
                                    const isRowMatched = player.nameMatched;
                                    const teamRoster = validPlayers.filter(vp => vp.team.toLowerCase().trim() === player.team.toLowerCase().trim());
                                    
                                    // Logical warnings for stats
                                    const calculatedPts = editingGameDestinations.scoreboard
                                      ? ((Number(player.fgm || 0) - Number(player.tpm || 0)) * 2 + Number(player.tpm || 0) * 3)
                                      : 0;
                                    const hasPtsWarning = Number(player.pts || 0) < calculatedPts;
                                    const hasFgWarning = Number(player.fgm || 0) > Number(player.fga || 0);
                                    const has3pWarning = Number(player.tpm || 0) > Number(player.tpa || 0);
                                    const has3pGreaterFgWarning = Number(player.tpm || 0) > Number(player.fgm || 0);

                                    return (
                                      <tr 
                                        key={idx} 
                                        className={`transition-colors duration-200 ${!isRowMatched ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-white/5'}`}
                                      >
                                        {/* Selector de Equipo */}
                                        <td className="p-2">
                                          <select 
                                            value={player.team} 
                                            onChange={(e) => handlePendingDataChange(idx, 'team', e.target.value)}
                                            className="bg-black/50 border border-white/10 text-white rounded-lg p-1.5 text-xs font-bold outline-none focus:border-bsn-neon w-32"
                                          >
                                            {uniqueTeams.map(t => (
                                              <option key={t} value={t}>{t}</option>
                                            ))}
                                          </select>
                                        </td>

                                        {/* Selector de Jugador */}
                                        <td className="p-2">
                                          <div className="flex flex-col gap-1">
                                            <select 
                                              value={player.username} 
                                              onChange={(e) => handlePendingDataChange(idx, 'username', e.target.value)}
                                              className={`bg-black/50 border text-white rounded-lg p-1.5 text-xs font-bold outline-none focus:border-bsn-neon w-40 ${!isRowMatched ? 'border-red-500/40 text-red-400' : 'border-white/10'}`}
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

                                        {/* PTS */}
                                        <td className="p-2 relative">
                                          <div className="flex items-center justify-center gap-1">
                                            <input 
                                              type="number" 
                                              value={player.pts === 0 ? "0" : (player.pts ?? "")} 
                                              onChange={(e) => handlePendingDataChange(idx, 'pts', e.target.value)}
                                              onFocus={(e) => e.target.select()}
                                              className={`w-12 bg-black/50 border rounded-lg p-1.5 text-xs font-bold text-center focus:border-bsn-neon outline-none ${hasPtsWarning ? 'border-yellow-500/50 text-yellow-400' : 'border-white/10'}`}
                                              min="0"
                                            />
                                            {hasPtsWarning && (
                                              <span 
                                                className="cursor-help text-yellow-500 shrink-0" 
                                                title={lang === 'en' 
                                                  ? "Points are less than FGM/3PM made points. Scroll right to adjust FGM/3PM if needed!" 
                                                  : "Los puntos ingresados son menores a la suma de tiros anotados (FGM/3PM). Desplázate a la derecha y ajusta los tiros encestados si es necesario."}
                                              >
                                                ⚠️
                                              </span>
                                            )}
                                          </div>
                                        </td>

                                        {/* REB */}
                                        <td className="p-2">
                                          <input 
                                            type="number" 
                                            value={player.reb === 0 ? "0" : (player.reb ?? "")} 
                                            onChange={(e) => handlePendingDataChange(idx, 'reb', e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            className="w-10 bg-black/50 border border-white/10 rounded-lg p-1.5 text-xs font-bold text-center focus:border-bsn-neon outline-none"
                                            min="0"
                                          />
                                        </td>

                                        {/* AST */}
                                        <td className="p-2">
                                          <input 
                                            type="number" 
                                            value={player.ast === 0 ? "0" : (player.ast ?? "")} 
                                            onChange={(e) => handlePendingDataChange(idx, 'ast', e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            className="w-10 bg-black/50 border border-white/10 rounded-lg p-1.5 text-xs font-bold text-center focus:border-bsn-neon outline-none"
                                            min="0"
                                          />
                                        </td>

                                        {/* STL */}
                                        <td className="p-2">
                                          <input 
                                            type="number" 
                                            value={player.stl === 0 ? "0" : (player.stl ?? "")} 
                                            onChange={(e) => handlePendingDataChange(idx, 'stl', e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            className="w-10 bg-black/50 border border-white/10 rounded-lg p-1.5 text-xs font-bold text-center focus:border-bsn-neon outline-none"
                                            min="0"
                                          />
                                        </td>

                                        {/* BLK */}
                                        <td className="p-2">
                                          <input 
                                            type="number" 
                                            value={player.blk === 0 ? "0" : (player.blk ?? "")} 
                                            onChange={(e) => handlePendingDataChange(idx, 'blk', e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            className="w-10 bg-black/50 border border-white/10 rounded-lg p-1.5 text-xs font-bold text-center focus:border-bsn-neon outline-none"
                                            min="0"
                                          />
                                        </td>

                                        {/* FGM / FGA Grouped */}
                                        {editingGameDestinations.scoreboard && (
                                          <>
                                            <td className="p-2">
                                              <div className={`flex items-center justify-center bg-black/40 border rounded-lg px-1.5 py-1 ${hasFgWarning || has3pGreaterFgWarning ? 'border-red-500/40 text-red-400' : 'border-white/10 focus-within:border-bsn-neon'}`}>
                                                <input 
                                                  type="number" 
                                                  placeholder="M"
                                                  value={player.fgm === 0 ? "0" : (player.fgm ?? "")} 
                                                  onChange={(e) => handlePendingDataChange(idx, 'fgm', e.target.value)}
                                                  onFocus={(e) => e.target.select()}
                                                  className="w-7 bg-transparent text-center text-xs font-black focus:outline-none text-white placeholder-neutral-700"
                                                  min="0"
                                                />
                                                <span className="text-neutral-500 font-bold px-1 text-xs select-none">/</span>
                                                <input 
                                                  type="number" 
                                                  placeholder="A"
                                                  value={player.fga === 0 ? "0" : (player.fga ?? "")} 
                                                  onChange={(e) => handlePendingDataChange(idx, 'fga', e.target.value)}
                                                  onFocus={(e) => e.target.select()}
                                                  className="w-7 bg-transparent text-center text-xs font-black focus:outline-none text-white placeholder-neutral-700"
                                                  min="0"
                                                />
                                              </div>
                                            </td>

                                            {/* 3PM / 3PA Grouped */}
                                            <td className="p-2">
                                              <div className={`flex items-center justify-center bg-black/40 border rounded-lg px-1.5 py-1 ${has3pWarning || has3pGreaterFgWarning ? 'border-red-500/40 text-red-400' : 'border-white/10 focus-within:border-bsn-neon'}`}>
                                                <input 
                                                  type="number" 
                                                  placeholder="M"
                                                  value={player.tpm === 0 ? "0" : (player.tpm ?? "")} 
                                                  onChange={(e) => handlePendingDataChange(idx, 'tpm', e.target.value)}
                                                  onFocus={(e) => e.target.select()}
                                                  className="w-7 bg-transparent text-center text-xs font-black focus:outline-none text-white placeholder-neutral-700"
                                                  min="0"
                                                />
                                                <span className="text-neutral-500 font-bold px-1 text-xs select-none">/</span>
                                                <input 
                                                  type="number" 
                                                  placeholder="A"
                                                  value={player.tpa === 0 ? "0" : (player.tpa ?? "")} 
                                                  onChange={(e) => handlePendingDataChange(idx, 'tpa', e.target.value)}
                                                  onFocus={(e) => e.target.select()}
                                                  className="w-7 bg-transparent text-center text-xs font-black focus:outline-none text-white placeholder-neutral-700"
                                                  min="0"
                                                />
                                              </div>
                                            </td>
                                          </>
                                        )}
                                        
                                        {/* Eliminar Fila */}
                                        <td className="p-2 text-center">
                                          <button 
                                            onClick={() => handleRemoveRowFromPending(idx)}
                                            className="p-1.5 text-red-400 hover:text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors cursor-pointer"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-black/40 border border-white/5 rounded-2xl mb-8">
              {/* Columna Izquierda: Selector de Jornada */}
              <div className="flex flex-col justify-center">
                <h3 className="text-sm font-black uppercase text-gray-400 tracking-wider mb-2">
                  {lang === 'en' ? 'Game Week (Jornada)' : 'Semana del Juego (Jornada)'}
                </h3>
                <div className="relative">
                  <select
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-bsn-neon transition-all cursor-pointer appearance-none pr-10"
                  >
                    <option value="Actual">{lang === 'en' ? 'Regular Season (Current)' : 'Jornada Regular (Actual)'}</option>
                    {Array.from({ length: 12 }, (_, i) => `Semana ${i + 1}`).map((week) => (
                      <option key={week} value={week}>
                        {lang === 'en' ? `Week ${week.split(' ')[1]}` : week}
                      </option>
                    ))}
                  </select>
                  {/* Flechita para custom select */}
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </div>
                </div>
                {selectedWeek !== "Actual" && (
                  <p className="text-[10px] text-yellow-500 font-bold mt-2">
                    {lang === 'en' 
                      ? '⚠️ Historical mode: Players list (Individual Stats) is automatically disabled.' 
                      : '⚠️ Modo histórico: La lista de jugadores (Stats Individuales) se desactiva automáticamente.'}
                  </p>
                )}
              </div>

              {/* Columna Derecha: Destinos de Stats */}
              <div className="flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase text-gray-400 tracking-wider mb-1">{t[lang].destTitle}</h3>
                  <p className="text-xs text-gray-500">Decide a qué hojas de cálculo se enviarán los datos recopilados.</p>
                </div>
                <div className="flex flex-col gap-2 mt-4 md:mt-2">
                  <p className="text-[10px] font-black uppercase text-bsn-neon tracking-wider">
                    {t[lang].selectOneOrBoth}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <label className="flex items-center space-x-3 cursor-pointer group select-none">
                      <input 
                        type="checkbox" 
                        checked={destinations.scoreboard} 
                        onChange={() => toggleDestination('scoreboard')} 
                        className="w-5 h-5 accent-bsn-neon rounded bg-black/60 border border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer" 
                      />
                      <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">Scoreboard</span>
                    </label>
                    <label 
                      className={`flex items-center space-x-3 select-none ${
                        selectedWeek !== "Actual" 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'cursor-pointer group'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={destinations.individual} 
                        onChange={() => toggleDestination('individual')} 
                        disabled={selectedWeek !== "Actual"}
                        className={`w-5 h-5 accent-bsn-neon rounded bg-black/60 border border-white/20 focus:ring-0 focus:ring-offset-0 ${
                          selectedWeek !== "Actual" ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                        }`} 
                      />
                      <span className={`text-xs font-bold text-gray-300 transition-colors ${
                        selectedWeek !== "Actual" ? '' : 'group-hover:text-white'
                      }`}>
                        {lang === 'en' ? 'Players list' : 'Lista Jugadores'}
                      </span>
                    </label>
                  </div>
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
                {/* Visual Validation Preview Layout */}
                {croppedPreviewSrc && (
                  <div className="w-full bg-[#09090e]/95 backdrop-blur-md p-4 border border-white/10 rounded-2xl shadow-[0_15px_30px_rgba(0,0,0,0.8)] mb-6">
                    <HDInteractiveViewer imageSrc={croppedPreviewSrc} lang={lang} />
                  </div>
                )}

                {/* Panel de Detalles del Partido */}
                {selectedWeek === "Actual" ? (
                  <div className="p-5 bg-black/40 border border-white/5 rounded-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-3">
                      <div>
                        <h3 className="text-sm font-black uppercase text-bsn-neon tracking-wider">
                          {lang === 'en' ? 'Match Results Details' : 'Detalles del Resultado del Partido'}
                        </h3>
                        <p className="text-[10px] text-gray-500">
                          {lang === 'en' ? 'These values will update the Resultados_Input sheet tab.' : 'Estos valores actualizarán la pestaña Resultados_Input de la hoja.'}
                        </p>
                      </div>
                      <label className="flex items-center space-x-2 cursor-pointer select-none mt-2 sm:mt-0">
                        <input 
                          type="checkbox" 
                          checked={isForfeit} 
                          onChange={(e) => handleToggleForfeit(e.target.checked)}
                          className="w-4 h-4 accent-red-500 rounded bg-black/60 border border-white/20" 
                        />
                        <span className="text-xs font-black uppercase tracking-wider text-red-400">
                          {lang === 'en' ? 'Forfeit (Default Win)' : 'Forfeit (Victoria por Default)'}
                        </span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Fecha */}
                      <div className="flex flex-col justify-center">
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                          {lang === 'en' ? 'Date played' : 'Fecha del juego'}
                        </label>
                        <input 
                          type="date" 
                          value={selectedDate} 
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="bg-black/60 border border-white/10 focus:border-bsn-neon rounded-xl p-2.5 outline-none text-white text-xs font-bold w-full"
                        />
                      </div>

                      {/* Scores de Equipos */}
                      <div className="md:col-span-2 grid grid-cols-2 gap-4">
                        {Array.from(new Set(scannedData.map(p => p.team))).filter(Boolean).map((teamName) => (
                          <div key={teamName} className="flex flex-col justify-center">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 truncate">
                              {lang === 'en' ? `Points ${teamName}` : `Puntos ${teamName}`}
                            </label>
                            <input 
                              type="number" 
                              value={customScores[teamName] ?? 0} 
                              onChange={(e) => {
                                const val = e.target.value === "" ? "" : Number(e.target.value);
                                setCustomScores(prev => ({ ...prev, [teamName]: val }));
                              }}
                              disabled={isForfeit}
                              className="bg-black/60 border border-white/10 focus:border-bsn-neon rounded-xl p-2.5 outline-none text-white text-xs font-bold w-full disabled:opacity-50 disabled:cursor-not-allowed"
                              min="0"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ganador */}
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5 gap-3">
                      <span className="text-xs font-black uppercase text-gray-400 tracking-wider">
                        {lang === 'en' ? 'Winner:' : 'Ganador del Juego:'}
                      </span>
                      <div className="flex items-center gap-2">
                        {Array.from(new Set(scannedData.map(p => p.team))).filter(Boolean).map((teamName) => (
                          <button
                            key={teamName}
                            onClick={() => handleWinnerChange(teamName)}
                            type="button"
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${
                              selectedWinner === teamName 
                                ? 'bg-bsn-neon border-bsn-neon text-black shadow-[0_0_10px_var(--color-bsn-neon)]' 
                                : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                            }`}
                          >
                            {teamName}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-xs font-semibold leading-relaxed">
                    📅 {lang === 'en'
                      ? "Historical Mode: Results (scores, date, and winner) for this week are already registered in Google Sheets and will not be overwritten. Only player stats will be uploaded."
                      : "Modo Histórico: Los resultados de esta semana (marcador, fecha y ganador) ya están registrados en Google Sheets y no serán modificados. Solo se subirán las estadísticas de los jugadores."}
                  </div>
                )}

                {/* Editor Interactivo de Estadísticas */}
                {destinations.scoreboard && (
                  <div className="p-3 bg-bsn-neon/10 border border-bsn-neon/20 rounded-xl text-bsn-neon text-xs font-bold flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-bsn-neon animate-ping shrink-0" />
                      {lang === 'en' 
                        ? "📝 Scroll table right to view/edit shot attempts (FGM/FGA & 3PM/3PA) ➡️" 
                        : "📝 Desliza la tabla a la derecha para ver/editar intentos de tiros (FGM/FGA y 3PM/3PA) ➡️"}
                    </span>
                  </div>
                )}
                <div className="overflow-x-auto custom-scrollbar border border-white/10 rounded-xl bg-black/30 backdrop-blur-md">
                  <table className="w-full text-left min-w-[850px] border-collapse">
                    <thead>
                      <tr className="bg-black/50 border-b border-white/10 text-bsn-neon uppercase text-[10px] font-black tracking-wider">
                        <th className="p-4">Equipo</th>
                        <th className="p-4">Jugador / Username</th>
                        <th className="p-4 text-center w-16">PTS</th>
                        <th className="p-4 text-center w-14">REB</th>
                        <th className="p-4 text-center w-14">AST</th>
                        <th className="p-4 text-center w-14">STL</th>
                        <th className="p-4 text-center w-14">BLK</th>
                        {destinations.scoreboard && (
                          <>
                            <th className="p-4 text-center w-32">FG (M/A)</th>
                            <th className="p-4 text-center w-32">3P (M/A)</th>
                          </>
                        )}
                        <th className="p-4 text-center w-12">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                       {scannedData.map((player) => {
                        const isRowMatched = player.nameMatched;
                        const teamRoster = validPlayers.filter(vp => vp.team.toLowerCase().trim() === player.team.toLowerCase().trim());
                        
                        // Logical warnings for stats
                        const calculatedPts = destinations.scoreboard
                          ? ((Number(player.fgm || 0) - Number(player.tpm || 0)) * 2 + Number(player.tpm || 0) * 3)
                          : 0;
                        const hasPtsWarning = Number(player.pts || 0) < calculatedPts;
                        const hasFgWarning = Number(player.fgm || 0) > Number(player.fga || 0);
                        const has3pWarning = Number(player.tpm || 0) > Number(player.tpa || 0);
                        const has3pGreaterFgWarning = Number(player.tpm || 0) > Number(player.fgm || 0);

                        // High values check (out of range)
                        const isPtsHigh = Number(player.pts || 0) > 80;
                        const isRebHigh = Number(player.reb || 0) > 30;
                        const isAstHigh = Number(player.ast || 0) > 30;
                        const isStlHigh = Number(player.stl || 0) > 15;
                        const isBlkHigh = Number(player.blk || 0) > 15;

                        const hasEmptyStats = player.pts === "" || player.reb === "" || player.ast === "" || player.stl === "" || player.blk === "" || player.fgm === "" || player.fga === "" || player.tpm === "" || player.tpa === "";
                        const isLowConfidence = player.lowConfidence === true || hasEmptyStats;
                        const isFgLowConfidence = player.lowConfidence === true || player.fgm === "" || player.fga === "";
                        const is3pLowConfidence = player.lowConfidence === true || player.tpm === "" || player.tpa === "";
                        const hasAnyWarning = hasPtsWarning || hasFgWarning || has3pWarning || has3pGreaterFgWarning || isPtsHigh || isRebHigh || isAstHigh || isStlHigh || isBlkHigh;

                        let rowBgClass = "hover:bg-white/5";
                        let borderLeftClass = "border-l-2 border-l-transparent";

                        if (!isRowMatched) {
                          // Unmatched name -> yellow alert
                          rowBgClass = "bg-yellow-500/5 hover:bg-yellow-500/10";
                          borderLeftClass = "border-l-4 border-l-yellow-500/80";
                        } else if (isLowConfidence) {
                          // Low confidence OCR or empty stats -> yellow alert
                          rowBgClass = "bg-yellow-500/5 hover:bg-yellow-500/10";
                          borderLeftClass = "border-l-4 border-l-yellow-500/80";
                        } else if (hasAnyWarning) {
                          // Has logical warnings or out-of-range stats -> red alert
                          rowBgClass = "bg-red-500/5 hover:bg-red-500/10";
                          borderLeftClass = "border-l-4 border-l-red-500/80";
                        } else {
                          // Lectura correcta (Green confirmation border)
                          rowBgClass = "bg-green-500/5 hover:bg-green-500/10";
                          borderLeftClass = "border-l-4 border-l-green-500/80";
                        }

                        const getFieldInputClass = (field: keyof ScannedPlayer, isHigh: boolean = false) => {
                          const isEdited = manualEdits[player.id]?.[field] === true;
                          const isLowField = player.lowConfidence === true && (field === 'pts' || field === 'reb' || field === 'ast' || field === 'stl' || field === 'blk' || field === 'fgm' || field === 'fga' || field === 'tpm' || field === 'tpa');
                          const isEmptyField = player[field] === "";
                          
                          if (isHigh) {
                            return "border-yellow-500/50 text-yellow-400 bg-yellow-500/5";
                          }
                          if (isLowField || isEmptyField) {
                            return "border-amber-500 text-amber-300 bg-amber-500/5 shadow-[0_0_8px_rgba(245,158,11,0.25)] animate-pulse";
                          }
                          if (isEdited) {
                            return "border-amber-500 text-amber-300 bg-amber-500/5 shadow-[0_0_8px_rgba(245,158,11,0.25)]";
                          }
                          return "border-white/10";
                        };

                        const isTeamEdited = manualEdits[player.id]?.['team'] === true;
                        const isUserEdited = manualEdits[player.id]?.['username'] === true;

                        return (
                          <tr 
                            key={player.id} 
                            className={`transition-colors duration-300 ${rowBgClass} ${borderLeftClass}`}
                          >
                            {/* Selector de Equipo */}
                            <td className="p-3">
                              <select 
                                value={player.team} 
                                onChange={(e) => handleDataChange(player.id, 'team', e.target.value)}
                                className={`bg-black/40 border text-white rounded-lg p-2 text-xs font-bold outline-none focus:border-bsn-neon w-36 ${isTeamEdited ? 'border-amber-500 text-amber-300 bg-amber-500/5' : 'border-white/10'}`}
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
                                  className={`bg-black/40 border text-white rounded-lg p-2 text-xs font-bold outline-none focus:border-bsn-neon w-44 ${!isRowMatched ? 'border-yellow-500/40 text-yellow-400 bg-yellow-500/5' : (isUserEdited ? 'border-amber-500 text-amber-300 bg-amber-500/5' : 'border-white/10')}`}
                                >
                                  <option value="">-- Selecciona Jugador --</option>
                                  {teamRoster.map(vp => (
                                    <option key={vp.name} value={vp.name}>{vp.name}</option>
                                  ))}
                                </select>
                                {!isRowMatched && (
                                  <span className="text-[9px] font-black text-yellow-500 flex items-center gap-1 mt-0.5 animate-pulse">
                                    <AlertCircle className="w-3 h-3" />
                                    {t[lang].unmatchedError}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* PTS */}
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1">
                                <input 
                                  type="number" 
                                  value={player.pts === 0 ? "0" : (player.pts ?? "")} 
                                  onChange={(e) => handleDataChange(player.id, 'pts', e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className={`w-14 bg-black/40 border rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon outline-none ${hasPtsWarning ? 'border-red-500/50 text-red-400 bg-red-500/5' : (isPtsHigh ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/5' : (manualEdits[player.id]?.['pts'] === true ? 'border-amber-500 text-amber-300 bg-amber-500/5 shadow-[0_0_8px_rgba(245,158,11,0.25)]' : 'border-white/10'))}`}
                                  min="0"
                                />
                                {(hasPtsWarning || isPtsHigh) && (
                                  <span 
                                    className={`cursor-help shrink-0 ${hasPtsWarning ? 'text-red-500' : 'text-yellow-500'}`} 
                                    title={hasPtsWarning 
                                      ? (lang === 'en' 
                                        ? "Points are less than FGM/3PM made points. Scroll right to adjust FGM/3PM if needed!" 
                                        : "Los puntos ingresados son menores a la suma de tiros anotados (FGM/3PM). Desplázate a la derecha y ajusta los tiros encestados si es necesario.")
                                      : (lang === 'en' ? "Extremely high points value." : "Valor de puntos extremadamente alto.")}
                                  >
                                    ⚠️
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* REB */}
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1">
                                <input 
                                  type="number" 
                                  value={player.reb === 0 ? "0" : (player.reb ?? "")} 
                                  onChange={(e) => handleDataChange(player.id, 'reb', e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className={`w-12 bg-black/40 border rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon outline-none ${getFieldInputClass('reb', isRebHigh)}`}
                                  min="0"
                                />
                                {isRebHigh && (
                                  <span className="text-yellow-500 cursor-help shrink-0 font-bold" title={lang === 'en' ? "Extremely high rebounds value." : "Valor de rebotes extremadamente alto."}>⚠️</span>
                                )}
                              </div>
                            </td>

                            {/* AST */}
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1">
                                <input 
                                  type="number" 
                                  value={player.ast === 0 ? "0" : (player.ast ?? "")} 
                                  onChange={(e) => handleDataChange(player.id, 'ast', e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className={`w-12 bg-black/40 border rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon outline-none ${getFieldInputClass('ast', isAstHigh)}`}
                                  min="0"
                                />
                                {isAstHigh && (
                                  <span className="text-yellow-500 cursor-help shrink-0 font-bold" title={lang === 'en' ? "Extremely high assists value." : "Valor de asistencias extremadamente alto."}>⚠️</span>
                                )}
                              </div>
                            </td>

                            {/* STL */}
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1">
                                <input 
                                  type="number" 
                                  value={player.stl === 0 ? "0" : (player.stl ?? "")} 
                                  onChange={(e) => handleDataChange(player.id, 'stl', e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className={`w-12 bg-black/40 border rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon outline-none ${getFieldInputClass('stl', isStlHigh)}`}
                                  min="0"
                                />
                                {isStlHigh && (
                                  <span className="text-yellow-500 cursor-help shrink-0 font-bold" title={lang === 'en' ? "Extremely high steals value." : "Valor de robos extremadamente alto."}>⚠️</span>
                                )}
                              </div>
                            </td>

                            {/* BLK */}
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1">
                                <input 
                                  type="number" 
                                  value={player.blk === 0 ? "0" : (player.blk ?? "")} 
                                  onChange={(e) => handleDataChange(player.id, 'blk', e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className={`w-12 bg-black/40 border rounded-lg p-2 text-xs font-bold text-center focus:border-bsn-neon outline-none ${getFieldInputClass('blk', isBlkHigh)}`}
                                  min="0"
                                />
                                {isBlkHigh && (
                                  <span className="text-yellow-500 cursor-help shrink-0 font-bold" title={lang === 'en' ? "Extremely high blocks value." : "Valor de tapones extremadamente alto."}>⚠️</span>
                                )}
                              </div>
                            </td>

                            {/* FGM / FGA Grouped */}
                            {destinations.scoreboard && (
                              <>
                                <td className="p-3">
                                  <div className={`flex items-center justify-center bg-black/40 border rounded-lg px-2 py-1.5 ${hasFgWarning || has3pGreaterFgWarning ? 'border-red-500/40 text-red-400 bg-red-500/5' : (isFgLowConfidence ? 'border-amber-500 text-amber-300 bg-amber-500/5 shadow-[0_0_8px_rgba(245,158,11,0.25)] animate-pulse' : ((manualEdits[player.id]?.['fgm'] || manualEdits[player.id]?.['fga']) ? 'border-amber-500 text-amber-300 bg-amber-500/5 shadow-[0_0_8px_rgba(245,158,11,0.25)]' : 'border-white/10 focus-within:border-bsn-neon'))}`}>
                                    <input 
                                      type="number" 
                                      placeholder="M"
                                      value={player.fgm === 0 ? "0" : (player.fgm ?? "")} 
                                      onChange={(e) => handleDataChange(player.id, 'fgm', e.target.value)}
                                      onFocus={(e) => e.target.select()}
                                      className="w-8 bg-transparent text-center text-xs font-black focus:outline-none text-white placeholder-neutral-700"
                                      min="0"
                                    />
                                    <span className="text-neutral-500 font-bold px-1 text-xs select-none">/</span>
                                    <input 
                                      type="number" 
                                      placeholder="A"
                                      value={player.fga === 0 ? "0" : (player.fga ?? "")} 
                                      onChange={(e) => handleDataChange(player.id, 'fga', e.target.value)}
                                      onFocus={(e) => e.target.select()}
                                      className="w-8 bg-transparent text-center text-xs font-black focus:outline-none text-white placeholder-neutral-700"
                                      min="0"
                                    />
                                  </div>
                                </td>

                                {/* 3PM / 3PA Grouped */}
                                <td className="p-3">
                                  <div className={`flex items-center justify-center bg-black/40 border rounded-lg px-2 py-1.5 ${has3pWarning || has3pGreaterFgWarning ? 'border-red-500/40 text-red-400 bg-red-500/5' : (is3pLowConfidence ? 'border-amber-500 text-amber-300 bg-amber-500/5 shadow-[0_0_8px_rgba(245,158,11,0.25)] animate-pulse' : ((manualEdits[player.id]?.['tpm'] || manualEdits[player.id]?.['tpa']) ? 'border-amber-500 text-amber-300 bg-amber-500/5 shadow-[0_0_8px_rgba(245,158,11,0.25)]' : 'border-white/10 focus-within:border-bsn-neon'))}`}>
                                    <input 
                                      type="number" 
                                      placeholder="M"
                                      value={player.tpm === 0 ? "0" : (player.tpm ?? "")} 
                                      onChange={(e) => handleDataChange(player.id, 'tpm', e.target.value)}
                                      onFocus={(e) => e.target.select()}
                                      className="w-8 bg-transparent text-center text-xs font-black focus:outline-none text-white placeholder-neutral-700"
                                      min="0"
                                    />
                                    <span className="text-neutral-500 font-bold px-1 text-xs select-none">/</span>
                                    <input 
                                      type="number" 
                                      placeholder="A"
                                      value={player.tpa === 0 ? "0" : (player.tpa ?? "")} 
                                      onChange={(e) => handleDataChange(player.id, 'tpa', e.target.value)}
                                      onFocus={(e) => e.target.select()}
                                      className="w-8 bg-transparent text-center text-xs font-black focus:outline-none text-white placeholder-neutral-700"
                                      min="0"
                                    />
                                  </div>
                                </td>
                              </>
                            )}
                            
                            {/* Acción Eliminar Fila */}
                            <td className="p-3 text-center">
                              <button 
                                onClick={() => handleRemoveRow(player.id)}
                                className="p-2 text-red-400 hover:text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors cursor-pointer"
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
