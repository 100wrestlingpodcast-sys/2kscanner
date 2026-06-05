"use client";

import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Lock, User, AlertCircle, Mail, Key, Shield, UserPlus, CheckCircle } from "lucide-react";

interface ValidPlayer {
  name: string;
  team: string;
}

export default function Login() {
  const [activeTab, setActiveTab] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Registration custom fields
  const [captainName, setCaptainName] = useState("");
  const [selectedRole, setSelectedRole] = useState<"captain" | "viewer" | "admin">("captain");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedPlayerName, setSelectedPlayerName] = useState("");
  const [adminCodeInput, setAdminCodeInput] = useState("");
  
  // Players database from Sheets
  const [validPlayers, setValidPlayers] = useState<ValidPlayer[]>([]);
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch players on mount to populate dropdowns in register tab
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch("/api/sheets?action=getPlayers");
        const data = await res.json();
        if (data.players) {
          setValidPlayers(data.players);
        }
      } catch (e) {
        console.error("Error fetching players for registration", e);
      }
    };
    fetchPlayers();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Credenciales incorrectas. Verifica tu email y contraseña.");
      } else {
        setError("Error de conexión. Inténtalo de nuevo.");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validations
    if (!email || !password || !confirmPassword || !captainName) {
      setError("Por favor completa todos los campos requeridos.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (selectedRole === "admin") {
      const systemAdminCode = process.env.NEXT_PUBLIC_ADMIN_PASSCODE || "adminbsn2k";
      if (adminCodeInput.trim().toUpperCase() !== systemAdminCode.trim().toUpperCase()) {
        setError("Clave de Administrador de la Liga incorrecta.");
        return;
      }
    }

    if (selectedRole === "captain") {
      if (!selectedTeam) {
        setError("Por favor selecciona tu equipo.");
        return;
      }
      if (!selectedPlayerName) {
        setError("Por favor selecciona tu jugador/roster.");
        return;
      }
    }

    setLoading(true);

    try {
      // Create user auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save user profile to Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        username: captainName,
        role: selectedRole,
        team: selectedRole === "captain" ? selectedTeam : "",
        playerName: selectedRole === "captain" ? selectedPlayerName : "",
        createdAt: new Date().toISOString()
      });

      // Local storage fallback for instant sync
      localStorage.setItem("bsn_captain_profile", JSON.stringify({
        role: selectedRole,
        authorized: true,
        team: selectedRole === "captain" ? selectedTeam : "",
        username: selectedRole === "captain" ? selectedPlayerName : captainName,
        activeView: selectedRole === "admin" ? "admin" : "experience"
      }));

      setSuccess("¡Cuenta creada exitosamente! Redirigiendo...");
      setTimeout(() => {
        // Auth state listener in page.tsx will pick this up
        window.location.reload();
      }, 1500);

    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("El correo electrónico ya está registrado por otro usuario.");
      } else {
        setError("Error al registrar el usuario: " + (err.message || "Inténtalo de nuevo."));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email) {
      setError("Por favor ingresa tu correo electrónico.");
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess("¡Correo enviado! Revisa tu bandeja de entrada o spam para restablecer tu contraseña.");
      setEmail("");
    } catch (err: any) {
      console.error(err);
      setError("Error al enviar el correo. Verifica que el email sea correcto.");
    } finally {
      setLoading(false);
    }
  };

  // Get list of unique teams
  const uniqueTeams = Array.from(new Set(validPlayers.map((p) => p.team))).sort();

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex flex-col items-center justify-center p-4">
      {/* Background radial overlays for dynamic depth */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[160px]" />
      </div>

      <div className="z-10 w-full max-w-md">
        {/* Logo and Brand Title */}
        <div className="text-center mb-8">
          <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700/50 shadow-2xl mb-4 transform hover:rotate-2 transition-transform duration-300">
            <Lock className="w-12 h-12 text-red-500" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight uppercase italic mb-1">
            BSN 2K <span className="text-red-500">STATS</span>
          </h1>
          <p className="text-neutral-400 text-sm font-semibold tracking-wider uppercase">
            Scanner & Aprobaciones de Liga
          </p>
        </div>

        {/* Tab Selection */}
        {activeTab !== "forgot" && (
          <div className="flex bg-neutral-950/60 p-1 border border-neutral-850 rounded-xl mb-6">
            <button
              onClick={() => { setActiveTab("login"); setError(""); setSuccess(""); }}
              className={`w-1/2 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                activeTab === "login"
                  ? "bg-red-600 text-white shadow-lg"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => { setActiveTab("register"); setError(""); setSuccess(""); }}
              className={`w-1/2 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                activeTab === "register"
                  ? "bg-red-600 text-white shadow-lg"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Registrarse
            </button>
          </div>
        )}

        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800/80 rounded-2xl p-6 shadow-2xl relative">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold leading-relaxed mb-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2.5 p-3.5 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-xs font-bold leading-relaxed mb-4">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{success}</p>
            </div>
          )}

          {/* TAB 1: LOGIN FORM */}
          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="w-4.5 h-4.5 text-neutral-500" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-neutral-950/60 border border-neutral-800 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all text-sm font-semibold"
                    placeholder="email@correo.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Contraseña</label>
                  <button
                    type="button"
                    onClick={() => { setActiveTab("forgot"); setError(""); setSuccess(""); }}
                    className="text-[10px] font-bold text-red-500 hover:text-red-400 uppercase tracking-wider"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="w-4.5 h-4.5 text-neutral-500" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-neutral-950/60 border border-neutral-800 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all text-sm font-semibold"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full relative group overflow-hidden rounded-xl bg-red-650 hover:bg-red-650/90 text-white font-black uppercase italic tracking-widest py-3.5 mt-6 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(239,68,68,0.25)] text-sm cursor-pointer"
              >
                {loading ? "Autenticando..." : "Entrar al Scanner"}
              </button>
            </form>
          )}

          {/* TAB 2: REGISTER FORM */}
          {activeTab === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Nombre del Capitán / Admin</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="w-4.5 h-4.5 text-neutral-500" />
                  </div>
                  <input
                    type="text"
                    required
                    value={captainName}
                    onChange={(e) => setCaptainName(e.target.value)}
                    className="w-full bg-neutral-950/60 border border-neutral-800 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all text-sm font-semibold"
                    placeholder="Tu nombre real o apodo"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Email de Registro</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="w-4.5 h-4.5 text-neutral-500" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-neutral-950/60 border border-neutral-800 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all text-sm font-semibold"
                    placeholder="email@correo.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Contraseña</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-neutral-950/60 border border-neutral-800 text-white rounded-xl py-3 px-3.5 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all text-sm font-semibold"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Confirmar</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-neutral-950/60 border border-neutral-800 text-white rounded-xl py-3 px-3.5 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all text-sm font-semibold"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Perfil de Acceso</label>
                <div className="flex bg-neutral-950/60 border border-neutral-800 rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => { setSelectedRole("captain"); setError(""); }}
                    className={`w-1/3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                      selectedRole === "captain" ? "bg-neutral-800 text-white border border-neutral-700" : "text-neutral-500"
                    }`}
                  >
                    Capitán
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedRole("viewer"); setError(""); }}
                    className={`w-1/3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                      selectedRole === "viewer" ? "bg-neutral-800 text-white border border-neutral-700" : "text-neutral-500"
                    }`}
                  >
                    Viewer
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedRole("admin"); setError(""); }}
                    className={`w-1/3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                      selectedRole === "admin" ? "bg-neutral-800 text-white border border-neutral-700" : "text-neutral-500"
                    }`}
                  >
                    Admin
                  </button>
                </div>
              </div>

              {/* Condicional de Capitán: Selección de Equipo y Nombre de Roster */}
              {selectedRole === "captain" && (
                <div className="space-y-3 p-4 bg-neutral-950/40 border border-neutral-800/80 rounded-xl animate-fadeIn">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Equipo Oficial</label>
                    <select
                      value={selectedTeam}
                      onChange={(e) => { setSelectedTeam(e.target.value); setSelectedPlayerName(""); }}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 outline-none text-white text-xs font-semibold focus:border-red-500"
                    >
                      <option value="">-- Selecciona tu Equipo --</option>
                      {uniqueTeams.map((team) => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Tu Jugador en Roster</label>
                    <select
                      value={selectedPlayerName}
                      disabled={!selectedTeam}
                      onChange={(e) => setSelectedPlayerName(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 outline-none text-white text-xs font-semibold focus:border-red-500 disabled:opacity-50"
                    >
                      <option value="">-- Selecciona tu Jugador --</option>
                      {validPlayers
                        .filter((p) => p.team === selectedTeam)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((player) => (
                          <option key={player.name} value={player.name}>{player.name}</option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Condicional de Administrador: Código de Acceso */}
              {selectedRole === "admin" && (
                <div className="space-y-2 p-4 bg-neutral-950/40 border border-neutral-850 rounded-xl animate-fadeIn">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Clave del Administrador de la Liga</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="w-3.5 h-3.5 text-neutral-500" />
                    </div>
                    <input
                      type="password"
                      required
                      value={adminCodeInput}
                      onChange={(e) => setAdminCodeInput(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-xl py-2 pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-xs font-semibold tracking-wider"
                      placeholder="Código Maestro"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full relative group overflow-hidden rounded-xl bg-red-650 hover:bg-red-650/90 text-white font-black uppercase italic tracking-widest py-3.5 mt-4 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(239,68,68,0.25)] text-sm cursor-pointer"
              >
                {loading ? "Creando Cuenta..." : "Registrar Cuenta"}
              </button>
            </form>
          )}

          {/* TAB 3: FORGOT PASSWORD FORM */}
          {activeTab === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-neutral-400 text-xs font-medium leading-relaxed mb-2 text-center">
                Ingresa tu correo para enviarte un enlace de restablecimiento.
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="w-4.5 h-4.5 text-neutral-500" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-neutral-950/60 border border-neutral-800 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all text-sm font-semibold"
                    placeholder="email@correo.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full relative group overflow-hidden rounded-xl bg-red-650 hover:bg-red-650/90 text-white font-black uppercase italic tracking-widest py-3.5 mt-2 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(239,68,68,0.25)] text-sm cursor-pointer"
              >
                {loading ? "Enviando Correo..." : "Enviar Enlace"}
              </button>
              
              <button
                type="button"
                onClick={() => { setActiveTab("login"); setError(""); setSuccess(""); }}
                className="w-full text-center text-xs font-bold text-neutral-450 hover:text-neutral-300 uppercase tracking-wider py-2 block transition-colors"
              >
                Volver a Iniciar Sesión
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
