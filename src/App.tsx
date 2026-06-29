import { useState, useEffect } from "react";
import WeeklyCalendar from "./components/WeeklyCalendar";
import TaskSidebar from "./components/TaskSidebar";
import TaskModal from "./components/TaskModal";
import GoogleWorkspacePanel from "./components/GoogleWorkspacePanel";
import { Task } from "./types";
import {
  Shield,
  Clock,
  Briefcase,
  Users,
  BarChart2,
  DollarSign,
  Wifi,
  Info,
  CheckCircle2,
  Compass,
  ChevronDown
} from "lucide-react";

const DEFAULT_USER_ID = "11111111-1111-1111-1111-111111111111";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState<Date | null>(null);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calendarMode, setCalendarMode] = useState<"day" | "week" | "month">("week");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<"planner" | "workspace">("planner");

  // Read API base URL from VITE_API_URL, defaulting to /api
  const apiBase = (import.meta as any).env.VITE_API_URL || "/api";

  const fetchTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/users/${DEFAULT_USER_ID}/tasks`);
      if (!res.ok) {
        throw new Error("Failed to fetch task list from the engine.");
      }
      const data = await res.json();
      setTasks(data);
    } catch (err: any) {
      setError(err.message || "Failed to sync with API backend.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (task: Task) => {
    const nextStatus = task.status === "done" ? "todo" : "done";
    try {
      const res = await fetch(`${apiBase}/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!res.ok) {
        throw new Error("Failed to toggle task status.");
      }

      await fetchTasks();
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`${apiBase}/tasks/${taskId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        throw new Error("Failed to delete task.");
      }

      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
      }
      await fetchTasks();
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
  };

  // Unified Save / Update / Create handler
  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      if (taskData.id) {
        // Update mode
        const res = await fetch(`${apiBase}/tasks/${taskData.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskData)
        });

        if (!res.ok) {
          throw new Error("Failed to update task.");
        }
      } else {
        // Create mode
        const res = await fetch(`${apiBase}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: DEFAULT_USER_ID,
            title: taskData.title,
            category: taskData.category,
            deadline: taskData.deadline,
            estimated_effort: Number(taskData.estimated_effort),
            importance: Number(taskData.importance),
            explanation: taskData.explanation || "Created via unified planner."
          })
        });

        if (!res.ok) {
          throw new Error("Failed to create task.");
        }
      }

      await fetchTasks();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save task details.");
    }
  };

  // AI NLP Parser handler
  const handleParseNLP = async (text: string) => {
    const res = await fetch(`${apiBase}/parse-task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!res.ok) {
      throw new Error("AI was unable to parse this instruction. Please try again with simple wording.");
    }

    return await res.json();
  };

  const handleNavigateWeek = (direction: "prev" | "next" | "today") => {
    setCurrentDate((prev) => {
      const copy = new Date(prev);
      if (direction === "today") {
        return new Date();
      }
      const multiplier = direction === "prev" ? -1 : 1;
      
      if (calendarMode === "day") {
        copy.setDate(copy.getDate() + multiplier);
      } else if (calendarMode === "week") {
        copy.setDate(copy.getDate() + (multiplier * 7));
      } else if (calendarMode === "month") {
        copy.setMonth(copy.getMonth() + multiplier);
      }
      return copy;
    });
  };

  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    setModalDefaultDate(null);
    setIsModalOpen(true);
  };

  const handleAddNewTask = () => {
    setSelectedTask(null);
    setModalDefaultDate(null);
    setIsModalOpen(true);
  };

  const handleAddTaskOnDate = (date: Date) => {
    setSelectedTask(null);
    setModalDefaultDate(date);
    setIsModalOpen(true);
  };

  const handleLinkGoogleResource = async (taskId: string, resourceType: "event" | "meet" | "drive", resourceData: any) => {
    try {
      const updates: any = {};
      if (resourceType === "event") {
        updates.google_event_id = resourceData;
      } else if (resourceType === "meet") {
        updates.google_meet_link = resourceData;
      } else if (resourceType === "drive") {
        updates.google_drive_attachment = resourceData;
      }

      const res = await fetch(`${apiBase}/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });

      if (!res.ok) {
        throw new Error("Failed to link Google Workspace resource to task.");
      }

      await fetchTasks();
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <div className="min-h-screen bg-[#f1f3f6] text-[#3c3029] flex antialiased" id="momentum-root">
      
      {/* 1. Left Vertical SaaS Rail (Exactly styled as the screenshot!) */}
      <aside className="w-16 bg-[#1e1b24] text-stone-400 flex flex-col items-center py-5 justify-between select-none shrink-0" id="visual-rail">
        <div className="flex flex-col items-center space-y-6">
          {/* Logo / Sparkle Circle */}
          <div className="w-10 h-10 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-lg shadow-violet-950/20 mb-2">
            <Compass className="w-5 h-5 animate-pulse" />
          </div>

          {/* Navigation icons (SaaS lookalike) */}
          <div className="flex flex-col space-y-5">
            <button
              onClick={() => setCurrentView("planner")}
              className={`flex flex-col items-center space-y-1 group cursor-pointer transition-all ${
                currentView === "planner" ? "text-[#bd6443]" : "text-stone-400 hover:text-stone-200"
              }`}
              id="nav-planner-btn"
            >
              <Clock className="w-5 h-5" />
              <span className="text-[9px] font-mono tracking-wider font-bold">PLANNER</span>
            </button>
            <button
              onClick={() => setCurrentView("workspace")}
              className={`flex flex-col items-center space-y-1 group cursor-pointer transition-all ${
                currentView === "workspace" ? "text-[#bd6443]" : "text-stone-400 hover:text-stone-200"
              }`}
              id="nav-workspace-btn"
            >
              <Briefcase className="w-5 h-5" />
              <span className="text-[9px] font-mono tracking-wider font-bold">WORKSPACE</span>
            </button>
            <button className="flex flex-col items-center space-y-1 group hover:text-stone-200 transition-colors cursor-pointer">
              <Users className="w-5 h-5" />
              <span className="text-[9px] font-mono tracking-wider">PEOPLE</span>
            </button>
            <button className="flex flex-col items-center space-y-1 group hover:text-stone-200 transition-colors cursor-pointer">
              <BarChart2 className="w-5 h-5" />
              <span className="text-[9px] font-mono tracking-wider">REPORTS</span>
            </button>
            <button className="flex flex-col items-center space-y-1 group hover:text-stone-200 transition-colors cursor-pointer">
              <DollarSign className="w-5 h-5" />
              <span className="text-[9px] font-mono tracking-wider">INVOICES</span>
            </button>
          </div>
        </div>

        {/* User profile dropdown lookalike */}
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-stone-600 to-stone-400 flex items-center justify-center text-white text-xs font-bold border border-stone-600">
            ME
          </div>
        </div>
      </aside>

      {/* 2. Main content block to the right of vertical rail */}
      <div className="flex-1 flex flex-col min-w-0" id="main-content-wrapper">
        
        {/* Top bar header */}
        <header className="border-b border-[#e6dfd5] bg-white px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4" id="header">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#f5eade] text-[#bd6443] border border-[#f0dacd] rounded-xl" id="app-logo">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight text-[#3c3029]">Momentum</span>
                <span className="text-[9px] font-mono font-bold bg-[#f5eade] border border-[#f0dacd] text-[#bd6443] px-1.5 py-0.5 rounded-full uppercase">
                  Workspace Core
                </span>
              </div>
              <p className="text-xs text-[#85766d]">Intelligent Productivity Companion & Autonomous Task Dispatcher</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs" id="header-user-status">
            <div className="inline-flex rounded-lg border border-[#e6dfd5] p-0.5 bg-[#f5f2eb]">
              <button className="px-3 py-1 text-xs font-semibold bg-[#3c3029] text-white rounded shadow-sm">Solo</button>
              <button className="px-3 py-1 text-xs font-semibold text-[#85766d] hover:text-[#3c3029] rounded">Company</button>
            </div>
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-50 border border-[#e6dfd5] rounded-xl text-[#3c3029] font-bold">
              <span>me@momentum.corp</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#85766d]" />
            </div>
          </div>
        </header>

        {/* Scrollable container of workspace */}
        <div className="flex-1 p-6 flex flex-col space-y-6 overflow-y-auto" id="main-scrollable-area">
          
          {error && (
            <div className="p-4 bg-[#fdf2f2] border border-[#fbd5d5] rounded-xl flex items-start space-x-3 text-[#9b1c1c] text-sm animate-fade-in" id="error-banner">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-[#7b1b1b]">Sync Warning</h4>
                <p className="text-xs text-[#9b1c1c]/80 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-xs underline hover:text-[#7b1b1b] font-mono cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Unified Week Planner + Sidebar layout OR Google Workspace Hub */}
          {currentView === "planner" ? (
            <div className="flex flex-col lg:flex-row gap-6 items-stretch flex-1" id="planner-layout-grid">
              
              {/* Weekly calendar schedule view (Takes rest of the space) */}
              <WeeklyCalendar
                tasks={tasks}
                onSelectTask={handleSelectTask}
                onAddTaskOnDate={handleAddTaskOnDate}
                currentDate={currentDate}
                onNavigateWeek={handleNavigateWeek}
                calendarMode={calendarMode}
                onCalendarModeChange={setCalendarMode}
              />

              {/* Side Task Panel (Takes ~320px width) */}
              <TaskSidebar
                tasks={tasks}
                onSelectTask={handleSelectTask}
                onToggleStatus={handleToggleStatus}
                onAddNewTask={handleAddNewTask}
                selectedTaskId={selectedTask?.id}
              />

            </div>
          ) : (
            <GoogleWorkspacePanel
              tasks={tasks}
              onRefreshTasks={fetchTasks}
              onLinkGoogleResource={handleLinkGoogleResource}
            />
          )}
        </div>

        {/* Footer Bar */}
        <footer className="border-t border-[#e6dfd5] bg-white/70 py-4 px-6 text-xs text-[#85766d] font-mono" id="footer">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1.5 text-[#5e7d5a]" id="connection-indicator">
                <Wifi className="w-4 h-4 animate-pulse" />
                <span>Port 3000 Active</span>
              </div>
              <div className="h-4 w-px bg-[#e6dfd5] hidden md:block" />
              <div className="text-[#6e5d53] hidden md:block">
                API Base: <span className="text-[#bd6443] font-semibold">{apiBase}</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[#6e5d53] text-center md:text-right">
              <span className="flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#5e7d5a]" />
                <span>Formula: Score = Urgency * Importance + Postponements * 2</span>
              </span>
              <span>&copy; {new Date().getFullYear()} Momentum Corp. All Rights Reserved.</span>
            </div>
          </div>
        </footer>

      </div>

      {/* 3. Task Inspector & Creator Dialog Modal (Floating Card Popover EXACTLY matching the screenshot!) */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        task={selectedTask}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        onParseNLP={handleParseNLP}
        defaultDate={modalDefaultDate}
      />

    </div>
  );
}
