"use client";

import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Command,
  FileBarChart,
  Flame,
  FolderKanban,
  GripVertical,
  LayoutDashboard,
  ListTodo,
  Menu,
  MoreHorizontal,
  NotebookPen,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  Sparkles,
  Target,
  TimerReset,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type View = "Dashboard" | "Tasks" | "Habits" | "Projects" | "Notes" | "Reports" | "Calendar" | "Analytics" | "Agent Activity" | "Settings";
type Task = { id: number; title: string; project: string; time: string; priority: "Urgent" | "High" | "Normal"; done: boolean; status: "To do" | "In progress" | "Done"; domain: "Personal" | "Work" | "OTS" };

const nav: { label: View; icon: LucideIcon }[] = [
  { label: "Dashboard", icon: LayoutDashboard }, { label: "Tasks", icon: ListTodo },
  { label: "Habits", icon: Flame }, { label: "Projects", icon: FolderKanban },
  { label: "Notes", icon: NotebookPen }, { label: "Reports", icon: FileBarChart },
  { label: "Calendar", icon: CalendarDays }, { label: "Analytics", icon: BarChart3 },
  { label: "Agent Activity", icon: Bot }, { label: "Settings", icon: Settings },
];

const initialTasks: Task[] = [
  { id: 1, title: "Finalize Q3 product brief", project: "Project E", time: "9:00 AM", priority: "Urgent", done: false, status: "In progress", domain: "Work" },
  { id: 2, title: "Review OTS storefront copy", project: "OTS Growth", time: "11:30 AM", priority: "High", done: false, status: "To do", domain: "OTS" },
  { id: 3, title: "30 minute strength session", project: "Personal OS", time: "4:00 PM", priority: "Normal", done: false, status: "To do", domain: "Personal" },
  { id: 4, title: "Map MCP permission model", project: "Project E", time: "Yesterday", priority: "High", done: true, status: "Done", domain: "Work" },
  { id: 5, title: "Archive June campaign assets", project: "OTS Growth", time: "Jul 15", priority: "Normal", done: false, status: "In progress", domain: "OTS" },
  { id: 6, title: "Plan long weekend itinerary", project: "Personal OS", time: "Jul 17", priority: "Normal", done: false, status: "To do", domain: "Personal" },
];

const habits = [
  { id: 1, icon: "↟", name: "Morning walk", streak: 18, color: "mint", done: true },
  { id: 2, icon: "◒", name: "Read 20 pages", streak: 12, color: "blue", done: false },
  { id: 3, icon: "✦", name: "Daily reflection", streak: 7, color: "amber", done: false },
  { id: 4, icon: "⌁", name: "No screens after 10", streak: 4, color: "coral", done: false },
];

const projects = [
  { name: "Project E", domain: "Work", progress: 72, due: "Sep 30", tasks: "18 / 25", color: "#356bff", icon: "E" },
  { name: "OTS Growth", domain: "OTS", progress: 54, due: "Aug 12", tasks: "13 / 24", color: "#ea7658", icon: "O" },
  { name: "Personal OS", domain: "Personal", progress: 81, due: "Ongoing", tasks: "17 / 21", color: "#299667", icon: "P" },
];

const week = [
  { day: "M", value: 58 }, { day: "T", value: 78 }, { day: "W", value: 66 },
  { day: "T", value: 91 }, { day: "F", value: 74 }, { day: "S", value: 42 }, { day: "S", value: 67 },
];

function Logo() {
  return <div className="brand"><span className="brand-mark">E</span><span>Project E</span></div>;
}

function Progress({ value, color = "var(--green)" }: { value: number; color?: string }) {
  return <div className="progress" aria-label={`${value}% complete`}><span style={{ width: `${value}%`, background: color }} /></div>;
}

function Dashboard({ tasks, onToggleTask, habitDone, onToggleHabit, onNavigate }: { tasks: Task[]; onToggleTask: (id: number) => void; habitDone: Record<number, boolean>; onToggleHabit: (id: number) => void; onNavigate: (view: View) => void }) {
  const done = tasks.filter(t => t.done).length;
  return <>
    <section className="hero-grid">
      <article className="focus-card panel">
        <div><p className="eyebrow"><Sparkles size={14} /> Focus score</p><h2>Good momentum.</h2><p>You’re ahead of last week. One focused block will close your highest-impact task.</p></div>
        <div className="score-ring" aria-label="Focus score 82 out of 100"><strong>82</strong><span>/ 100</span></div>
        <button className="primary-button"><Play size={15} fill="currentColor" /> Start focus session</button>
      </article>
      <article className="metric panel"><span className="metric-icon blue"><CheckCircle2 /></span><div><small>Tasks complete</small><strong>{done + 11}<span>/ 18</span></strong><em><TrendingUp size={13} /> 18% this week</em></div></article>
      <article className="metric panel"><span className="metric-icon coral"><Flame /></span><div><small>Best streak</small><strong>18 <span>days</span></strong><em>Morning walk</em></div></article>
      <article className="metric panel"><span className="metric-icon mint"><Clock3 /></span><div><small>Focused time</small><strong>14.5 <span>hrs</span></strong><em><TrendingUp size={13} /> 2.1h vs last week</em></div></article>
    </section>

    <section className="main-grid">
      <article className="panel today-panel">
        <header className="panel-header"><div><p className="eyebrow">Monday, July 13</p><h2>Today’s plan</h2></div><button className="text-button" onClick={() => onNavigate("Tasks")}>All tasks <ChevronRight size={15} /></button></header>
        <div className="task-list">
          {tasks.slice(0, 4).map(task => <div className={`task-row ${task.done ? "is-done" : ""}`} key={task.id}>
            <button className="check-button" onClick={() => onToggleTask(task.id)} aria-label={`${task.done ? "Reopen" : "Complete"} ${task.title}`}>{task.done ? <Check size={15} /> : <Circle size={17} />}</button>
            <div className="task-copy"><strong>{task.title}</strong><span><i className={`dot ${task.domain.toLowerCase()}`} />{task.project} · {task.time}</span></div>
            <span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span><button className="icon-button" aria-label={`More options for ${task.title}`}><MoreHorizontal size={17} /></button>
          </div>)}
        </div>
        <button className="add-row"><Plus size={16} /> Add a task</button>
      </article>

      <article className="panel habits-panel">
        <header className="panel-header"><div><p className="eyebrow">Daily rhythm</p><h2>Habits</h2></div><span className="completion-badge">{Object.values(habitDone).filter(Boolean).length}/4 done</span></header>
        <div className="habit-list">
          {habits.map(habit => { const isDone = habitDone[habit.id]; return <button className={`habit-row ${isDone ? "is-done" : ""}`} key={habit.id} onClick={() => onToggleHabit(habit.id)}>
            <span className={`habit-icon ${habit.color}`}>{habit.icon}</span><span className="habit-copy"><strong>{habit.name}</strong><small><Flame size={12} fill="currentColor" /> {habit.streak} day streak</small></span><span className="habit-check">{isDone && <Check size={15} />}</span>
          </button>})}
        </div>
      </article>

      <article className="panel week-panel">
        <header className="panel-header"><div><p className="eyebrow">July 7–13</p><h2>Weekly pulse</h2></div><button className="icon-button" aria-label="Weekly pulse options"><MoreHorizontal size={18} /></button></header>
        <div className="chart-summary"><div><strong>76%</strong><span>completion rate</span></div><em><TrendingUp size={14} /> +8% vs last week</em></div>
        <div className="bar-chart" aria-label="Weekly completion chart">{week.map((d, i) => <div className="bar-wrap" key={`${d.day}-${i}`}><span className={i === 3 ? "active" : ""} style={{ height: `${d.value}%` }} /><small>{d.day}</small></div>)}</div>
      </article>

      <article className="panel projects-panel">
        <header className="panel-header"><div><p className="eyebrow">Across your life</p><h2>Active projects</h2></div><button className="text-button" onClick={() => onNavigate("Projects")}>View all <ChevronRight size={15} /></button></header>
        <div className="project-list">{projects.map(p => <button className="project-row" key={p.name} onClick={() => onNavigate("Projects")}><span className="project-icon" style={{ background: p.color }}>{p.icon}</span><span className="project-copy"><span><strong>{p.name}</strong><small>{p.tasks} tasks</small></span><Progress value={p.progress} color={p.color} /></span><strong className="project-percent">{p.progress}%</strong></button>)}</div>
      </article>

      <article className="panel agent-panel">
        <div className="agent-glow"><Bot size={25} /></div><div><p className="eyebrow">Agent workspace</p><h2>Hermes finished a task</h2><p>“Project health brief” is ready to review, with 3 risks and 5 next actions.</p></div><button className="secondary-button" onClick={() => onNavigate("Agent Activity")}>Review result <ChevronRight size={15} /></button>
      </article>
    </section>
  </>;
}

function TasksView({ tasks, onToggle }: { tasks: Task[]; onToggle: (id: number) => void }) {
  return <section className="view-stack"><div className="view-toolbar"><div className="segmented"><button className="active">Board</button><button>List</button></div><div className="toolbar-actions"><button className="secondary-button"><Search size={15} /> Filter</button><button className="primary-button"><Plus size={15} /> New task</button></div></div><div className="kanban">{(["To do", "In progress", "Done"] as const).map(status => <div className="kanban-column" key={status}><header><span><i className={`status-dot status-${status.replace(" ", "-").toLowerCase()}`} />{status}</span><small>{tasks.filter(t => t.status === status).length}</small><Plus size={15} /></header><div className="kanban-cards">{tasks.filter(t => t.status === status).map(task => <article className={`kanban-card ${task.done ? "is-done" : ""}`} key={task.id}><div className="kanban-top"><GripVertical size={15} /><span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span><MoreHorizontal size={16} /></div><button onClick={() => onToggle(task.id)}><span className="task-check">{task.done && <Check size={13} />}</span><strong>{task.title}</strong></button><p>{task.project}</p><footer><span><CalendarDays size={13} /> {task.time}</span><span className={`domain-pill ${task.domain.toLowerCase()}`}>{task.domain}</span></footer></article>)}</div><button className="add-card"><Plus size={15} /> Add task</button></div>)}</div></section>;
}

function HabitsView({ habitDone, onToggle }: { habitDone: Record<number, boolean>; onToggle: (id: number) => void }) {
  return <section className="view-stack"><div className="habit-score-banner panel"><div><p className="eyebrow">Your rhythm</p><h2>Consistency is compounding</h2><p>You completed 86% of scheduled habits in the past 30 days.</p></div><div className="score-ring small"><strong>86</strong><span>score</span></div></div><div className="habit-grid">{habits.map(h => <article className="habit-card panel" key={h.id}><div className="habit-card-top"><span className={`habit-icon large ${h.color}`}>{h.icon}</span><button className="icon-button"><MoreHorizontal size={18} /></button></div><h3>{h.name}</h3><p>Every day · Personal</p><div className="streak-line"><Flame size={18} fill="currentColor" /><strong>{h.streak}</strong><span>day streak</span></div><div className="mini-heat">{Array.from({ length: 28 }).map((_, i) => <i className={i % 7 === 5 || i > 24 ? "low" : i % 5 === 0 ? "mid" : "high"} key={i} />)}</div><button className={`habit-complete ${habitDone[h.id] ? "done" : ""}`} onClick={() => onToggle(h.id)}>{habitDone[h.id] ? <><Check size={16} /> Completed today</> : <><Circle size={16} /> Mark complete</>}</button></article>)}</div></section>;
}

function ProjectsView() {
  return <section className="view-stack"><div className="view-toolbar"><div className="filter-pills"><button className="active">Active <span>3</span></button><button>Paused <span>1</span></button><button>Archived <span>6</span></button></div><button className="primary-button"><Plus size={15} /> New project</button></div><div className="projects-grid">{projects.map((p, index) => <article className="project-card panel" key={p.name}><header><span className="project-icon large" style={{ background: p.color }}>{p.icon}</span><span className={`domain-pill ${p.domain.toLowerCase()}`}>{p.domain}</span><button className="icon-button"><MoreHorizontal size={18} /></button></header><h2>{p.name}</h2><p>{index === 0 ? "A calm, agent-native system for every commitment." : index === 1 ? "Make the storefront and campaigns work as one growth engine." : "Build routines and systems that create more spacious days."}</p><div className="project-meta"><span><strong>{p.progress}%</strong> complete</span><span>{p.tasks} tasks</span></div><Progress value={p.progress} color={p.color} /><footer><span><CalendarDays size={14} /> {p.due}</span><span className="avatar-stack"><i>M</i><i>H</i></span></footer></article>)}</div></section>;
}

function NotesView() {
  const notes = ["Project E — product principles", "July operating review", "OTS campaign concepts", "Reading notes: Slow Productivity"];
  const [selected, setSelected] = useState(notes[0]);
  return <section className="notes-shell panel"><aside><header><strong>Notes</strong><button className="icon-button"><Plus size={17} /></button></header><label className="notes-search"><Search size={14} /><input placeholder="Search notes…" /></label>{notes.map((n, i) => <button key={n} className={selected === n ? "active" : ""} onClick={() => setSelected(n)}><strong>{n}</strong><span>{i === 0 ? "Updated 18m ago" : `${i + 1} days ago`}</span></button>)}</aside><article className="note-editor"><header><div className="breadcrumb">Notes <ChevronRight size={13} /> <span>Work</span></div><div><button className="icon-button"><Bot size={17} /></button><button className="icon-button"><MoreHorizontal size={17} /></button></div></header><div className="note-body"><p className="eyebrow"># project-e · work · strategy</p><h1>{selected}</h1><p className="note-lede">A personal operating system should reduce cognitive weight, not become another system to maintain.</p><h2>North star</h2><p>Project E brings tasks, habits, projects, and knowledge into one calm surface. The model stays flexible; views do the organizing.</p><blockquote><Sparkles size={18} /> Design for the moment a person returns after a chaotic week. The system should make the next step obvious.</blockquote><h2>Working principles</h2><ul><li><span>01</span> Three equal pillars, never one buried inside another.</li><li><span>02</span> Capture quickly, organize progressively.</li><li><span>03</span> External agents operate through explicit permissions.</li></ul></div></article></section>;
}

function ReportsView() {
  const items = [{ icon: BarChart3, title: "Weekly Summary", sub: "Jul 7–13", color: "blue" }, { icon: CalendarDays, title: "Monthly Review", sub: "June 2026", color: "mint" }, { icon: Target, title: "Project Health", sub: "Project E", color: "coral" }, { icon: Flame, title: "Habit Analysis", sub: "Last 30 days", color: "amber" }];
  return <section className="view-stack"><div className="report-hero panel"><div><p className="eyebrow">Reports</p><h2>Turn activity into perspective.</h2><p>Generate a structured review from your actual work, habits, and time.</p></div><button className="primary-button"><Sparkles size={15} /> Generate report</button></div><div className="report-grid">{items.map(({ icon: Icon, ...r }) => <article className="report-card panel" key={r.title}><span className={`metric-icon ${r.color}`}><Icon /></span><div><h3>{r.title}</h3><p>{r.sub}</p></div><span className="report-status">Ready</span><button className="text-button">Open <ChevronRight size={14} /></button></article>)}</div><article className="panel recent-table"><header className="panel-header"><h2>Recent reports</h2><button className="text-button">View archive</button></header>{["Project E weekly health", "June time audit", "OTS campaign retrospective"].map((name, i) => <div className="table-row" key={name}><span className="file-icon"><FileBarChart size={17} /></span><strong>{name}</strong><span>{i === 0 ? "Weekly" : i === 1 ? "Time audit" : "Custom"}</span><span>Jul {13 - i * 4}</span><button className="icon-button"><MoreHorizontal size={17} /></button></div>)}</article></section>;
}

function CalendarView() {
  const days = Array.from({ length: 35 }, (_, i) => i - 1);
  return <section className="calendar-shell panel"><header><div><button className="secondary-button">Today</button><button className="icon-button">‹</button><button className="icon-button">›</button><h2>July 2026</h2></div><div className="segmented"><button className="active">Month</button><button>Week</button><button>Day</button></div></header><div className="calendar-grid">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <strong className="weekday" key={d}>{d}</strong>)}{days.map((d, i) => <div className={`calendar-day ${d === 13 ? "today" : ""} ${d < 1 || d > 31 ? "muted" : ""}`} key={i}><span>{d < 1 ? 29 + d : d > 31 ? d - 31 : d}</span>{d === 13 && <><em className="event work">9:00 Product brief</em><em className="event ots">11:30 OTS copy</em><em className="event personal">4:00 Strength</em></>}{d === 15 && <em className="event work">Project milestone</em>}{d === 17 && <em className="event personal">Trip planning</em>}</div>)}</div></section>;
}

function AnalyticsView() {
  return <section className="view-stack"><div className="analytics-metrics"><article className="panel"><small>Completion rate</small><strong>76%</strong><span className="up"><TrendingUp size={14} /> 8.2%</span></article><article className="panel"><small>Habit consistency</small><strong>86%</strong><span className="up"><TrendingUp size={14} /> 4.1%</span></article><article className="panel"><small>Deep work</small><strong>14.5h</strong><span className="up"><TrendingUp size={14} /> 2.1h</span></article><article className="panel"><small>Active streaks</small><strong>4</strong><span>Best: 18 days</span></article></div><div className="analytics-grid"><article className="panel trend-card"><header className="panel-header"><div><p className="eyebrow">12 week view</p><h2>Productivity trend</h2></div><div className="segmented"><button className="active">Tasks</button><button>Habits</button></div></header><div className="area-chart">{[35, 47, 42, 58, 54, 69, 63, 77, 72, 88, 80, 92].map((v, i) => <i key={i} style={{ height: `${v}%` }}><span>{v}</span></i>)}</div></article><article className="panel distribution-card"><p className="eyebrow">Time distribution</p><h2>Where time went</h2><div className="donut"><div><strong>14.5h</strong><span>tracked</span></div></div><ul><li><i className="work" />Work <strong>48%</strong></li><li><i className="ots" />OTS <strong>31%</strong></li><li><i className="personal" />Personal <strong>21%</strong></li></ul></article></div></section>;
}

function AgentView() {
  const events = [{ type: "done", icon: Check, title: "Completed “Project health brief”", agent: "Hermes", time: "12 minutes ago", text: "Created a report with 3 risks, 5 actions, and a milestone forecast." }, { type: "working", icon: Activity, title: "Analyzing OTS campaign performance", agent: "Hermes", time: "Started 28 minutes ago", text: "Reviewing 14 tasks and 3 linked notes." }, { type: "created", icon: Plus, title: "Created note “July research synthesis”", agent: "Claude", time: "Yesterday, 4:18 PM", text: "Generated from 8 source notes with backlinks preserved." }];
  return <section className="agent-layout"><article className="panel agent-summary"><div className="agent-avatar"><Bot size={28} /></div><div><p className="eyebrow">Active agent</p><h2>Hermes</h2><p>Planning and analysis partner · Full access</p></div><span className="online"><i /> Online</span><div className="agent-stats"><span><strong>24</strong>actions</span><span><strong>8</strong>tasks</span><span><strong>4</strong>reports</span></div><button className="secondary-button">Open workspace</button></article><article className="panel activity-feed"><header className="panel-header"><div><p className="eyebrow">Audit trail</p><h2>Agent activity</h2></div><button className="secondary-button">All agents <ChevronDown size={14} /></button></header>{events.map(({ icon: Icon, ...event }) => <div className="activity-row" key={event.title}><span className={`activity-icon ${event.type}`}><Icon size={16} /></span><div><strong>{event.title}</strong><p>{event.text}</p><span>{event.agent} · {event.time}</span></div><button className="text-button">Details</button></div>)}</article></section>;
}

function SettingsView() {
  return <section className="settings-layout"><aside className="panel"><button className="active">Appearance</button><button>Domains</button><button>Keyboard shortcuts</button><button>Agents & permissions</button><button>Webhooks</button><button>Import & export</button></aside><article className="panel settings-content"><p className="eyebrow">Preferences</p><h2>Appearance</h2><p>Make Project E feel right for the way you work.</p><div className="setting-row"><div><strong>Color mode</strong><span>Use a light or dark interface.</span></div><div className="segmented"><button className="active">Light</button><button>Dark</button><button>System</button></div></div><div className="setting-row"><div><strong>Accent color</strong><span>Used for actions and progress.</span></div><div className="swatches"><button className="active blue" aria-label="Blue" /><button className="green" aria-label="Green" /><button className="coral" aria-label="Coral" /><button className="violet" aria-label="Violet" /></div></div><div className="setting-row"><div><strong>Density</strong><span>Control information spacing.</span></div><div className="segmented"><button>Compact</button><button className="active">Comfortable</button><button>Spacious</button></div></div><div className="setting-row"><div><strong>Reduced motion</strong><span>Minimize interface animation.</span></div><button className="switch" aria-label="Toggle reduced motion"><span /></button></div></article></section>;
}

function CommandPalette({ onClose, onNavigate }: { onClose: () => void; onNavigate: (v: View) => void }) {
  const [query, setQuery] = useState("");
  const results = nav.filter(n => n.label.toLowerCase().includes(query.toLowerCase()));
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="command-modal" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={e => e.stopPropagation()}><label><Search size={19} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Project E or run a command…" /><kbd>esc</kbd></label><div className="command-results"><p>Jump to</p>{results.map(({ label, icon: Icon }) => <button key={label} onClick={() => { onNavigate(label); onClose(); }}><Icon size={17} /><span>{label}</span><kbd>↵</kbd></button>)}</div><footer><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span></footer></div></div>;
}

export default function ProjectEApp() {
  const [view, setView] = useState<View>("Dashboard");
  const [tasks, setTasks] = useState(initialTasks);
  const [habitDone, setHabitDone] = useState<Record<number, boolean>>({ 1: true, 2: false, 3: false, 4: false });
  const [domain, setDomain] = useState("All domains");
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); }
      if (event.key === "Escape") { setCommandOpen(false); setMobileNav(false); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredTasks = useMemo(() => domain === "All domains" ? tasks : tasks.filter(t => t.domain === domain), [tasks, domain]);
  const toggleTask = (id: number) => setTasks(current => current.map(t => t.id === id ? { ...t, done: !t.done, status: !t.done ? "Done" : "To do" } : t));
  const navigate = (next: View) => { setView(next); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  let content;
  if (view === "Dashboard") content = <Dashboard tasks={filteredTasks} onToggleTask={toggleTask} habitDone={habitDone} onToggleHabit={id => setHabitDone(v => ({ ...v, [id]: !v[id] }))} onNavigate={navigate} />;
  else if (view === "Tasks") content = <TasksView tasks={filteredTasks} onToggle={toggleTask} />;
  else if (view === "Habits") content = <HabitsView habitDone={habitDone} onToggle={id => setHabitDone(v => ({ ...v, [id]: !v[id] }))} />;
  else if (view === "Projects") content = <ProjectsView />;
  else if (view === "Notes") content = <NotesView />;
  else if (view === "Reports") content = <ReportsView />;
  else if (view === "Calendar") content = <CalendarView />;
  else if (view === "Analytics") content = <AnalyticsView />;
  else if (view === "Agent Activity") content = <AgentView />;
  else content = <SettingsView />;

  return <div className="app-shell">
    <a href="#main" className="skip-link">Skip to content</a>
    <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
      <div className="sidebar-top"><Logo /><button className="close-mobile icon-button" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={19} /></button></div>
      <nav aria-label="Main navigation">{nav.slice(0, 8).map(({ label, icon: Icon }) => <button key={label} className={view === label ? "active" : ""} onClick={() => navigate(label)}><Icon size={18} /><span>{label}</span>{label === "Tasks" && <em>6</em>}</button>)}</nav>
      <div className="sidebar-section"><p>Workspace</p>{nav.slice(8).map(({ label, icon: Icon }) => <button key={label} className={view === label ? "active" : ""} onClick={() => navigate(label)}><Icon size={18} /><span>{label}</span>{label === "Agent Activity" && <i className="live-dot" />}</button>)}</div>
      <button className={`focus-mini ${timerActive ? "active" : ""}`} onClick={() => setTimerActive(v => !v)}><span className="focus-mini-icon">{timerActive ? <Pause size={17} fill="currentColor" /> : <TimerReset size={18} />}</span><span><strong>{timerActive ? "24:32" : "Focus timer"}</strong><small>{timerActive ? "Project E brief" : "Ready when you are"}</small></span><ChevronRight size={15} /></button>
      <div className="profile"><span className="profile-avatar">ME</span><span><strong>Matt</strong><small>Personal workspace</small></span><MoreHorizontal size={17} /></div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <div className="workspace">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button><button className="command-trigger" onClick={() => setCommandOpen(true)}><Search size={16} /><span>Search or jump to…</span><kbd><Command size={11} /> K</kbd></button><div className="top-actions"><label className="domain-select"><span className={`dot ${domain === "Work" ? "work" : domain === "OTS" ? "ots" : domain === "Personal" ? "personal" : "all"}`} /><select value={domain} onChange={e => setDomain(e.target.value)} aria-label="Filter by domain"><option>All domains</option><option>Personal</option><option>Work</option><option>OTS</option></select><ChevronDown size={13} /></label><button className="icon-button notification" aria-label="Notifications"><Bell size={18} /><i /></button><button className="quick-add" onClick={() => setCommandOpen(true)}><Plus size={17} /> <span>Quick add</span></button></div></header>
      <main id="main"><header className="page-heading"><div><p className="eyebrow">{view === "Dashboard" ? "Your day, at a glance" : "Project E"}</p><h1>{view === "Dashboard" ? "Good morning, Matt." : view}</h1><p>{view === "Dashboard" ? "Monday, July 13 · You have 3 priorities and 4 habits today." : view === "Tasks" ? "Move work forward without losing the thread." : view === "Habits" ? "Small actions, visible momentum." : view === "Projects" ? "Every outcome has a home." : view === "Notes" ? "Connect ideas to the work they shape." : view === "Reports" ? "Step back and see what changed." : view === "Calendar" ? "Your commitments, in time." : view === "Analytics" ? "Patterns behind your progress." : view === "Agent Activity" ? "Every agent action, visible and reversible." : "Tune Project E to fit your work."}</p></div>{view !== "Dashboard" && view !== "Settings" && <button className="primary-button"><Plus size={15} /> New {view === "Agent Activity" ? "agent" : view.replace(/s$/, "").toLowerCase()}</button>}</header>{content}</main>
    </div>
    {commandOpen && <CommandPalette onClose={() => setCommandOpen(false)} onNavigate={navigate} />}
  </div>;
}
