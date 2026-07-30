import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

/* ============================================================
   SOLO LEVELING STATUS WINDOW — HABIT TRACKER
   ============================================================ */

// ---------- CONSTANTS ----------

const STAT_KEYS = ["STR", "VIT", "INT", "WIS", "AGI"];

const STAT_INFO = {
  STR: { label: "Strength", color: "#ff4d5e", desc: "Physical power & training" },
  VIT: { label: "Vitality", color: "#3ddc84", desc: "Health, rest & consistency" },
  INT: { label: "Intelligence", color: "#4da3ff", desc: "Study & academics" },
  WIS: { label: "Wisdom", color: "#c084fc", desc: "Reflection & self-growth" },
  AGI: { label: "Agility", color: "#facc15", desc: "Productivity & speed" },
};

const DEFAULT_CATEGORIES = [
  { id: "cat-workout", name: "Workout", stat: "STR" },
  { id: "cat-rest", name: "Rest & Health", stat: "VIT" },
  { id: "cat-study", name: "Belajar PPDS", stat: "INT" },
  { id: "cat-reading", name: "Baca Jurnal", stat: "WIS" },
  { id: "cat-productivity", name: "Task Harian", stat: "AGI" },
];

const RANKS = [
  { rank: "E", min: 1, max: 10, color: "#9ca3af", glow: "#d1d5db" },
  { rank: "D", min: 11, max: 20, color: "#4ade80", glow: "#86efac" },
  { rank: "C", min: 21, max: 35, color: "#4da3ff", glow: "#93c5fd" },
  { rank: "B", min: 36, max: 50, color: "#c084fc", glow: "#d8b4fe" },
  { rank: "A", min: 51, max: 70, color: "#fb923c", glow: "#fdba74" },
  { rank: "S", min: 71, max: Infinity, color: "#f43f5e", glow: "#fda4af" },
];

const TITLES = [
  {
    id: "rookie-hunter",
    name: "Rookie Hunter",
    desc: "Reach Level 1",
    check: (s) => s.level >= 1,
  },
  {
    id: "perfect-day",
    name: "Perfect Day",
    desc: "Complete every task scheduled in a single day",
    check: (s) => s.perfectDays >= 1,
  },
  {
    id: "iron-will",
    name: "Iron Will",
    desc: "7-day streak on any Workout (STR) category task",
    check: (s) => s.maxStreak.STR >= 7,
  },
  {
    id: "scholar",
    name: "Scholar",
    desc: "7-day streak on any study (INT) category task",
    check: (s) => s.maxStreak.INT >= 7,
  },
  {
    id: "sage",
    name: "Sage",
    desc: "7-day streak on any Wisdom (WIS) category task",
    check: (s) => s.maxStreak.WIS >= 7,
  },
  {
    id: "unbreakable",
    name: "Unbreakable",
    desc: "7-day streak on any Vitality (VIT) category task",
    check: (s) => s.maxStreak.VIT >= 7,
  },
  {
    id: "swift-blade",
    name: "Swift Blade",
    desc: "7-day streak on any Agility (AGI) category task",
    check: (s) => s.maxStreak.AGI >= 7,
  },
  {
    id: "shadow-monarch",
    name: "Shadow Monarch",
    desc: "Reach S-Rank",
    check: (s) => s.rank === "S",
  },
];

const SKILL_QUOTES = [
  "The weak will always live in fear of the strong. So become strong.",
  "I'll take it slow, but I will never stop moving forward.",
  "It's not that I don't feel fear. I've just learned to move forward despite it.",
  "Rise. That is your fate, your destiny.",
  "A hunter who stops leveling up is already dead.",
  "Small steps, repeated daily, are how monarchs are made.",
  "Discipline is the quiet version of ambition.",
  "Every quest completed is a scar that makes you sharper.",
  "The gate does not care if you're ready. Enter anyway.",
  "You don't need motivation. You need a system — and you already have one.",
  "Consistency is the real S-Rank skill.",
  "The strongest hunters were once E-Rank nobodies who refused to quit.",
];

const STAT_DECAY_DAYS = 3; // days of inactivity before a stat decays
const STAT_DECAY_AMOUNT = 1;

const STORAGE_KEY = "sl-tracker-data-v1";

// ---------- DATE HELPERS ----------

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function dateStrNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function daysBetween(dateStrA, dateStrB) {
  const a = new Date(dateStrA + "T00:00:00");
  const b = new Date(dateStrB + "T00:00:00");
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function isSameWeek(dateStr, refStr) {
  // ISO-ish: week starts Monday
  const d = new Date(dateStr + "T00:00:00");
  const ref = new Date(refStr + "T00:00:00");
  const getMonday = (date) => {
    const day = date.getDay() || 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };
  return getMonday(d).getTime() === getMonday(ref).getTime();
}

function isSameMonth(dateStr, refStr) {
  return dateStr.slice(0, 7) === refStr.slice(0, 7);
}

// ---------- LEVEL / EXP MATH ----------

// EXP CURVE — progressive/exponential, not linear.
// EXP needed to go from level L to L+1 = floor(100 * L^1.5)
// This means: Lv1->2 needs 100, Lv10->11 needs ~3162, Lv50->51 needs ~35355 —
// so high ranks (A/S) genuinely take far longer to reach than low ranks.
// NOTE: this replaces the old linear formula (level * 100). If you already
// have saved progress from the linear version, your derived level may shift
// downward the first time you open the app after this update, because the
// same totalExp now buys fewer levels under the steeper curve. currentExp/
// neededExp are always re-derived from totalExp, so nothing is lost — the
// number just gets reinterpreted under the new curve.
function expForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

function levelFromTotalExp(totalExp) {
  let level = 1;
  let remaining = totalExp;
  while (remaining >= expForLevel(level)) {
    remaining -= expForLevel(level);
    level += 1;
  }
  return { level, currentExp: remaining, neededExp: expForLevel(level) };
}

function rankFromLevel(level) {
  return RANKS.find((r) => level >= r.min && level <= r.max) || RANKS[0];
}

// ---------- DEFAULT STATE ----------

function defaultTasks() {
  return [
    { id: "task-1", name: "Push-up / Lari 20 menit", categoryId: "cat-workout", exp: 15 },
    { id: "task-2", name: "Tidur cukup 7-8 jam", categoryId: "cat-rest", exp: 10 },
    { id: "task-3", name: "Belajar materi PPDS 1 jam", categoryId: "cat-study", exp: 20 },
    { id: "task-4", name: "Baca 1 jurnal ilmiah", categoryId: "cat-reading", exp: 15 },
    { id: "task-5", name: "Selesaikan to-do list harian", categoryId: "cat-productivity", exp: 10 },
  ];
}

function initialState() {
  const today = todayStr();
  const stats = { STR: 0, VIT: 0, INT: 0, WIS: 0, AGI: 0 };
  const streaks = {};
  STAT_KEYS.forEach((k) => (streaks[k] = { current: 0, max: 0, lastDate: null }));
  const lastTrained = {};
  STAT_KEYS.forEach((k) => (lastTrained[k] = null));

  return {
    name: "Hunter",
    categories: DEFAULT_CATEGORIES,
    tasks: defaultTasks(),
    completions: {}, // { [date]: [taskId,...] }
    totalExp: 0,
    stats,
    streaks, // per stat: consecutive days with >=1 completed task of that stat
    lastTrained, // per stat: last date a task of that stat was completed
    unlockedTitles: [],
    activeTitle: null,
    unlockedSkillLevels: [], // which multiples of 5 already granted a skill
    skills: [], // { level, quote }
    perfectDays: 0,
    perfectDaysLog: [],
    lastOpenedDate: today,
    penaltyLog: [], // { date, stat, amount }
    history: [], // { date, expGained, tasksCompleted }
    penaltyZoneActive: false, // true when yesterday had zero completed tasks
    penaltyZoneTriggeredDate: null, // date the zone was triggered, for display
    penaltyZoneClearCount: 0, // how many times the Hunter has cleared a Penalty Zone
  };
}

// ---------- MIGRATION / DECAY ENGINE ----------
// Applies stat decay for every stat not trained in STAT_DECAY_DAYS+ days,
// walking day by day from lastOpenedDate to today so multi-day gaps are handled correctly.

function applyDecayAndDailyReset(state) {
  const today = todayStr();
  let next = { ...state, streaks: { ...state.streaks }, stats: { ...state.stats } };
  STAT_KEYS.forEach((k) => (next.streaks[k] = { ...state.streaks[k] }));

  if (state.lastOpenedDate === today) {
    return next; // nothing to do, same day
  }

  const gap = daysBetween(state.lastOpenedDate, today);
  const newPenalties = [...state.penaltyLog];

  STAT_KEYS.forEach((stat) => {
    const lastDate = state.lastTrained[stat];
    // If never trained, no decay (nothing to decay from)
    if (!lastDate) return;

    const daysSinceTrained = daysBetween(lastDate, today);
    if (daysSinceTrained >= STAT_DECAY_DAYS) {
      // Decay once per full STAT_DECAY_DAYS block missed, but cap to avoid runaway negative spirals
      const decayBlocks = Math.floor(daysSinceTrained / STAT_DECAY_DAYS);
      const alreadyDecayedBlocks = Math.floor(
        (daysBetween(lastDate, state.lastOpenedDate) >= 0
          ? daysBetween(lastDate, state.lastOpenedDate)
          : 0) / STAT_DECAY_DAYS
      );
      const newBlocks = Math.max(0, decayBlocks - alreadyDecayedBlocks);
      if (newBlocks > 0) {
        const amount = newBlocks * STAT_DECAY_AMOUNT;
        next.stats[stat] = Math.max(0, next.stats[stat] - amount);
        newPenalties.push({ date: today, stat, amount });
      }
    }

    // Reset streak if the gap since last trained exceeds 1 day (streak broken)
    if (daysSinceTrained > 1) {
      next.streaks[stat] = { ...next.streaks[stat], current: 0 };
    }
  });

  next.penaltyLog = newPenalties.slice(-50); // keep log bounded
  next.lastOpenedDate = today;

  // ---- PENALTY ZONE TRIGGER ----
  // If the most recent previous day (state.lastOpenedDate, before we advanced it)
  // had zero tasks completed, the Hunter enters Penalty Zone: Daily Quest is
  // locked until they confirm the emergency Push-up 50x task.
  // Only checks the immediately preceding calendar day — if the gap spans
  // multiple days (app not opened for a while), we check the day right before
  // today, since that's the most recent "day that just ended".
  const yesterdayStr = dateStrNDaysAgo(1);
  const yesterdayCompletions = state.completions[yesterdayStr] || [];
  // Guard: only trigger if the account actually existed yesterday (has at least
  // one task defined) — otherwise a brand-new user would be punished on day 1.
  const hadTasksYesterday = state.tasks.length > 0 && gap >= 1;
  if (hadTasksYesterday && yesterdayCompletions.length === 0) {
    next.penaltyZoneActive = true;
    next.penaltyZoneTriggeredDate = today;
  }

  return next;
}

// ---------- MAIN COMPONENT ----------

export default function SoloLevelingTracker() {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return applyDecayAndDailyReset({ ...initialState(), ...parsed });
      }
    } catch (e) {
      console.error("Failed to load saved data", e);
    }
    return initialState();
  });

  const [activeTab, setActiveTab] = useState("quests");
  const [levelUpQueue, setLevelUpQueue] = useState([]);
  const [rankUpQueue, setRankUpQueue] = useState([]);
  const [newTitleQueue, setNewTitleQueue] = useState([]);
  const [newSkillQueue, setNewSkillQueue] = useState([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [expPulse, setExpPulse] = useState(false);
  const [toast, setToast] = useState(null);
  const prevLevelRef = useRef(null);

  // Persist to localStorage on every state change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save data", e);
    }
  }, [state]);

  const { level, currentExp, neededExp } = useMemo(
    () => levelFromTotalExp(state.totalExp),
    [state.totalExp]
  );
  const rankInfo = useMemo(() => rankFromLevel(level), [level]);

  const todaysCompletions = state.completions[todayStr()] || [];

  // Reminder check: if it's evening and daily quests are incomplete
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 20) {
      const dailyTasks = state.tasks;
      const incomplete = dailyTasks.filter((t) => !todaysCompletions.includes(t.id));
      if (incomplete.length > 0 && !sessionStorage.getItem("sl-reminder-shown")) {
        setToast({
          type: "reminder",
          message: `Malam sudah datang, Hunter. ${incomplete.length} Daily Quest belum selesai. Gerbang tidak menunggu.`,
        });
        sessionStorage.setItem("sl-reminder-shown", "1");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- CORE ACTIONS ----------

  const completeTask = useCallback(
    (task) => {
      const today = todayStr();
      setState((prev) => {
        const todaysDone = prev.completions[today] || [];
        if (todaysDone.includes(task.id)) return prev; // already completed, guard against double-count

        const category = prev.categories.find((c) => c.id === task.categoryId);
        const stat = category ? category.stat : null;

        const newTotalExp = prev.totalExp + task.exp;
        const newStats = { ...prev.stats };
        const newStreaks = { ...prev.streaks };
        const newLastTrained = { ...prev.lastTrained };

        if (stat) {
          newStats[stat] = (newStats[stat] || 0) + 1;

          const prevStreak = prev.streaks[stat] || { current: 0, max: 0, lastDate: null };
          let current = prevStreak.current;
          if (prevStreak.lastDate === dateStrNDaysAgo(1)) {
            current = prevStreak.current + 1;
          } else if (prevStreak.lastDate === today) {
            current = prevStreak.current; // already counted today
          } else {
            current = 1;
          }
          newStreaks[stat] = {
            current,
            max: Math.max(prevStreak.max, current),
            lastDate: today,
          };
          newLastTrained[stat] = today;
        }

        const newCompletions = {
          ...prev.completions,
          [today]: [...todaysDone, task.id],
        };

        // Perfect day check
        const allTaskIds = prev.tasks.map((t) => t.id);
        const doneAfter = [...todaysDone, task.id];
        const isPerfectNow = allTaskIds.every((id) => doneAfter.includes(id));
        const alreadyLoggedPerfect = prev.perfectDaysLog.includes(today);
        const newPerfectDays =
          isPerfectNow && !alreadyLoggedPerfect ? prev.perfectDays + 1 : prev.perfectDays;
        const newPerfectDaysLog =
          isPerfectNow && !alreadyLoggedPerfect
            ? [...prev.perfectDaysLog, today]
            : prev.perfectDaysLog;

        const newHistory = [...prev.history];
        const histIdx = newHistory.findIndex((h) => h.date === today);
        if (histIdx >= 0) {
          newHistory[histIdx] = {
            ...newHistory[histIdx],
            expGained: newHistory[histIdx].expGained + task.exp,
            tasksCompleted: newHistory[histIdx].tasksCompleted + 1,
          };
        } else {
          newHistory.push({ date: today, expGained: task.exp, tasksCompleted: 1 });
        }

        return {
          ...prev,
          totalExp: newTotalExp,
          stats: newStats,
          streaks: newStreaks,
          lastTrained: newLastTrained,
          completions: newCompletions,
          perfectDays: newPerfectDays,
          perfectDaysLog: newPerfectDaysLog,
          history: newHistory.slice(-90),
        };
      });
      setExpPulse(true);
      setTimeout(() => setExpPulse(false), 700);
    },
    []
  );

  const uncompleteTask = useCallback((task) => {
    const today = todayStr();
    setState((prev) => {
      const todaysDone = prev.completions[today] || [];
      if (!todaysDone.includes(task.id)) return prev;

      const category = prev.categories.find((c) => c.id === task.categoryId);
      const stat = category ? category.stat : null;

      const newStats = { ...prev.stats };
      if (stat) newStats[stat] = Math.max(0, (newStats[stat] || 0) - 1);

      const remainingDone = todaysDone.filter((id) => id !== task.id);

      // If this was the last completed task for this stat today, roll back
      // today's streak/lastTrained progress for that stat so it doesn't
      // falsely register as "trained today".
      const newStreaks = { ...prev.streaks };
      const newLastTrained = { ...prev.lastTrained };
      if (stat) {
        const otherTaskStillDoneForStat = remainingDone.some((id) => {
          const t = prev.tasks.find((tk) => tk.id === id);
          const c = t ? prev.categories.find((cc) => cc.id === t.categoryId) : null;
          return c && c.stat === stat;
        });
        if (!otherTaskStillDoneForStat) {
          const prevStreak = prev.streaks[stat] || { current: 0, max: 0, lastDate: null };
          if (prevStreak.lastDate === today) {
            const rolledBackCurrent = Math.max(0, prevStreak.current - 1);
            newStreaks[stat] = {
              current: rolledBackCurrent,
              max: prevStreak.max, // max achieved stays; only today's increment reverts
              lastDate: rolledBackCurrent > 0 ? dateStrNDaysAgo(1) : null,
            };
            newLastTrained[stat] = rolledBackCurrent > 0 ? dateStrNDaysAgo(1) : null;
          }
        }
      }

      const newHistory = [...prev.history];
      const histIdx = newHistory.findIndex((h) => h.date === today);
      if (histIdx >= 0) {
        newHistory[histIdx] = {
          ...newHistory[histIdx],
          expGained: Math.max(0, newHistory[histIdx].expGained - task.exp),
          tasksCompleted: Math.max(0, newHistory[histIdx].tasksCompleted - 1),
        };
      }

      // Perfect-day log should be revoked if it was granted today and is no longer valid
      const wasPerfectToday = prev.perfectDaysLog.includes(today);
      const stillPerfect =
        wasPerfectToday && prev.tasks.every((t) => remainingDone.includes(t.id));
      const newPerfectDaysLog =
        wasPerfectToday && !stillPerfect
          ? prev.perfectDaysLog.filter((d) => d !== today)
          : prev.perfectDaysLog;
      const newPerfectDays =
        wasPerfectToday && !stillPerfect ? Math.max(0, prev.perfectDays - 1) : prev.perfectDays;

      return {
        ...prev,
        totalExp: Math.max(0, prev.totalExp - task.exp),
        stats: newStats,
        streaks: newStreaks,
        lastTrained: newLastTrained,
        completions: {
          ...prev.completions,
          [today]: remainingDone,
        },
        history: newHistory,
        perfectDaysLog: newPerfectDaysLog,
        perfectDays: newPerfectDays,
      };
    });
  }, []);

  const addTask = useCallback((name, categoryId, exp) => {
    setState((prev) => ({
      ...prev,
      tasks: [
        ...prev.tasks,
        { id: `task-${Date.now()}`, name, categoryId, exp: Math.max(1, exp) },
      ],
    }));
  }, []);

  const deleteTask = useCallback((taskId) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
  }, []);

  const addCategory = useCallback((name, stat) => {
    setState((prev) => ({
      ...prev,
      categories: [
        ...prev.categories,
        { id: `cat-${Date.now()}`, name, stat },
      ],
    }));
  }, []);

  const resetProgress = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(initialState());
    setShowResetConfirm(false);
  }, []);

  const clearPenaltyZone = useCallback(() => {
    setState((prev) => ({
      ...prev,
      penaltyZoneActive: false,
      penaltyZoneTriggeredDate: null,
      penaltyZoneClearCount: prev.penaltyZoneClearCount + 1,
    }));
    setToast({
      type: "penalty-cleared",
      message: "Push-up 50x selesai. Penalty Zone dibuka — Daily Quest kembali aktif.",
    });
  }, []);

  // ---------- EXPORT / IMPORT ----------

  const importInputRef = useRef(null);

  const handleExportData = useCallback(() => {
    try {
      const payload = {
        __app: "solo-leveling-tracker",
        __version: 1,
        exportedAt: new Date().toISOString(),
        data: state,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `solo-leveling-backup-${todayStr()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToast({ type: "export-success", message: "Data berhasil diekspor ke file .json." });
    } catch (e) {
      console.error("Export failed", e);
      setToast({ type: "export-fail", message: "Gagal mengekspor data. Coba lagi." });
    }
  }, [state]);

  const handleImportClick = useCallback(() => {
    if (importInputRef.current) importInputRef.current.click();
  }, []);

  const handleImportFileChange = useCallback((e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const incoming = parsed && parsed.data ? parsed.data : parsed;
        // Basic shape validation so we don't load garbage into the app
        if (
          !incoming ||
          typeof incoming !== "object" ||
          typeof incoming.totalExp !== "number" ||
          !incoming.stats ||
          !Array.isArray(incoming.tasks) ||
          !Array.isArray(incoming.categories)
        ) {
          throw new Error("Invalid file structure");
        }
        // Merge onto a fresh default so any fields missing from an older
        // export (e.g. from before Penalty Zone existed) are backfilled
        // instead of crashing the app.
        const merged = applyDecayAndDailyReset({ ...initialState(), ...incoming });
        setState(merged);
        setToast({ type: "import-success", message: "Data berhasil diimpor. Progress kamu telah dipulihkan." });
      } catch (err) {
        console.error("Import failed", err);
        setToast({
          type: "import-fail",
          message: "File tidak valid atau rusak. Pastikan kamu mengimpor file export dari aplikasi ini.",
        });
      } finally {
        e.target.value = ""; // allow re-selecting the same file later
      }
    };
    reader.onerror = () => {
      setToast({ type: "import-fail", message: "Gagal membaca file." });
    };
    reader.readAsText(file);
  }, []);

  // ---------- WATCH FOR LEVEL UP / RANK UP / TITLES / SKILLS ----------

  useEffect(() => {
    if (prevLevelRef.current === null) {
      prevLevelRef.current = level;
      return;
    }
    if (level > prevLevelRef.current) {
      const gained = [];
      for (let l = prevLevelRef.current + 1; l <= level; l++) gained.push(l);
      setLevelUpQueue((q) => [...q, ...gained]);

      const prevRank = rankFromLevel(prevLevelRef.current);
      const nowRank = rankFromLevel(level);
      if (prevRank.rank !== nowRank.rank) {
        setRankUpQueue((q) => [...q, nowRank.rank]);
      }

      // Skill unlock every 5 levels
      const newSkillLevels = gained.filter((l) => l % 5 === 0);
      if (newSkillLevels.length > 0) {
        setState((prev) => {
          const toAdd = newSkillLevels.filter(
            (l) => !prev.unlockedSkillLevels.includes(l)
          );
          if (toAdd.length === 0) return prev;
          const newSkills = toAdd.map((l) => ({
            level: l,
            quote: SKILL_QUOTES[Math.floor(Math.random() * SKILL_QUOTES.length)],
          }));
          setNewSkillQueue((q) => [...q, ...newSkills]);
          return {
            ...prev,
            unlockedSkillLevels: [...prev.unlockedSkillLevels, ...toAdd],
            skills: [...prev.skills, ...newSkills],
          };
        });
      }
    }
    prevLevelRef.current = level;
  }, [level]);

  // Title check — runs whenever relevant stats change
  useEffect(() => {
    const maxStreak = {};
    STAT_KEYS.forEach((k) => (maxStreak[k] = state.streaks[k]?.max || 0));
    const titleState = {
      level,
      rank: rankInfo.rank,
      perfectDays: state.perfectDays,
      maxStreak,
    };
    const newlyUnlocked = TITLES.filter(
      (t) => !state.unlockedTitles.includes(t.id) && t.check(titleState)
    );
    if (newlyUnlocked.length > 0) {
      setState((prev) => ({
        ...prev,
        unlockedTitles: [...prev.unlockedTitles, ...newlyUnlocked.map((t) => t.id)],
        activeTitle: prev.activeTitle || newlyUnlocked[0].id,
      }));
      setNewTitleQueue((q) => [...q, ...newlyUnlocked]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, rankInfo.rank, state.perfectDays, JSON.stringify(state.streaks)]);

  // ---------- DERIVED: WEEKLY / MONTHLY SUMMARY ----------

  const weeklySummary = useMemo(() => {
    const today = todayStr();
    const entries = state.history.filter((h) => isSameWeek(h.date, today));
    const totalExp = entries.reduce((sum, h) => sum + h.expGained, 0);
    const totalTasks = entries.reduce((sum, h) => sum + h.tasksCompleted, 0);
    const activeDays = entries.length;
    return { totalExp, totalTasks, activeDays };
  }, [state.history]);

  const monthlySummary = useMemo(() => {
    const today = todayStr();
    const entries = state.history.filter((h) => isSameMonth(h.date, today));
    const totalExp = entries.reduce((sum, h) => sum + h.expGained, 0);
    const totalTasks = entries.reduce((sum, h) => sum + h.tasksCompleted, 0);
    const activeDays = entries.length;
    return { totalExp, totalTasks, activeDays };
  }, [state.history]);

  // ---------- RENDER ----------

  return (
    <div className="sl-root">
      <StyleBlock />
      <BackgroundFX />

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {levelUpQueue.length > 0 && (
        <LevelUpOverlay
          levels={levelUpQueue}
          onDone={() => setLevelUpQueue([])}
        />
      )}
      {levelUpQueue.length === 0 && rankUpQueue.length > 0 && (
        <RankUpOverlay
          ranks={rankUpQueue}
          onDone={() => setRankUpQueue([])}
        />
      )}
      {levelUpQueue.length === 0 && rankUpQueue.length === 0 && newTitleQueue.length > 0 && (
        <TitleUnlockOverlay
          titles={newTitleQueue}
          onDone={() => setNewTitleQueue([])}
        />
      )}
      {levelUpQueue.length === 0 &&
        rankUpQueue.length === 0 &&
        newTitleQueue.length === 0 &&
        newSkillQueue.length > 0 && (
          <SkillUnlockOverlay
            skills={newSkillQueue}
            onDone={() => setNewSkillQueue([])}
          />
        )}

      {levelUpQueue.length === 0 &&
        rankUpQueue.length === 0 &&
        newTitleQueue.length === 0 &&
        newSkillQueue.length === 0 &&
        state.penaltyZoneActive && (
          <PenaltyZoneOverlay onClear={clearPenaltyZone} />
        )}

      <div className="sl-container">
        <HeaderPanel
          state={state}
          level={level}
          currentExp={currentExp}
          neededExp={neededExp}
          rankInfo={rankInfo}
          expPulse={expPulse}
        />

        <RadarStatChart stats={state.stats} penaltyLog={state.penaltyLog} lastTrained={state.lastTrained} />

        <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />

        {activeTab === "quests" && (
          state.penaltyZoneActive ? (
            <div className="sl-panel sl-quest-locked">
              <div className="sl-panel-title">DAILY QUEST — TERKUNCI</div>
              <div className="sl-empty-state">
                🔒 Daily Quest terkunci karena kamu berada di Penalty Zone.
                Selesaikan tugas darurat di atas untuk membukanya kembali.
              </div>
            </div>
          ) : (
            <QuestPanel
              tasks={state.tasks}
              categories={state.categories}
              todaysCompletions={todaysCompletions}
              onComplete={completeTask}
              onUncomplete={uncompleteTask}
              onDeleteTask={deleteTask}
              onAddTaskClick={() => setShowAddTask(true)}
              onAddCategoryClick={() => setShowAddCategory(true)}
              streaks={state.streaks}
            />
          )
        )}

        {activeTab === "titles" && (
          <TitlesPanel
            unlockedTitles={state.unlockedTitles}
            activeTitle={state.activeTitle}
            onSetActive={(id) => setState((p) => ({ ...p, activeTitle: id }))}
          />
        )}

        {activeTab === "skills" && <SkillsPanel skills={state.skills} />}

        {activeTab === "summary" && (
          <SummaryPanel
            weekly={weeklySummary}
            monthly={monthlySummary}
            history={state.history}
            penaltyLog={state.penaltyLog}
          />
        )}

        <div className="sl-footer">
          <div className="sl-footer-row">
            <button className="sl-secondary-btn" onClick={handleExportData}>
              ⬇ Export Data (.json)
            </button>
            <button className="sl-secondary-btn" onClick={handleImportClick}>
              ⬆ Import Data (.json)
            </button>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={handleImportFileChange}
          />
          <button className="sl-danger-btn" onClick={() => setShowResetConfirm(true)}>
            Reset Progress
          </button>
        </div>
      </div>

      {showAddTask && (
        <AddTaskModal
          categories={state.categories}
          onClose={() => setShowAddTask(false)}
          onSubmit={(name, categoryId, exp) => {
            addTask(name, categoryId, exp);
            setShowAddTask(false);
          }}
        />
      )}

      {showAddCategory && (
        <AddCategoryModal
          onClose={() => setShowAddCategory(false)}
          onSubmit={(name, stat) => {
            addCategory(name, stat);
            setShowAddCategory(false);
          }}
        />
      )}

      {showResetConfirm && (
        <ConfirmModal
          title="Reset semua progress?"
          message="Semua Level, EXP, Stat, Title, dan Skill akan hilang permanen. Aksi ini tidak bisa dibatalkan."
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={resetProgress}
        />
      )}
    </div>
  );
}

/* ============================================================
   SUB-COMPONENTS
   ============================================================ */

function BackgroundFX() {
  return (
    <div className="sl-bgfx" aria-hidden="true">
      <div className="sl-bgfx-grid" />
      <div className="sl-bgfx-glow sl-bgfx-glow-1" />
      <div className="sl-bgfx-glow sl-bgfx-glow-2" />
    </div>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="sl-toast">
      <div className="sl-toast-icon">!</div>
      <div className="sl-toast-msg">{toast.message}</div>
      <button className="sl-toast-close" onClick={onClose}>×</button>
    </div>
  );
}

function HeaderPanel({ state, level, currentExp, neededExp, rankInfo, expPulse }) {
  const activeTitleObj = TITLES.find((t) => t.id === state.activeTitle);
  const pct = Math.min(100, (currentExp / neededExp) * 100);

  return (
    <div className="sl-panel sl-header-panel">
      <div className="sl-header-top">
        <div className="sl-rank-badge" style={{ "--rank-color": rankInfo.color, "--rank-glow": rankInfo.glow }}>
          <span className="sl-rank-letter">{rankInfo.rank}</span>
          <span className="sl-rank-label">RANK</span>
        </div>
        <div className="sl-header-identity">
          <div className="sl-player-name">{state.name}</div>
          {activeTitleObj && (
            <div className="sl-active-title">« {activeTitleObj.name} »</div>
          )}
        </div>
        <div className="sl-level-badge">
          <span className="sl-level-num">Lv. {level}</span>
        </div>
      </div>

      <div className="sl-exp-row">
        <div className="sl-exp-label">
          <span>EXP</span>
          <span>
            {currentExp} / {neededExp}
          </span>
        </div>
        <div className="sl-exp-bar-track">
          <div
            className={`sl-exp-bar-fill ${expPulse ? "sl-exp-pulse" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function RadarStatChart({ stats, penaltyLog, lastTrained }) {
  const today = todayStr();
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.36;
  const n = STAT_KEYS.length;

  // Auto-scaling max: at least 20 so early-game stats aren't visually maxed out,
  // otherwise the highest current stat rounded up to the next multiple of 10.
  const highestStat = Math.max(...STAT_KEYS.map((k) => stats[k] || 0), 0);
  const maxValue = Math.max(20, Math.ceil((highestStat + 1) / 10) * 10);

  function pointFor(index, ratio) {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = ratio * maxRadius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  // Grid rings at 25/50/75/100%
  const ringRatios = [0.25, 0.5, 0.75, 1];
  const ringPolygons = ringRatios.map((ratio) =>
    STAT_KEYS.map((_, i) => pointFor(i, ratio))
  );

  // Spoke lines from center to each outer vertex
  const spokes = STAT_KEYS.map((_, i) => pointFor(i, 1));

  // Data polygon based on actual stat values
  const dataPoints = STAT_KEYS.map((key, i) => {
    const value = stats[key] || 0;
    const ratio = Math.min(1, value / maxValue);
    return pointFor(i, ratio);
  });
  const dataPolygonStr = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Label positions, pushed slightly outside the outer ring
  const labelPoints = STAT_KEYS.map((_, i) => pointFor(i, 1.22));

  return (
    <div className="sl-panel">
      <div className="sl-panel-title">STATUS — RADAR</div>
      <div className="sl-radar-wrap">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="sl-radar-svg"
          role="img"
          aria-label="Radar chart of STR, VIT, INT, WIS, AGI stats"
        >
          {/* background grid rings */}
          {ringPolygons.map((poly, i) => (
            <polygon
              key={`ring-${i}`}
              points={poly.map((p) => `${p.x},${p.y}`).join(" ")}
              className="sl-radar-ring"
            />
          ))}

          {/* spokes from center to each vertex */}
          {spokes.map((p, i) => (
            <line
              key={`spoke-${i}`}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              className="sl-radar-spoke"
            />
          ))}

          {/* data polygon fill + stroke */}
          <polygon points={dataPolygonStr} className="sl-radar-data-fill" />
          <polygon points={dataPolygonStr} className="sl-radar-data-stroke" />

          {/* vertex dots on the data polygon */}
          {dataPoints.map((p, i) => (
            <circle
              key={`dot-${i}`}
              cx={p.x}
              cy={p.y}
              r={4}
              className="sl-radar-dot"
              style={{ fill: STAT_INFO[STAT_KEYS[i]].color }}
            />
          ))}

          {/* stat labels around the outside */}
          {labelPoints.map((p, i) => {
            const key = STAT_KEYS[i];
            return (
              <text
                key={`label-${i}`}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="sl-radar-label"
                style={{ fill: STAT_INFO[key].color }}
              >
                {key}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="sl-stat-detail-list">
        {STAT_KEYS.map((key) => {
          const info = STAT_INFO[key];
          const value = stats[key] || 0;
          const last = lastTrained[key];
          const daysSince = last ? daysBetween(last, today) : null;
          const atRisk = daysSince !== null && daysSince >= STAT_DECAY_DAYS - 1;
          const recentPenalty = penaltyLog.some(
            (p) => p.stat === key && p.date === today
          );
          return (
            <div className="sl-stat-detail-row" key={key} style={{ "--stat-color": info.color }}>
              <span className="sl-stat-detail-key">{key}</span>
              <span className="sl-stat-detail-label">{info.label}</span>
              <span className="sl-stat-detail-value">{value}</span>
              {recentPenalty && <span className="sl-stat-penalty-tag">⚠ turun</span>}
              {!recentPenalty && atRisk && (
                <span className="sl-stat-warning-tag">⏳ {daysSince}d</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabBar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "quests", label: "Daily Quests" },
    { id: "titles", label: "Titles" },
    { id: "skills", label: "Skills" },
    { id: "summary", label: "Summary" },
  ];
  return (
    <div className="sl-tabbar">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`sl-tab-btn ${activeTab === t.id ? "sl-tab-active" : ""}`}
          onClick={() => setActiveTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function QuestPanel({
  tasks,
  categories,
  todaysCompletions,
  onComplete,
  onUncomplete,
  onDeleteTask,
  onAddTaskClick,
  onAddCategoryClick,
  streaks,
}) {
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const completedCount = tasks.filter((t) => todaysCompletions.includes(t.id)).length;

  return (
    <div className="sl-panel">
      <div className="sl-panel-title-row">
        <div className="sl-panel-title">DAILY QUEST — {todayStr()}</div>
        <div className="sl-quest-progress">
          {completedCount}/{tasks.length}
        </div>
      </div>

      <div className="sl-quest-list">
        {tasks.length === 0 && (
          <div className="sl-empty-state">
            Belum ada quest. Tambahkan task pertamamu untuk mulai naik level.
          </div>
        )}
        {tasks.map((task) => {
          const cat = categoryMap[task.categoryId];
          const done = todaysCompletions.includes(task.id);
          const statColor = cat ? STAT_INFO[cat.stat]?.color : "#888";
          const streak = cat ? streaks[cat.stat]?.current || 0 : 0;
          return (
            <div className={`sl-quest-row ${done ? "sl-quest-done" : ""}`} key={task.id}>
              <button
                className="sl-quest-check"
                style={{ "--stat-color": statColor }}
                onClick={() => (done ? onUncomplete(task) : onComplete(task))}
                aria-label={done ? "Batalkan task" : "Selesaikan task"}
              >
                {done ? "✓" : ""}
              </button>
              <div className="sl-quest-info">
                <div className="sl-quest-name">{task.name}</div>
                <div className="sl-quest-meta">
                  <span className="sl-quest-cat" style={{ "--stat-color": statColor }}>
                    {cat ? cat.name : "Uncategorized"}
                  </span>
                  <span className="sl-quest-exp">+{task.exp} EXP</span>
                  {cat && streak > 1 && (
                    <span className="sl-quest-streak">🔥 {streak}d</span>
                  )}
                </div>
              </div>
              <button className="sl-quest-delete" onClick={() => onDeleteTask(task.id)} aria-label="Hapus task">
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="sl-quest-actions">
        <button className="sl-primary-btn" onClick={onAddTaskClick}>
          + Tambah Task
        </button>
        <button className="sl-secondary-btn" onClick={onAddCategoryClick}>
          + Tambah Kategori
        </button>
      </div>
    </div>
  );
}

function TitlesPanel({ unlockedTitles, activeTitle, onSetActive }) {
  return (
    <div className="sl-panel">
      <div className="sl-panel-title">TITLES</div>
      <div className="sl-title-list">
        {TITLES.map((t) => {
          const unlocked = unlockedTitles.includes(t.id);
          return (
            <div
              className={`sl-title-card ${unlocked ? "sl-title-unlocked" : "sl-title-locked"} ${
                activeTitle === t.id ? "sl-title-active" : ""
              }`}
              key={t.id}
              onClick={() => unlocked && onSetActive(t.id)}
            >
              <div className="sl-title-name">{unlocked ? t.name : "???"}</div>
              <div className="sl-title-desc">{t.desc}</div>
              {unlocked && activeTitle === t.id && (
                <div className="sl-title-badge">ACTIVE</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SkillsPanel({ skills }) {
  return (
    <div className="sl-panel">
      <div className="sl-panel-title">SKILLS UNLOCKED</div>
      {skills.length === 0 && (
        <div className="sl-empty-state">
          Capai Level 5, 10, 15... untuk membuka Skill Slot baru.
        </div>
      )}
      <div className="sl-skill-grid">
        {skills
          .slice()
          .sort((a, b) => a.level - b.level)
          .map((s, i) => (
            <div className="sl-skill-card" key={i}>
              <div className="sl-skill-icon">◆</div>
              <div className="sl-skill-level">Skill Slot — Lv.{s.level}</div>
              <div className="sl-skill-quote">"{s.quote}"</div>
            </div>
          ))}
      </div>
    </div>
  );
}

function SummaryPanel({ weekly, monthly, history, penaltyLog }) {
  return (
    <div className="sl-panel">
      <div className="sl-panel-title">SUMMARY</div>
      <div className="sl-summary-grid">
        <div className="sl-summary-card">
          <div className="sl-summary-heading">Minggu Ini</div>
          <div className="sl-summary-stat">
            <span>Total EXP</span>
            <strong>{weekly.totalExp}</strong>
          </div>
          <div className="sl-summary-stat">
            <span>Task Selesai</span>
            <strong>{weekly.totalTasks}</strong>
          </div>
          <div className="sl-summary-stat">
            <span>Hari Aktif</span>
            <strong>{weekly.activeDays}/7</strong>
          </div>
        </div>
        <div className="sl-summary-card">
          <div className="sl-summary-heading">Bulan Ini</div>
          <div className="sl-summary-stat">
            <span>Total EXP</span>
            <strong>{monthly.totalExp}</strong>
          </div>
          <div className="sl-summary-stat">
            <span>Task Selesai</span>
            <strong>{monthly.totalTasks}</strong>
          </div>
          <div className="sl-summary-stat">
            <span>Hari Aktif</span>
            <strong>{monthly.activeDays}</strong>
          </div>
        </div>
      </div>

      <div className="sl-panel-title" style={{ marginTop: "1.25rem" }}>
        RIWAYAT TERBARU
      </div>
      <div className="sl-history-list">
        {history.length === 0 && <div className="sl-empty-state">Belum ada riwayat.</div>}
        {history
          .slice()
          .reverse()
          .slice(0, 14)
          .map((h) => (
            <div className="sl-history-row" key={h.date}>
              <span className="sl-history-date">{h.date}</span>
              <span className="sl-history-tasks">{h.tasksCompleted} task</span>
              <span className="sl-history-exp">+{h.expGained} EXP</span>
            </div>
          ))}
      </div>

      {penaltyLog.length > 0 && (
        <>
          <div className="sl-panel-title" style={{ marginTop: "1.25rem" }}>
            PENALTY LOG
          </div>
          <div className="sl-history-list">
            {penaltyLog
              .slice()
              .reverse()
              .slice(0, 10)
              .map((p, i) => (
                <div className="sl-history-row sl-penalty-row" key={i}>
                  <span className="sl-history-date">{p.date}</span>
                  <span>{p.stat} stat menurun</span>
                  <span className="sl-penalty-amount">-{p.amount}</span>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- MODALS ---------- */

function AddTaskModal({ categories, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [exp, setExp] = useState(10);

  return (
    <div className="sl-modal-overlay" onClick={onClose}>
      <div className="sl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sl-modal-title">Tambah Task Baru</div>
        <label className="sl-modal-label">Nama Task</label>
        <input
          className="sl-modal-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Misal: Lari 30 menit"
          autoFocus
        />
        <label className="sl-modal-label">Kategori (menentukan Stat)</label>
        <select
          className="sl-modal-input"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} → {c.stat}
            </option>
          ))}
        </select>
        <label className="sl-modal-label">EXP Reward</label>
        <input
          className="sl-modal-input"
          type="number"
          min={1}
          max={200}
          value={exp}
          onChange={(e) => setExp(Number(e.target.value))}
        />
        <div className="sl-modal-actions">
          <button className="sl-secondary-btn" onClick={onClose}>
            Batal
          </button>
          <button
            className="sl-primary-btn"
            disabled={!name.trim() || !categoryId}
            onClick={() => onSubmit(name.trim(), categoryId, exp)}
          >
            Simpan Task
          </button>
        </div>
      </div>
    </div>
  );
}

function AddCategoryModal({ onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [stat, setStat] = useState("STR");

  return (
    <div className="sl-modal-overlay" onClick={onClose}>
      <div className="sl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sl-modal-title">Tambah Kategori Baru</div>
        <label className="sl-modal-label">Nama Kategori</label>
        <input
          className="sl-modal-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Misal: Meditasi"
          autoFocus
        />
        <label className="sl-modal-label">Terhubung ke Stat</label>
        <select className="sl-modal-input" value={stat} onChange={(e) => setStat(e.target.value)}>
          {STAT_KEYS.map((k) => (
            <option key={k} value={k}>
              {k} — {STAT_INFO[k].label}
            </option>
          ))}
        </select>
        <div className="sl-modal-actions">
          <button className="sl-secondary-btn" onClick={onClose}>
            Batal
          </button>
          <button
            className="sl-primary-btn"
            disabled={!name.trim()}
            onClick={() => onSubmit(name.trim(), stat)}
          >
            Simpan Kategori
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, onCancel, onConfirm }) {
  return (
    <div className="sl-modal-overlay" onClick={onCancel}>
      <div className="sl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sl-modal-title">{title}</div>
        <div className="sl-modal-message">{message}</div>
        <div className="sl-modal-actions">
          <button className="sl-secondary-btn" onClick={onCancel}>
            Batal
          </button>
          <button className="sl-danger-btn" onClick={onConfirm}>
            Ya, Reset
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- OVERLAYS ---------- */

function LevelUpOverlay({ levels, onDone }) {
  const finalLevel = levels[levels.length - 1];
  return (
    <div className="sl-overlay" onClick={onDone}>
      <div className="sl-levelup-card">
        <div className="sl-levelup-glow" />
        <div className="sl-levelup-label">LEVEL UP</div>
        <div className="sl-levelup-number">Lv. {finalLevel}</div>
        <div className="sl-levelup-hint">Tap untuk melanjutkan</div>
      </div>
    </div>
  );
}

function RankUpOverlay({ ranks, onDone }) {
  const finalRank = ranks[ranks.length - 1];
  const info = RANKS.find((r) => r.rank === finalRank);
  return (
    <div className="sl-overlay" onClick={onDone}>
      <div
        className="sl-rankup-card"
        style={{ "--rank-color": info.color, "--rank-glow": info.glow }}
      >
        <div className="sl-rankup-glow" />
        <div className="sl-rankup-label">RANK UP</div>
        <div className="sl-rankup-letter">{finalRank}-RANK</div>
        <div className="sl-rankup-hint">Tap untuk melanjutkan</div>
      </div>
    </div>
  );
}

function TitleUnlockOverlay({ titles, onDone }) {
  const title = titles[0];
  const handleNext = () => {
    if (titles.length <= 1) onDone();
    else onDone(); // simplified: consume whole queue at once for smoother UX
  };
  return (
    <div className="sl-overlay" onClick={handleNext}>
      <div className="sl-title-unlock-card">
        <div className="sl-title-unlock-label">TITLE UNLOCKED</div>
        <div className="sl-title-unlock-name">« {title.name} »</div>
        <div className="sl-title-unlock-desc">{title.desc}</div>
        <div className="sl-levelup-hint">Tap untuk melanjutkan</div>
      </div>
    </div>
  );
}

function SkillUnlockOverlay({ skills, onDone }) {
  const skill = skills[0];
  return (
    <div className="sl-overlay" onClick={onDone}>
      <div className="sl-skill-unlock-card">
        <div className="sl-title-unlock-label">SKILL SLOT UNLOCKED</div>
        <div className="sl-skill-unlock-level">Level {skill.level}</div>
        <div className="sl-skill-unlock-quote">"{skill.quote}"</div>
        <div className="sl-levelup-hint">Tap untuk melanjutkan</div>
      </div>
    </div>
  );
}

function PenaltyZoneOverlay({ onClear }) {
  const [confirming, setConfirming] = useState(false);

  // Deliberately NOT closable by clicking the backdrop — the Penalty Zone
  // can only be cleared via the emergency task button, matching the "locked
  // until you pay the price" concept from the brief.
  return (
    <div className="sl-overlay sl-penalty-overlay">
      <div className="sl-penalty-card">
        <div className="sl-penalty-siren" aria-hidden="true" />
        <div className="sl-penalty-label">⚠ PENALTY ZONE ⚠</div>
        <div className="sl-penalty-message">
          Kemarin tidak ada satu pun Daily Quest yang diselesaikan.
          <br />
          System mengunci semua Quest hingga hukuman dibayar.
        </div>
        <div className="sl-penalty-task-card">
          <div className="sl-penalty-task-name">TUGAS DARURAT</div>
          <div className="sl-penalty-task-detail">Push-up 50x</div>
        </div>
        {!confirming ? (
          <button className="sl-penalty-btn" onClick={() => setConfirming(true)}>
            Saya sudah melakukannya
          </button>
        ) : (
          <div className="sl-penalty-confirm-box">
            <div className="sl-penalty-confirm-text">
              Konfirmasi — kamu benar-benar sudah menyelesaikan Push-up 50x?
            </div>
            <div className="sl-penalty-confirm-actions">
              <button className="sl-secondary-btn" onClick={() => setConfirming(false)}>
                Belum
              </button>
              <button className="sl-primary-btn" onClick={onClear}>
                Ya, Selesai
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

function StyleBlock() {
  return (
    <style>{`
      .sl-root {
        --bg-void: #05060f;
        --bg-panel: #0b0f24;
        --bg-panel-2: #10152e;
        --border-glow: #2f4b8f;
        --text-primary: #e8ecff;
        --text-dim: #8891b8;
        --accent-blue: #4da3ff;
        --accent-blue-bright: #7fc4ff;
        --accent-purple: #7c5cff;
        position: relative;
        min-height: 100vh;
        background: radial-gradient(ellipse at top, #0d1230 0%, #05060f 60%);
        color: var(--text-primary);
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        overflow-x: hidden;
        padding: 1.5rem 1rem 3rem;
      }

      .sl-bgfx {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        overflow: hidden;
      }
      .sl-bgfx-grid {
        position: absolute;
        inset: -10%;
        background-image:
          linear-gradient(rgba(77,163,255,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(77,163,255,0.05) 1px, transparent 1px);
        background-size: 40px 40px;
        transform: perspective(500px) rotateX(60deg);
        opacity: 0.4;
      }
      .sl-bgfx-glow {
        position: absolute;
        width: 500px;
        height: 500px;
        border-radius: 50%;
        filter: blur(120px);
        opacity: 0.25;
      }
      .sl-bgfx-glow-1 {
        background: #2a5cff;
        top: -100px;
        left: -100px;
      }
      .sl-bgfx-glow-2 {
        background: #7c3aed;
        bottom: -100px;
        right: -100px;
      }

      .sl-container {
        position: relative;
        z-index: 1;
        max-width: 720px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .sl-panel {
        background: linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-panel-2) 100%);
        border: 1px solid rgba(77,163,255,0.25);
        border-radius: 14px;
        padding: 1.1rem 1.2rem;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.4), 0 8px 30px rgba(0,10,40,0.5), inset 0 1px 0 rgba(255,255,255,0.03);
        position: relative;
      }
      .sl-panel::before {
        content: '';
        position: absolute;
        top: 0; left: 12px; right: 12px;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(125,196,255,0.6), transparent);
      }

      .sl-panel-title {
        font-family: 'Rajdhani', 'Segoe UI', sans-serif;
        font-weight: 700;
        letter-spacing: 0.12em;
        font-size: 0.8rem;
        color: var(--accent-blue-bright);
        margin-bottom: 0.75rem;
        text-shadow: 0 0 8px rgba(77,163,255,0.5);
      }
      .sl-panel-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .sl-quest-progress {
        font-size: 0.8rem;
        color: var(--text-dim);
        font-weight: 600;
      }

      /* HEADER */
      .sl-header-panel {
        padding: 1.3rem 1.3rem 1.1rem;
      }
      .sl-header-top {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .sl-rank-badge {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        border-radius: 12px;
        border: 2px solid var(--rank-color, #4da3ff);
        box-shadow: 0 0 16px var(--rank-glow, #7fc4ff), inset 0 0 12px rgba(255,255,255,0.05);
        flex-shrink: 0;
      }
      .sl-rank-letter {
        font-size: 1.5rem;
        font-weight: 800;
        color: var(--rank-color, #4da3ff);
        line-height: 1;
      }
      .sl-rank-label {
        font-size: 0.55rem;
        letter-spacing: 0.1em;
        color: var(--text-dim);
        margin-top: 2px;
      }
      .sl-header-identity {
        flex: 1;
        min-width: 0;
      }
      .sl-player-name {
        font-size: 1.15rem;
        font-weight: 700;
        letter-spacing: 0.03em;
      }
      .sl-active-title {
        font-size: 0.78rem;
        color: var(--accent-blue-bright);
        margin-top: 2px;
      }
      .sl-level-badge {
        flex-shrink: 0;
        padding: 0.4rem 0.75rem;
        border: 1px solid rgba(77,163,255,0.4);
        border-radius: 8px;
        background: rgba(77,163,255,0.08);
      }
      .sl-level-num {
        font-weight: 700;
        color: var(--accent-blue-bright);
        font-size: 0.95rem;
      }

      .sl-exp-row {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .sl-exp-label {
        display: flex;
        justify-content: space-between;
        font-size: 0.72rem;
        color: var(--text-dim);
        letter-spacing: 0.05em;
      }
      .sl-exp-bar-track {
        height: 10px;
        border-radius: 6px;
        background: rgba(255,255,255,0.06);
        overflow: hidden;
        border: 1px solid rgba(77,163,255,0.2);
      }
      .sl-exp-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #2a5cff, #7fc4ff);
        border-radius: 6px;
        transition: width 0.6s cubic-bezier(0.22,1,0.36,1);
        box-shadow: 0 0 10px rgba(125,196,255,0.7);
      }
      .sl-exp-pulse {
        animation: sl-exp-flash 0.7s ease;
      }
      @keyframes sl-exp-flash {
        0% { filter: brightness(1); }
        40% { filter: brightness(1.8); }
        100% { filter: brightness(1); }
      }

      /* STAT GRID */
      .sl-stat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 0.6rem;
      }
      .sl-stat-card {
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.06);
        border-left: 3px solid var(--stat-color);
        border-radius: 10px;
        padding: 0.6rem 0.7rem;
      }
      .sl-stat-card-top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      .sl-stat-key {
        font-weight: 800;
        font-size: 0.85rem;
        color: var(--stat-color);
        letter-spacing: 0.05em;
      }
      .sl-stat-value {
        font-weight: 700;
        font-size: 1.1rem;
      }
      .sl-stat-name {
        font-size: 0.68rem;
        color: var(--text-dim);
        margin-bottom: 0.4rem;
      }
      .sl-stat-bar-track {
        height: 5px;
        border-radius: 4px;
        background: rgba(255,255,255,0.06);
        overflow: hidden;
      }
      .sl-stat-bar-fill {
        height: 100%;
        background: var(--stat-color);
        border-radius: 4px;
        transition: width 0.5s ease;
      }
      .sl-stat-warning {
        font-size: 0.62rem;
        color: #facc15;
        margin-top: 0.35rem;
      }
      .sl-stat-penalty {
        font-size: 0.62rem;
        color: #ff4d5e;
        margin-top: 0.35rem;
      }

      /* TABS */
      .sl-tabbar {
        display: flex;
        gap: 0.4rem;
        overflow-x: auto;
      }
      .sl-tab-btn {
        flex: 1;
        padding: 0.55rem 0.5rem;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(77,163,255,0.15);
        border-radius: 10px;
        color: var(--text-dim);
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s ease;
      }
      .sl-tab-active {
        background: rgba(77,163,255,0.15);
        border-color: var(--accent-blue);
        color: var(--accent-blue-bright);
        box-shadow: 0 0 12px rgba(77,163,255,0.3);
      }

      /* QUESTS */
      .sl-quest-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 0.9rem;
      }
      .sl-quest-row {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 10px;
        padding: 0.6rem 0.7rem;
        transition: opacity 0.3s ease;
      }
      .sl-quest-done {
        opacity: 0.5;
      }
      .sl-quest-check {
        width: 26px;
        height: 26px;
        flex-shrink: 0;
        border-radius: 6px;
        border: 2px solid var(--stat-color);
        background: transparent;
        color: var(--stat-color);
        font-weight: 800;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }
      .sl-quest-done .sl-quest-check {
        background: var(--stat-color);
        color: #05060f;
      }
      .sl-quest-info {
        flex: 1;
        min-width: 0;
      }
      .sl-quest-name {
        font-size: 0.9rem;
        font-weight: 600;
      }
      .sl-quest-done .sl-quest-name {
        text-decoration: line-through;
      }
      .sl-quest-meta {
        display: flex;
        gap: 0.6rem;
        margin-top: 0.2rem;
        font-size: 0.68rem;
        flex-wrap: wrap;
      }
      .sl-quest-cat {
        color: var(--stat-color);
        font-weight: 600;
      }
      .sl-quest-exp {
        color: var(--text-dim);
      }
      .sl-quest-streak {
        color: #facc15;
      }
      .sl-quest-delete {
        background: none;
        border: none;
        color: var(--text-dim);
        font-size: 0.9rem;
        cursor: pointer;
        padding: 0.2rem 0.4rem;
        flex-shrink: 0;
      }
      .sl-quest-delete:hover {
        color: #ff4d5e;
      }
      .sl-quest-actions {
        display: flex;
        gap: 0.6rem;
      }

      .sl-empty-state {
        color: var(--text-dim);
        font-size: 0.85rem;
        padding: 1rem 0;
        text-align: center;
      }

      /* BUTTONS */
      .sl-primary-btn {
        flex: 1;
        padding: 0.6rem;
        background: linear-gradient(135deg, #2a5cff, #7c3aed);
        border: none;
        border-radius: 9px;
        color: white;
        font-weight: 700;
        font-size: 0.82rem;
        cursor: pointer;
        box-shadow: 0 0 14px rgba(77,163,255,0.35);
      }
      .sl-primary-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .sl-secondary-btn {
        flex: 1;
        padding: 0.6rem;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 9px;
        color: var(--text-primary);
        font-weight: 600;
        font-size: 0.82rem;
        cursor: pointer;
      }
      .sl-danger-btn {
        padding: 0.6rem 1rem;
        background: rgba(255,77,94,0.1);
        border: 1px solid rgba(255,77,94,0.4);
        border-radius: 9px;
        color: #ff8896;
        font-weight: 600;
        font-size: 0.8rem;
        cursor: pointer;
      }

      .sl-footer {
        display: flex;
        justify-content: center;
        margin-top: 0.5rem;
      }

      /* TITLES */
      .sl-title-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .sl-title-card {
        padding: 0.7rem 0.9rem;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.08);
        position: relative;
      }
      .sl-title-locked {
        opacity: 0.4;
      }
      .sl-title-unlocked {
        background: rgba(77,163,255,0.06);
        border-color: rgba(77,163,255,0.3);
        cursor: pointer;
      }
      .sl-title-active {
        border-color: var(--accent-blue-bright);
        box-shadow: 0 0 12px rgba(77,163,255,0.3);
      }
      .sl-title-name {
        font-weight: 700;
        font-size: 0.9rem;
        color: var(--accent-blue-bright);
      }
      .sl-title-desc {
        font-size: 0.72rem;
        color: var(--text-dim);
        margin-top: 0.15rem;
      }
      .sl-title-badge {
        position: absolute;
        top: 0.6rem;
        right: 0.7rem;
        font-size: 0.6rem;
        font-weight: 700;
        color: #05060f;
        background: var(--accent-blue-bright);
        padding: 0.15rem 0.4rem;
        border-radius: 5px;
      }

      /* SKILLS */
      .sl-skill-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.7rem;
      }
      .sl-skill-card {
        background: linear-gradient(160deg, rgba(124,92,255,0.1), rgba(77,163,255,0.04));
        border: 1px solid rgba(124,92,255,0.35);
        border-radius: 12px;
        padding: 0.9rem;
      }
      .sl-skill-icon {
        color: var(--accent-purple);
        font-size: 1.3rem;
        margin-bottom: 0.3rem;
      }
      .sl-skill-level {
        font-weight: 700;
        font-size: 0.8rem;
        color: var(--accent-blue-bright);
        margin-bottom: 0.3rem;
      }
      .sl-skill-quote {
        font-size: 0.78rem;
        color: var(--text-dim);
        font-style: italic;
        line-height: 1.4;
      }

      /* SUMMARY */
      .sl-summary-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.7rem;
      }
      .sl-summary-card {
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 10px;
        padding: 0.75rem 0.9rem;
      }
      .sl-summary-heading {
        font-size: 0.75rem;
        color: var(--accent-blue-bright);
        font-weight: 700;
        margin-bottom: 0.5rem;
      }
      .sl-summary-stat {
        display: flex;
        justify-content: space-between;
        font-size: 0.78rem;
        color: var(--text-dim);
        margin-bottom: 0.25rem;
      }
      .sl-summary-stat strong {
        color: var(--text-primary);
      }
      .sl-history-list {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .sl-history-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.76rem;
        color: var(--text-dim);
        padding: 0.4rem 0.6rem;
        background: rgba(255,255,255,0.02);
        border-radius: 7px;
      }
      .sl-history-exp {
        color: var(--accent-blue-bright);
        font-weight: 600;
      }
      .sl-penalty-row {
        color: #ff8896;
      }
      .sl-penalty-amount {
        font-weight: 700;
      }

      /* MODALS */
      .sl-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(2,3,10,0.75);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 50;
        padding: 1rem;
      }
      .sl-modal {
        width: 100%;
        max-width: 380px;
        background: var(--bg-panel-2);
        border: 1px solid rgba(77,163,255,0.3);
        border-radius: 14px;
        padding: 1.3rem;
        box-shadow: 0 0 30px rgba(77,163,255,0.15);
      }
      .sl-modal-title {
        font-weight: 700;
        font-size: 1rem;
        margin-bottom: 0.9rem;
        color: var(--accent-blue-bright);
      }
      .sl-modal-message {
        font-size: 0.85rem;
        color: var(--text-dim);
        margin-bottom: 1rem;
        line-height: 1.5;
      }
      .sl-modal-label {
        display: block;
        font-size: 0.7rem;
        color: var(--text-dim);
        margin-bottom: 0.3rem;
        margin-top: 0.7rem;
      }
      .sl-modal-input {
        width: 100%;
        padding: 0.55rem 0.7rem;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px;
        color: var(--text-primary);
        font-size: 0.85rem;
        box-sizing: border-box;
      }
      .sl-modal-actions {
        display: flex;
        gap: 0.6rem;
        margin-top: 1.3rem;
      }

      /* TOAST */
      .sl-toast {
        position: fixed;
        top: 1rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 60;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background: rgba(20,10,30,0.95);
        border: 1px solid rgba(250,204,21,0.4);
        border-radius: 10px;
        padding: 0.7rem 1rem;
        max-width: 90vw;
        box-shadow: 0 0 20px rgba(250,204,21,0.2);
      }
      .sl-toast-icon {
        color: #facc15;
        font-weight: 800;
        flex-shrink: 0;
      }
      .sl-toast-msg {
        font-size: 0.8rem;
        color: var(--text-primary);
      }
      .sl-toast-close {
        background: none;
        border: none;
        color: var(--text-dim);
        cursor: pointer;
        font-size: 1rem;
        flex-shrink: 0;
      }

      /* OVERLAYS: LEVEL UP / RANK UP / TITLE / SKILL */
      .sl-overlay {
        position: fixed;
        inset: 0;
        background: rgba(2,3,12,0.85);
        backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        cursor: pointer;
        animation: sl-fade-in 0.3s ease;
      }
      @keyframes sl-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .sl-levelup-card {
        position: relative;
        text-align: center;
        animation: sl-pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1);
      }
      .sl-levelup-glow {
        position: absolute;
        inset: -60px;
        background: radial-gradient(circle, rgba(77,163,255,0.4), transparent 70%);
        filter: blur(20px);
        animation: sl-pulse-glow 1.8s ease-in-out infinite;
      }
      @keyframes sl-pulse-glow {
        0%, 100% { opacity: 0.5; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.15); }
      }
      .sl-levelup-label {
        position: relative;
        font-size: 1.3rem;
        letter-spacing: 0.3em;
        color: #7fc4ff;
        font-weight: 700;
        text-shadow: 0 0 20px rgba(77,163,255,0.9);
      }
      .sl-levelup-number {
        position: relative;
        font-size: 4rem;
        font-weight: 900;
        color: #fff;
        text-shadow: 0 0 30px #4da3ff, 0 0 60px #4da3ff;
        margin: 0.3rem 0;
      }
      .sl-levelup-hint {
        position: relative;
        font-size: 0.75rem;
        color: var(--text-dim);
        margin-top: 1rem;
      }

      .sl-rankup-card {
        position: relative;
        text-align: center;
        animation: sl-pop-in 0.6s cubic-bezier(0.34,1.56,0.64,1);
      }
      .sl-rankup-glow {
        position: absolute;
        inset: -100px;
        background: radial-gradient(circle, var(--rank-glow), transparent 70%);
        filter: blur(30px);
        animation: sl-pulse-glow 1.6s ease-in-out infinite;
      }
      .sl-rankup-label {
        position: relative;
        font-size: 1.5rem;
        letter-spacing: 0.4em;
        color: var(--rank-color);
        font-weight: 800;
        text-shadow: 0 0 25px var(--rank-glow);
      }
      .sl-rankup-letter {
        position: relative;
        font-size: 5.5rem;
        font-weight: 900;
        color: #fff;
        text-shadow: 0 0 40px var(--rank-color), 0 0 80px var(--rank-color);
        margin: 0.4rem 0;
      }
      .sl-rankup-hint {
        position: relative;
        font-size: 0.75rem;
        color: var(--text-dim);
        margin-top: 1.2rem;
      }

      .sl-title-unlock-card, .sl-skill-unlock-card {
        text-align: center;
        max-width: 340px;
        padding: 1.5rem;
        border: 1px solid rgba(124,92,255,0.5);
        border-radius: 16px;
        background: linear-gradient(160deg, rgba(124,92,255,0.15), rgba(10,10,25,0.9));
        box-shadow: 0 0 40px rgba(124,92,255,0.35);
        animation: sl-pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1);
      }
      .sl-title-unlock-label {
        font-size: 0.8rem;
        letter-spacing: 0.25em;
        color: var(--accent-purple);
        font-weight: 700;
        margin-bottom: 0.6rem;
      }
      .sl-title-unlock-name {
        font-size: 1.6rem;
        font-weight: 800;
        color: #fff;
        text-shadow: 0 0 20px rgba(124,92,255,0.8);
      }
      .sl-title-unlock-desc {
        font-size: 0.8rem;
        color: var(--text-dim);
        margin-top: 0.5rem;
      }
      .sl-skill-unlock-level {
        font-size: 1.2rem;
        font-weight: 700;
        color: #fff;
      }
      .sl-skill-unlock-quote {
        font-size: 0.85rem;
        color: var(--text-dim);
        font-style: italic;
        margin-top: 0.7rem;
        line-height: 1.5;
      }

      @keyframes sl-pop-in {
        0% { opacity: 0; transform: scale(0.7); }
        100% { opacity: 1; transform: scale(1); }
      }

      /* RADAR CHART */
      .sl-radar-wrap {
        display: flex;
        justify-content: center;
        margin-bottom: 0.8rem;
      }
      .sl-radar-svg {
        width: 100%;
        max-width: 280px;
        height: auto;
        overflow: visible;
      }
      .sl-radar-ring {
        fill: rgba(77,163,255,0.03);
        stroke: rgba(77,163,255,0.25);
        stroke-width: 1;
      }
      .sl-radar-spoke {
        stroke: rgba(77,163,255,0.18);
        stroke-width: 1;
      }
      .sl-radar-data-fill {
        fill: rgba(77,163,255,0.22);
        transition: points 0.5s ease;
      }
      .sl-radar-data-stroke {
        fill: none;
        stroke: #7fc4ff;
        stroke-width: 2;
        stroke-linejoin: round;
        filter: drop-shadow(0 0 6px rgba(125,196,255,0.8));
        transition: points 0.5s ease;
      }
      .sl-radar-dot {
        stroke: #05060f;
        stroke-width: 1.5;
        filter: drop-shadow(0 0 4px currentColor);
      }
      .sl-radar-label {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-shadow: 0 0 6px rgba(0,0,0,0.8);
      }

      .sl-stat-detail-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 0.4rem;
      }
      .sl-stat-detail-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.06);
        border-left: 3px solid var(--stat-color);
        border-radius: 8px;
        padding: 0.4rem 0.55rem;
        font-size: 0.72rem;
        flex-wrap: wrap;
      }
      .sl-stat-detail-key {
        font-weight: 800;
        color: var(--stat-color);
        min-width: 28px;
      }
      .sl-stat-detail-label {
        color: var(--text-dim);
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sl-stat-detail-value {
        font-weight: 700;
        color: var(--text-primary);
      }
      .sl-stat-penalty-tag {
        font-size: 0.62rem;
        color: #ff4d5e;
      }
      .sl-stat-warning-tag {
        font-size: 0.62rem;
        color: #facc15;
      }

      /* FOOTER */
      .sl-footer {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.6rem;
        margin-top: 0.5rem;
      }
      .sl-footer-row {
        display: flex;
        gap: 0.6rem;
        width: 100%;
      }

      /* QUEST LOCKED STATE */
      .sl-quest-locked .sl-empty-state {
        color: #ff8896;
      }

      /* PENALTY ZONE OVERLAY */
      .sl-penalty-overlay {
        background: rgba(20,2,4,0.9);
        cursor: default;
      }
      .sl-penalty-card {
        position: relative;
        text-align: center;
        max-width: 360px;
        padding: 1.8rem 1.5rem;
        border: 2px solid #ff4d5e;
        border-radius: 16px;
        background: linear-gradient(160deg, rgba(255,77,94,0.12), rgba(10,2,4,0.95));
        box-shadow: 0 0 50px rgba(255,77,94,0.4);
        animation: sl-pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1);
      }
      .sl-penalty-siren {
        position: absolute;
        inset: -40px;
        background: radial-gradient(circle, rgba(255,77,94,0.35), transparent 70%);
        filter: blur(20px);
        animation: sl-siren-pulse 1s ease-in-out infinite;
        pointer-events: none;
      }
      @keyframes sl-siren-pulse {
        0%, 100% { opacity: 0.4; transform: scale(1); }
        50% { opacity: 0.9; transform: scale(1.2); }
      }
      .sl-penalty-label {
        position: relative;
        font-size: 1.4rem;
        font-weight: 900;
        letter-spacing: 0.15em;
        color: #ff4d5e;
        text-shadow: 0 0 20px rgba(255,77,94,0.9);
        margin-bottom: 0.8rem;
      }
      .sl-penalty-message {
        position: relative;
        font-size: 0.85rem;
        color: #f3d4d7;
        line-height: 1.6;
        margin-bottom: 1.2rem;
      }
      .sl-penalty-task-card {
        position: relative;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,77,94,0.4);
        border-radius: 10px;
        padding: 0.8rem;
        margin-bottom: 1.2rem;
      }
      .sl-penalty-task-name {
        font-size: 0.65rem;
        letter-spacing: 0.1em;
        color: #ff8896;
        margin-bottom: 0.3rem;
      }
      .sl-penalty-task-detail {
        font-size: 1.15rem;
        font-weight: 800;
        color: #fff;
      }
      .sl-penalty-btn {
        position: relative;
        width: 100%;
        padding: 0.75rem;
        background: linear-gradient(135deg, #ff4d5e, #c2273a);
        border: none;
        border-radius: 10px;
        color: white;
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        box-shadow: 0 0 20px rgba(255,77,94,0.5);
      }
      .sl-penalty-confirm-box {
        position: relative;
      }
      .sl-penalty-confirm-text {
        font-size: 0.78rem;
        color: #f3d4d7;
        margin-bottom: 0.8rem;
      }
      .sl-penalty-confirm-actions {
        display: flex;
        gap: 0.6rem;
      }

      @media (max-width: 400px) {
        .sl-levelup-number { font-size: 3rem; }
        .sl-rankup-letter { font-size: 4rem; }
        .sl-footer-row { flex-direction: column; }
      }
    `}</style>
  );
}

/* ============================================================
   CARA MENJADIKAN APLIKASI INI SEBAGAI PWA (Progressive Web App)
   ============================================================

   Komponen ini murni React — untuk membuatnya bisa di-"install" ke
   homescreen HP/Desktop layaknya aplikasi native, kamu perlu 2 file
   tambahan di root project (di luar komponen ini) plus sedikit
   registrasi. Berikut ringkasannya:

   1) BUAT FILE `manifest.json` DI FOLDER PUBLIC/ROOT PROJECT
      ---------------------------------------------------------
      {
        "name": "Solo Leveling Status Window",
        "short_name": "SL Tracker",
        "description": "Habit tracker RPG ala Solo Leveling",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#05060f",
        "theme_color": "#0b0f24",
        "orientation": "portrait",
        "icons": [
          { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
          { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
        ]
      }

      Lalu tambahkan di <head> file HTML utama (index.html):
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0b0f24" />
      Siapkan juga 2 file ikon PNG (192x192 & 512x512) di folder public.

   2) BUAT FILE `service-worker.js` SEDERHANA DI FOLDER PUBLIC/ROOT
      ---------------------------------------------------------
      const CACHE_NAME = "sl-tracker-cache-v1";
      const ASSETS_TO_CACHE = ["/", "/index.html", "/manifest.json"];

      self.addEventListener("install", (event) => {
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
        );
        self.skipWaiting();
      });

      self.addEventListener("activate", (event) => {
        event.waitUntil(
          caches.keys().then((keys) =>
            Promise.all(
              keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            )
          )
        );
      });

      self.addEventListener("fetch", (event) => {
        event.respondWith(
          caches.match(event.request).then((cached) => cached || fetch(event.request))
        );
      });

   3) DAFTARKAN SERVICE WORKER DARI KODE APLIKASI
      ---------------------------------------------------------
      Di file entry point (misalnya index.js / main.jsx), tambahkan:

        if ("serviceWorker" in navigator) {
          window.addEventListener("load", () => {
            navigator.serviceWorker
              .register("/service-worker.js")
              .catch((err) => console.error("SW registration failed:", err));
          });
        }

   4) HASIL AKHIR
      ---------------------------------------------------------
      - Setelah di-deploy dengan HTTPS (wajib untuk PWA, kecuali localhost),
        browser (Chrome/Edge/Safari) akan menampilkan prompt "Install App"
        atau "Add to Home Screen".
      - Data tetap tersimpan di localStorage seperti biasa — service worker
        di atas hanya meng-cache file statis (HTML/JS/CSS) agar aplikasi
        tetap bisa dibuka meski offline, bukan meng-cache data progress.
      - Catatan keamanan cache: localStorage bisa terhapus jika pengguna
        membersihkan data browser/cache. Karena itu, fitur Export/Import
        JSON di atas penting sebagai backup manual yang tidak bergantung
        pada cache browser sama sekali.
   ============================================================ */
