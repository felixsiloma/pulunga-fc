import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { Home, Users, Calendar, ShieldAlert, LogOut, Plus } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("Home");
  const [email, setEmail] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState("");

  // SANDPACK STYLE INJECTOR HACK: Forces the browser preview to load colors instantly
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://jsdelivr.net";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      if (document.head.contains(link)) document.head.removeChild(link);
    };
  }, []);
  // App Master States
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [bgPhoto, setBgPhoto] = useState("");
  const [matchData, setMatchData] = useState({
    homeTeam: "Pulunga FC",
    awayTeam: "Opponent",
    homeScore: 0,
    awayScore: 0,
    id: "",
  });
  const [players, setPlayers] = useState([]);
  const [schedules, setSchedules] = useState([]);

  // Admin Controls States
  const [newHomeScore, setNewHomeScore] = useState("");
  const [newAwayScore, setNewAwayScore] = useState("");
  const [selectedScorer, setSelectedScorer] = useState("");
  const [selectedAssister, setSelectedAssister] = useState("");
  // Player Registration Fields
  const [pName, setPName] = useState("");
  const [pPos, setPPos] = useState("");
  const [pNum, setPNum] = useState("");
  const [pContact, setPContact] = useState("");
  const [pPhoto, setPPhoto] = useState("");

  // Training Schedule Fields
  const [sType, setSType] = useState("Training");
  const [sDate, setSDate] = useState("");
  const [sTime, setSTime] = useState("");

  // 4-Digit PIN Input Validator Mask
  const handlePinFilter = (value, setter) => {
    if (/^\d*$/.test(value) && value.length <= 4) {
      setter(value);
    }
  };
  useEffect(() => {
    // 1. Authorization Watcher enforcing the strict 3-admin rule
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const role = userDoc.exists() ? userDoc.data().role : "player";

        if (role === "admin") {
          const adminQuery = query(
            collection(db, "users"),
            where("role", "==", "admin")
          );
          const adminSnapshot = await getDocs(adminQuery);
          const adminIds = adminSnapshot.docs.map((d) => d.id);

          if (adminSnapshot.size > 3 && !adminIds.includes(currentUser.uid)) {
            setError(
              "Access Denied: The strict system limit of 3 Administrators has been reached."
            );
            signOut(auth);
            return;
          }
        }
        setUser(currentUser);
        setUserRole(role);
      } else {
        setUser(null);
        setUserRole(null);
      }
    });
    // 2. Wallpaper themes snapshot hook listener
    const unsubscribeTheme = onSnapshot(doc(db, "config", "theme"), (doc) => {
      if (doc.exists()) setBgPhoto(doc.data().bgPhoto);
    });

    // 3. Scoreboard listener hook
    const unsubscribeMatches = onSnapshot(collection(db, "matches"), (snap) => {
      if (snap.empty) {
        setMatchData({
          homeTeam: "Pulunga FC",
          awayTeam: "Opponent Team",
          homeScore: 0,
          awayScore: 0,
          id: "initial",
        });
      } else {
        snap.forEach((doc) => setMatchData({ id: doc.id, ...doc.data() }));
      }
    });

    // 4. Roster roster list listener hook
    const unsubscribePlayers = onSnapshot(collection(db, "players"), (snap) => {
      const pList = [];
      snap.forEach((doc) => pList.push({ id: doc.id, ...doc.data() }));
      setPlayers(pList);
    });

    // 5. Training grid log listener hook
    const unsubscribeSchedules = onSnapshot(
      collection(db, "schedules"),
      (snap) => {
        const sList = [];
        snap.forEach((doc) => sList.push({ id: doc.id, ...doc.data() }));
        setSchedules(sList);
      }
    );

    return () => {
      unsubscribeAuth();
      unsubscribeTheme();
      unsubscribeMatches();
      unsubscribePlayers();
      unsubscribeSchedules();
    };
  }, []);
  // MATHEMATICAL SORTING ENGINE
  const totalTrainings = schedules.filter((s) => s.type === "Training").length;
  const computedPlayers = players.map((p) => {
    const attended = schedules.filter(
      (s) => s.type === "Training" && s.attendedPlayers?.includes(p.name)
    ).length;
    const pct =
      totalTrainings > 0 ? Math.round((attended / totalTrainings) * 100) : 0;
    return { ...p, attendancePct: pct };
  });

  const sortedSquad = [...computedPlayers].sort(
    (a, b) => b.attendancePct - a.attendancePct
  );
  const startingEleven = sortedSquad.slice(0, 11);

  // Leaderboard Statistical Sorting Filters
  const topScorer = [...players].sort(
    (a, b) => (b.goals || 0) - (a.goals || 0)
  )[0];
  const topAssister = [...players].sort(
    (a, b) => (b.assists || 0) - (a.assists || 0)
  )[0];

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (passwordInput.length !== 4) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    const systemPassword = `${passwordInput}00`;
    try {
      await signInWithEmailAndPassword(auth, email, systemPassword);
    } catch {
      setError(
        "Invalid account email address or incorrect portal security PIN."
      );
    }
  };
  const handleUpdateMatchOutput = async (e) => {
    e.preventDefault();
    if (userRole !== "admin") return;
    if (matchData.id === "initial" || !matchData.id) {
      await addDoc(collection(db, "matches"), {
        homeTeam: "Pulunga FC",
        awayTeam: "Opponent Team",
        homeScore: Number(newHomeScore),
        awayScore: Number(newAwayScore),
      });
    } else {
      await updateDoc(doc(db, "matches", matchData.id), {
        homeScore: Number(newHomeScore),
        awayScore: Number(newAwayScore),
      });
    }
    if (selectedScorer) {
      const r = doc(db, "players", selectedScorer);
      const d = await getDoc(r);
      await updateDoc(r, { goals: (d.data().goals || 0) + 1 });
    }
    if (selectedAssister) {
      const r = doc(db, "players", selectedAssister);
      const d = await getDoc(r);
      await updateDoc(r, { assists: (d.data().assists || 0) + 1 });
    }
    setNewHomeScore("");
    setNewAwayScore("");
    setSelectedScorer("");
    setSelectedAssister("");
  };

  const handleSavePlayerProfile = async (e) => {
    e.preventDefault();
    if (userRole !== "admin") return;
    await addDoc(collection(db, "players"), {
      name: pName,
      position: pPos,
      jerseyNumber: Number(pNum),
      contact: pContact,
      photoUrl: pPhoto,
      goals: 0,
      assists: 0,
    });
    setPName("");
    setPPos("");
    setPNum("");
    setPContact("");
    setPPhoto("");
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (userRole !== "admin") return;
    await addDoc(collection(db, "schedules"), {
      type: sType,
      date: sDate,
      time: sTime,
      attendedPlayers: [],
    });
    setSType("Training");
    setSDate("");
    setSTime("");
  };

  const toggleAttendanceSheet = async (id, name) => {
    if (userRole !== "admin") return;
    const ref = doc(db, "schedules", id);
    const d = await getDoc(ref);
    let list = d.data().attendedPlayers || [];
    list = list.includes(name)
      ? list.filter((n) => n !== name)
      : [...list, name];
    await updateDoc(ref, { attendedPlayers: list });
  };

  const seedPulungaDatabase = async () => {
    if (userRole !== "admin") return alert("Admin Credentials Required");
    try {
      await addDoc(collection(db, "players"), {
        name: "Sample Player",
        position: "Midfielder",
        jerseyNumber: 8,
        goals: 2,
        assists: 4,
        contact: "0711",
        photoUrl: "",
      });
      alert("Database Sample Seeding Executed successfully!");
    } catch (err) {
      alert(err.message);
    }
  };
  if (!user) {
    return (
      <div className="min-h-screen bg-blue-900 flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm text-gray-800"
        >
          <h2 className="text-2xl font-black text-center text-blue-700 tracking-wide">
            PULUNGA FC
          </h2>
          <p className="text-center text-xs text-gray-400 mb-6 font-medium">
            Blue & White Hub Authentication
          </p>
          {error && (
            <p className="text-red-500 text-xs mb-4 text-center font-bold bg-red-50 p-2.5 rounded-xl border border-red-100">
              {error}
            </p>
          )}
          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-black bg-white"
              required
            />
            <input
              type="password"
              placeholder="4-Digit PIN"
              value={passwordInput}
              onChange={(e) =>
                handlePinFilter(e.target.value, setPasswordInput)
              }
              className="w-full border border-gray-300 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm tracking-widest text-center font-bold text-black bg-white"
              maxLength={4}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-xl mt-4 transition text-sm"
          >
            Enter Portal
          </button>
        </form>
      </div>
    );
  }
  return (
    <div
      className="min-h-screen text-white bg-blue-900 bg-cover bg-center flex flex-col font-sans"
      style={{ backgroundImage: bgPhoto ? `url(${bgPhoto})` : "none" }}
    >
      <header className="bg-blue-950 px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white font-black tracking-wider text-sm">
            PFC
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wide text-white">
              PULUNGA FC
            </h1>
            <p className="text-xs text-blue-300 font-medium capitalize">
              Portal Access: {userRole || "Player"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => signOut(auth)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl transition text-xs font-bold flex items-center gap-2"
          >
            <LogOut size={14} /> Exit Hub
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 space-y-6">
        <section className="bg-blue-950 border border-blue-800 rounded-3xl p-6 shadow-xl text-center">
          <span className="bg-red-600 text-white font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-widest inline-block mb-3 animate-pulse">
            Live Match Board
          </span>
          <div className="flex items-center justify-center gap-6 md:gap-12">
            <div className="flex-1 text-right">
              <h3 className="text-lg md:text-xl font-black truncate">
                {matchData.homeTeam}
              </h3>
              <p className="text-xs text-blue-300 font-medium">Home</p>
            </div>
            <div className="bg-blue-900 px-6 py-3 rounded-2xl border border-blue-800 flex items-center gap-4 shadow-inner">
              <span className="text-3xl font-black font-mono tracking-tight text-blue-400">
                {matchData.homeScore}
              </span>
              <span className="text-gray-500 font-bold text-sm">:</span>
              <span className="text-3xl font-black font-mono tracking-tight text-blue-400">
                {matchData.awayScore}
              </span>
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-lg md:text-xl font-black truncate">
                {matchData.awayTeam}
              </h3>
              <p className="text-xs text-blue-300 font-medium">Visitor</p>
            </div>
          </div>
        </section>

        <nav className="flex gap-2 bg-blue-950 p-1.5 rounded-2xl border border-blue-800 max-w-md">
          {["Home", "Roster", "Schedules"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-blue-300 hover:bg-blue-800 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
        <section className="bg-blue-950 border border-blue-800 rounded-3xl p-6 shadow-xl">
          {activeTab === "Home" && (
            <div className="space-y-6">
              <div className="border-b border-blue-800 pb-3">
                <h2 className="text-lg font-black tracking-wide text-white">
                  TEAM HUB BRIEFING
                </h2>
                <p className="text-xs text-blue-300">
                  Statistical summaries and active starting line-up guidelines.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-900 border border-blue-800 p-4 rounded-2xl flex items-center gap-4">
                  <div className="text-yellow-400 p-2 text-xl font-bold">
                    ⚽
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
                      Golden Boot Leader
                    </p>
                    <h4 className="text-base font-black text-white">
                      {topScorer
                        ? `${topScorer.name} (${topScorer.goals || 0} Goals)`
                        : "No entries registered"}
                    </h4>
                  </div>
                </div>
                <div className="bg-blue-900 border border-blue-800 p-4 rounded-2xl flex items-center gap-4">
                  <div className="text-emerald-400 p-2 text-xl font-bold">
                    👟
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
                      Playmaking Leader
                    </p>
                    <h4 className="text-base font-black text-white">
                      {topAssister
                        ? `${topAssister.name} (${
                            topAssister.assists || 0
                          } Assists)`
                        : "No entries registered"}
                    </h4>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900 border border-blue-800 p-4 rounded-2xl">
                <h3 className="text-xs font-black tracking-wider text-blue-300 uppercase mb-3">
                  🛡️ Calculated Starting Eleven (Attendance Merit)
                </h3>
                {startingEleven.length === 0 ? (
                  <p className="text-xs text-blue-400 font-medium py-2">
                    No players found in database records.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {startingEleven.map((p, idx) => (
                      <div
                        key={p.id}
                        className="bg-blue-950 border border-blue-800 p-3 rounded-xl text-center relative overflow-hidden"
                      >
                        <span className="absolute top-2 left-2 bg-blue-600 text-white font-mono text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div className="w-12 h-12 rounded-full bg-blue-800 mx-auto mb-2 border border-blue-700 overflow-hidden flex items-center justify-center text-xs font-bold text-blue-300">
                          {p.photoUrl ? (
                            <img
                              src={p.photoUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            p.position?.substring(0, 2)
                          )}
                        </div>
                        <h5 className="text-xs font-black truncate text-white">
                          {p.name}
                        </h5>
                        <p className="text-[10px] text-emerald-400 font-mono font-bold mt-1">
                          {p.attendancePct}% Attendance
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === "Roster" && (
            <div className="space-y-4">
              <div className="border-b border-blue-800 pb-3">
                <h2 className="text-lg font-black tracking-wide text-white">
                  CLUB ROSTER MANIFEST
                </h2>
                <p className="text-xs text-blue-300">
                  Active registrations, stats log metrics, and profile files.
                </p>
              </div>

              {/* ADMIN REGISTER NEW PLAYER COMPONENT FORM */}
              {userRole === "admin" && (
                <form
                  onSubmit={handleSavePlayerProfile}
                  className="bg-blue-900 border border-blue-800 p-4 rounded-2xl grid grid-cols-2 md:grid-cols-5 gap-2"
                >
                  <div className="col-span-2 md:col-span-5 border-b border-blue-800 pb-1 flex items-center gap-1.5 text-xs text-blue-300 font-black uppercase">
                    <Plus size={14} /> Add New Squad Registration
                  </div>
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    className="bg-blue-950 border border-gray-700 p-2 rounded-xl text-xs text-white"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Position (e.g. Forward)"
                    value={pPos}
                    onChange={(e) => setPPos(e.target.value)}
                    className="bg-blue-950 border border-gray-700 p-2 rounded-xl text-xs text-white"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Jersey #"
                    value={pNum}
                    onChange={(e) => setPNum(e.target.value)}
                    className="bg-blue-950 border border-gray-700 p-2 rounded-xl text-xs text-white"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Contact Details"
                    value={pContact}
                    onChange={(e) => setPContact(e.target.value)}
                    className="bg-blue-950 border border-gray-700 p-2 rounded-xl text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="col-span-2 md:col-span-1 bg-blue-600 hover:bg-blue-500 font-bold text-xs rounded-xl transition p-2"
                  >
                    Register Player
                  </button>
                </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-blue-800 text-blue-300 font-bold uppercase tracking-wider bg-blue-900">
                      <th className="p-3">Player</th>
                      <th className="p-3">Position</th>
                      <th className="p-3 text-center">Jersey</th>
                      <th className="p-3 text-center">Goals</th>
                      <th className="p-3 text-center">Assists</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-800">
                    {players.map((p) => (
                      <tr key={p.id} className="hover:bg-blue-900/50">
                        <td className="p-3 font-bold flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-blue-800 flex items-center justify-center font-bold text-[10px]">
                            {p.photoUrl ? (
                              <img
                                src={p.photoUrl}
                                alt=""
                                className="w-full h-full object-cover rounded-full"
                              />
                            ) : (
                              "#"
                            )}
                          </div>
                          {p.name}
                        </td>
                        <td className="p-3 font-medium text-blue-200">
                          {p.position || "Unassigned"}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-blue-400">
                          {p.jerseyNumber || "-"}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-yellow-400">
                          {p.goals || 0}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-emerald-400">
                          {p.assists || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === "Schedules" && (
            <div className="space-y-4">
              <div className="border-b border-blue-800 pb-3">
                <h2 className="text-lg font-black tracking-wide text-white">
                  TRAINING & MATCH GRID LOGS
                </h2>
                <p className="text-xs text-blue-300">
                  Session schedules, calendar events, and team track logs.
                </p>
              </div>

              {/* ADMIN LOG NEW TRACK SCHEDULE FORM */}
              {userRole === "admin" && (
                <form
                  onSubmit={handleSaveSchedule}
                  className="bg-blue-900 border border-blue-800 p-4 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-2"
                >
                  <div className="col-span-2 md:col-span-4 border-b border-blue-800 pb-1 flex items-center gap-1.5 text-xs text-blue-300 font-black uppercase">
                    <Plus size={14} /> Schedule New Activity Row
                  </div>
                  <select
                    value={sType}
                    onChange={(e) => setSType(e.target.value)}
                    className="bg-blue-950 border border-gray-700 p-2 rounded-xl text-xs text-white"
                  >
                    <option value="Training">Training Session</option>
                    <option value="Match Day">Match Day Event</option>
                  </select>
                  <input
                    type="date"
                    value={sDate}
                    onChange={(e) => setSDate(e.target.value)}
                    className="bg-blue-950 border border-gray-700 p-2 rounded-xl text-xs text-white"
                    required
                  />
                  <input
                    type="time"
                    value={sTime}
                    onChange={(e) => setSTime(e.target.value)}
                    className="bg-blue-950 border border-gray-700 p-2 rounded-xl text-xs text-white"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 font-bold text-xs rounded-xl transition p-2"
                  >
                    Post Session
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 gap-3">
                {schedules.map((s) => (
                  <div
                    key={s.id}
                    className="bg-blue-900 border border-blue-800 p-4 rounded-2xl flex flex-col space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="bg-blue-600 text-white font-mono text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                          {s.type || "Session"}
                        </span>
                        <h4 className="text-sm font-black text-white mt-1.5">
                          {s.date} @ {s.time}
                        </h4>
                      </div>
                    </div>
                    {userRole === "admin" && s.type === "Training" && (
                      <div className="border-t border-blue-800/60 pt-2">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-blue-300 mb-1.5">
                          Mark Squad Attendance Tracker:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {players.map((p) => {
                            const isAttended = s.attendedPlayers?.includes(
                              p.name
                            );
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() =>
                                  toggleAttendanceSheet(s.id, p.name)
                                }
                                className={`px-2 py-1 rounded-md text-[10px] font-bold border transition ${
                                  isAttended
                                    ? "bg-emerald-600 text-white border-emerald-500"
                                    : "bg-blue-950 text-blue-300 border-gray-700 hover:bg-blue-900"
                                }`}
                              >
                                {p.name} {isAttended ? "✓" : "✗"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {schedules.length === 0 && (
                  <p className="text-xs text-blue-400 font-medium py-4 text-center">
                    No schedules logged into database grid.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* SYSTEM ADMIN MANAGEMENT CONTROL ROOM */}
        {userRole === "admin" && (
          <section className="bg-blue-950 border border-red-900 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="border-b border-red-900 pb-2 flex items-center gap-2 text-red-400">
              <ShieldAlert size={18} />
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  System Admin Control Room
                </h3>
                <p className="text-[11px] text-red-300 font-medium">
                  Direct write permissions activated for scoreboard entries and
                  stats metrics tracking.
                </p>
              </div>
            </div>
            <form
              onSubmit={handleUpdateMatchOutput}
              className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-blue-900 p-4 rounded-2xl border border-red-900/30"
            >
              <input
                type="number"
                placeholder="New Home Score"
                value={newHomeScore}
                onChange={(e) => setNewHomeScore(e.target.value)}
                className="bg-blue-950 border border-gray-700 p-2.5 rounded-xl text-xs text-white"
              />
              <input
                type="number"
                placeholder="New Away Score"
                value={newAwayScore}
                onChange={(e) => setNewAwayScore(e.target.value)}
                className="bg-blue-950 border border-gray-700 p-2.5 rounded-xl text-xs text-white"
              />
              <select
                value={selectedScorer}
                onChange={(e) => setSelectedScorer(e.target.value)}
                className="bg-blue-950 border border-gray-700 p-2.5 rounded-xl text-xs text-white"
              >
                <option value="">-- Select Scorer --</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedAssister}
                onChange={(e) => setSelectedAssister(e.target.value)}
                className="bg-blue-950 border border-gray-700 p-2.5 rounded-xl text-xs text-white"
              >
                <option value="">-- Select Assister --</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="col-span-2 md:col-span-4 bg-red-700 hover:bg-red-600 text-white font-bold p-2.5 rounded-xl text-xs transition"
              >
                Submit Match Log & Stats Increment
              </button>
            </form>
            <div className="border-t border-red-900/30 pt-2 flex justify-end">
              <button
                type="button"
                onClick={seedPulungaDatabase}
                className="bg-indigo-700 hover:bg-indigo-600 text-white font-mono text-[10px] p-1.5 rounded-lg transition"
              >
                ⚙️ Initialize Mock Seed Collections
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
