import React, { useState, useEffect } from "react";
import { Task } from "../types";
import {
  X,
  Sparkles,
  Shield,
  ShieldCheck,
  ShieldAlert,
  CalendarRange,
  RefreshCcw,
  Check,
  Trash2,
  AlertTriangle,
  Play,
  Hourglass,
  Sliders,
  Calendar,
  Layers,
  Award
} from "lucide-react";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null; // Null means we are creating a new task
  onSave: (taskData: Partial<Task>) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
  onParseNLP: (text: string) => Promise<any>;
  defaultDate?: Date | null;
}

export default function TaskModal({
  isOpen,
  onClose,
  task,
  onSave,
  onDelete,
  onParseNLP,
  defaultDate
}: TaskModalProps) {
  // Parsing states
  const [rawText, setRawText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Field states
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("coding");
  const [effort, setEffort] = useState(60); // in minutes
  const [importance, setImportance] = useState(3);
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState("todo");
  const [postponements, setPostponements] = useState(0);
  const [explanation, setExplanation] = useState("");

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "autonomous">("details");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isActionExecuting, setIsActionExecuting] = useState<string | null>(null);

  // Initialize fields on task load
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setCategory(task.category || "coding");
      setEffort(task.calibrated_effort || task.estimated_effort || 60);
      setImportance(task.importance || 3);
      setDeadline(
        task.deadline
          ? new Date(task.deadline).toISOString().slice(0, 16)
          : ""
      );
      setStatus(task.status || "todo");
      setPostponements(task.postponements || 0);
      setExplanation(task.explanation || "");
      setRawText("");
      setParseError(null);
      setActiveTab("details");
    } else {
      // Create mode
      setTitle("");
      setCategory("coding");
      setEffort(60);
      setImportance(3);
      setDeadline(
        defaultDate
          ? new Date(defaultDate.setHours(12, 0, 0, 0)).toISOString().slice(0, 16)
          : new Date().toISOString().slice(0, 16)
      );
      setStatus("todo");
      setPostponements(0);
      setExplanation("");
      setRawText("");
      setParseError(null);
      setActiveTab("details");
    }
  }, [task, defaultDate, isOpen]);

  if (!isOpen) return null;

  // Handle NLP text parsing
  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    setIsParsing(true);
    setParseError(null);

    try {
      const parsed = await onParseNLP(rawText);
      if (parsed) {
        setTitle(parsed.title || "");
        setCategory(parsed.category || "coding");
        setEffort(parsed.estimated_effort || 60);
        setImportance(parsed.importance || 3);
        setExplanation(parsed.explanation || "");
        if (parsed.deadline) {
          setDeadline(new Date(parsed.deadline).toISOString().slice(0, 16));
        }
      }
    } catch (err: any) {
      setParseError(err?.message || "AI was unable to parse this command. Please refine your phrasing.");
    } finally {
      setIsParsing(false);
    }
  };

  // Quick increment logged time (to match logged time box in the screenshot!)
  const handleAddLogTime = (mins: number) => {
    setEffort((prev) => Math.max(0, prev + mins));
    triggerToast(`Added ${mins} minutes to planned time.`);
  };

  // Action executor for autonomous simulation
  const executeAutonomousAction = async (type: string, message: string) => {
    setIsActionExecuting(type);
    await new Promise((resolve) => setTimeout(resolve, 1400));
    setIsActionExecuting(null);
    triggerToast(message);
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handlePostpone = () => {
    setPostponements((prev) => prev + 1);
    executeAutonomousAction("postpone", "Postponed! Calibration score re-indexed +2 penalty points.");
  };

  // Submit Task Save
  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await onSave({
        id: task?.id,
        title,
        category,
        estimated_effort: effort,
        calibrated_effort: effort + postponements * 10, // penalty offset
        importance,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        status,
        postponements,
        explanation: explanation || "Created / edited in the unified Workspace manager.",
        google_event_id: task?.google_event_id,
        google_meet_link: task?.google_meet_link,
        google_drive_attachment: task?.google_drive_attachment
      });
      onClose();
    } catch (err) {
      console.error("Save error", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete task
  const handleDelete = async () => {
    if (!task || !onDelete) return;
    if (window.confirm("Are you sure you want to permanently delete this task?")) {
      await onDelete(task.id);
      onClose();
    }
  };

  const isTierA_Default = category.toLowerCase() !== "financial" && importance < 5;

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case "coding": return "bg-[#51a179]";
      case "writing": return "bg-[#78629f]";
      case "calls": return "bg-[#a0525d]";
      case "financial": return "bg-[#c88452]";
      case "social": return "bg-[#4f6ea3]";
      case "admin":
      default: return "bg-[#3c9b74]";
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto" id="task-modal-backdrop">
      <div className="bg-white rounded-3xl border border-[#e6dfd5] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col relative animate-fade-in" id="task-modal-card">
        
        {/* Modal Top Control Bar */}
        <div className="p-4 border-b border-[#e6dfd5] bg-stone-50/50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`w-3.5 h-3.5 rounded ${getCategoryColor(category)}`} />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#85766d]">
              {task ? "Edit Task" : "A/B test lead generation forms"}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {task && onDelete && (
              <button
                onClick={handleDelete}
                className="p-1.5 hover:bg-[#fbf0f1] hover:text-[#a0525d] text-[#85766d] border border-transparent hover:border-[#ebd4d8] rounded-lg transition-colors cursor-pointer"
                title="Delete Task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-stone-100 rounded-lg text-[#85766d] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* NLP Parsing Mode Input (for Creating New Tasks) */}
        {!task && (
          <div className="p-5 bg-[#faf8f5] border-b border-[#e6dfd5] flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold font-mono text-[#85766d] uppercase flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#bd6443]" />
                <span>AI NLP Parser Core</span>
              </h3>
              <span className="text-[10px] bg-[#fdf0e8] text-[#bd6443] border border-[#f0dacd] px-2 py-0.5 rounded-full font-semibold">
                Natural Language Intake
              </span>
            </div>
            <form onSubmit={handleParse} className="flex gap-2.5">
              <input
                type="text"
                className="flex-1 p-2.5 text-xs bg-white rounded-xl border border-[#e6dfd5] text-[#3c3029] placeholder-[#a8998e] focus:outline-none focus:border-[#cb724e] focus:ring-1 focus:ring-[#cb724e]"
                placeholder="e.g., Draft pitch deck tomorrow at 2pm, importance 4, takes 90 mins"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
              <button
                type="submit"
                disabled={isParsing || !rawText.trim()}
                className="py-2.5 px-4 rounded-xl font-bold text-xs bg-[#cb724e] hover:bg-[#b8613f] text-white disabled:opacity-50 cursor-pointer shadow-sm transition-all shrink-0"
              >
                {isParsing ? "Parsing..." : "Parse"}
              </button>
            </form>
            {parseError && (
              <div className="p-2.5 bg-red-50 border border-red-100 rounded-xl text-red-700 text-[10px] flex items-start space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-[#e6dfd5] bg-stone-50/30">
          <button
            onClick={() => setActiveTab("details")}
            className={`flex-1 py-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "details"
                ? "border-[#cb724e] text-[#cb724e] bg-white"
                : "border-transparent text-[#85766d] hover:text-[#3c3029]"
            }`}
          >
            <Sliders className="w-3.5 h-3.5 inline mr-1.5" />
            Task Details
          </button>
          <button
            onClick={() => setActiveTab("autonomous")}
            className={`flex-1 py-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "autonomous"
                ? "border-[#cb724e] text-[#cb724e] bg-white"
                : "border-transparent text-[#85766d] hover:text-[#3c3029]"
            }`}
          >
            <Shield className="w-3.5 h-3.5 inline mr-1.5" />
            AI Autonomous Hub
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-6 overflow-y-auto max-h-[420px] space-y-5" id="modal-fields-container">
          {activeTab === "details" ? (
            <>
              {/* Task Title Input */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono uppercase text-[#85766d] tracking-wider">
                  Task Title
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-[#faf8f5] rounded-xl border border-[#e6dfd5] text-[#3c3029] font-semibold text-sm focus:outline-none focus:border-[#cb724e] focus:bg-white transition-colors"
                  placeholder="e.g., Edit blog posts"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Grid 2-cols: Category & Deadline */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono uppercase text-[#85766d] tracking-wider">
                    Category
                  </label>
                  <select
                    className="w-full p-2.5 bg-[#faf8f5] rounded-xl border border-[#e6dfd5] text-[#3c3029] font-medium text-xs focus:outline-none focus:border-[#cb724e] focus:bg-white transition-colors capitalize"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="coding">Coding</option>
                    <option value="writing">Writing</option>
                    <option value="calls">Calls</option>
                    <option value="financial">Financial</option>
                    <option value="social">Social</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono uppercase text-[#85766d] tracking-wider">
                    Deadline Date
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full p-2.5 bg-[#faf8f5] rounded-xl border border-[#e6dfd5] text-[#3c3029] font-medium text-xs focus:outline-none focus:border-[#cb724e] focus:bg-white transition-colors"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              </div>

              {/* Time Logging Header Bar (EXACTLY MATCHES THE SCREENSHOT'S BEAUTIFUL PURPLE BAR!) */}
              <div className="rounded-2xl bg-[#78629f] text-white p-4.5 flex items-center justify-between shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono uppercase opacity-75">Planned Duration</span>
                  <span className="text-lg font-bold">
                    {Math.floor(effort / 60)}h {effort % 60}m
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleAddLogTime(15)}
                    className="px-2.5 py-1 text-xs font-mono font-bold bg-white/15 hover:bg-white/25 rounded-md transition-all cursor-pointer"
                  >
                    +15m
                  </button>
                  <button
                    onClick={() => handleAddLogTime(30)}
                    className="px-2.5 py-1 text-xs font-mono font-bold bg-white/15 hover:bg-white/25 rounded-md transition-all cursor-pointer"
                  >
                    +30m
                  </button>
                  <button
                    onClick={() => handleAddLogTime(60)}
                    className="px-2.5 py-1 text-xs font-mono font-bold bg-white/15 hover:bg-white/25 rounded-md transition-all cursor-pointer"
                  >
                    +1h
                  </button>
                </div>
              </div>

              {/* Importance Rating & Status picker */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono uppercase text-[#85766d] tracking-wider">
                    Importance ({importance}/5)
                  </label>
                  <div className="flex items-center justify-between bg-[#faf8f5] border border-[#e6dfd5] rounded-xl px-2.5 h-[38px]">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setImportance(val)}
                        className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all ${
                          importance >= val
                            ? "bg-[#cb724e] text-white shadow-sm"
                            : "text-[#85766d] hover:bg-stone-200"
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono uppercase text-[#85766d] tracking-wider">
                    Task Status
                  </label>
                  <select
                    className="w-full p-2.5 bg-[#faf8f5] rounded-xl border border-[#e6dfd5] text-[#3c3029] font-medium text-xs focus:outline-none focus:border-[#cb724e] focus:bg-white transition-colors"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="todo">Active Queue (Todo)</option>
                    <option value="done">Completed (Done)</option>
                  </select>
                </div>
              </div>

              {/* AI Explanation of scheduling */}
              {explanation && (
                <div className="p-3 bg-[#eef3eb] border border-[#cbd8c6] rounded-xl">
                  <span className="text-[10px] font-mono text-[#425d45] uppercase font-bold flex items-center mb-1">
                    <Award className="w-3.5 h-3.5 mr-1" />
                    AI Reasoning & Description
                  </span>
                  <p className="text-xs text-[#425d45] leading-relaxed italic">{explanation}</p>
                </div>
              )}

              {/* Google Workspace attachments & integrations inside Modal details */}
              {(task?.google_event_id || task?.google_meet_link || task?.google_drive_attachment) && (
                <div className="p-4 bg-violet-50/40 border border-violet-100 rounded-2xl space-y-2.5" id={`modal-google-hub-${task.id}`}>
                  <span className="text-[10px] font-mono text-violet-700 uppercase font-bold tracking-wider">
                    ⚡ Connected Google Workspace Resources
                  </span>
                  <div className="space-y-2">
                    {task.google_event_id && (
                      <div className="flex items-center justify-between text-xs text-stone-700 bg-white p-2.5 rounded-xl border border-stone-200">
                        <span className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="font-semibold">Google Calendar Event</span>
                        </span>
                        <span className="text-[10px] font-mono text-stone-400 truncate max-w-[180px]">ID: {task.google_event_id}</span>
                      </div>
                    )}
                    {task.google_meet_link && (
                      <div className="flex items-center justify-between text-xs text-stone-700 bg-white p-2.5 rounded-xl border border-stone-200">
                        <span className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="font-semibold">Google Meet Video Link</span>
                        </span>
                        <a href={task.google_meet_link} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] transition-colors cursor-pointer">
                          Join Call
                        </a>
                      </div>
                    )}
                    {task.google_drive_attachment && (
                      <div className="flex items-center justify-between text-xs text-stone-700 bg-white p-2.5 rounded-xl border border-stone-200">
                        <span className="flex items-center space-x-2 min-w-0 flex-1 mr-2">
                          <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                          <span className="font-semibold truncate">Drive File: {task.google_drive_attachment.name}</span>
                        </span>
                        <a href={task.google_drive_attachment.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-bold text-[10px] transition-colors shrink-0 cursor-pointer">
                          Open File
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Permission Tier Panel */}
              <div className="p-4.5 rounded-2xl border border-[#e6dfd5] bg-[#faf8f5] flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-[#85766d] font-bold">
                    Permission Access Level
                  </span>
                  {isTierA_Default ? (
                    <div className="flex items-center space-x-1.5 text-xs text-[#425d45] bg-[#eef3eb] px-2.5 py-1 rounded-full border border-[#cbd8c6] font-bold font-mono">
                      <ShieldCheck className="w-4 h-4" />
                      <span>TIER A: AUTONOMOUS</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 text-xs text-[#a0525d] bg-[#fbf0f1] px-2.5 py-1 rounded-full border border-[#ebd4d8] font-bold font-mono">
                      <ShieldAlert className="w-4 h-4" />
                      <span>TIER B: APPROVAL REQUIRED</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-[#6e5d53] leading-relaxed">
                  {isTierA_Default
                    ? "Momentum has secure clearance to autonomously pre-stage outline files, block focus sessions, and queue up related workflows."
                    : "Due to high-priority criteria, manual user authorization (Tier B) is required prior to external system execution."}
                </p>
              </div>

              {/* Task Sandbox Info Grid */}
              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div className="p-3 rounded-xl border border-stone-200 bg-[#fafcfb] flex flex-col justify-between">
                  <span className="text-[#85766d] font-mono text-[9px] uppercase font-bold">Postponements</span>
                  <span className="text-[#3c3029] font-bold font-mono text-sm mt-1">
                    {postponements} times
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-stone-200 bg-[#fafcfb] flex flex-col justify-between">
                  <span className="text-[#85766d] font-mono text-[9px] uppercase font-bold">Risk Classification</span>
                  <span className="text-[#a0525d] font-bold font-mono text-sm mt-1">
                    {isTierA_Default ? "Low-Risk Action" : "Escalated Scope"}
                  </span>
                </div>
              </div>

              {/* Sandbox Actions */}
              <div className="space-y-2.5 pt-2">
                <span className="text-[10px] font-mono uppercase text-[#85766d] font-bold block">
                  Simulate Autonomous Integrations
                </span>

                <button
                  type="button"
                  onClick={() => executeAutonomousAction("outline", `Successfully generated draft outline layout for '${title}'!`)}
                  disabled={isActionExecuting !== null}
                  className="w-full py-2.5 px-3.5 rounded-xl border border-[#e6dfd5] hover:border-[#cb724e]/30 bg-white hover:bg-[#faf6f0] text-[#50443c] hover:text-[#bd6443] transition-all text-xs flex items-center justify-between cursor-pointer shadow-sm"
                >
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-[#cb724e] animate-pulse" />
                    <span className="font-semibold">Pre-stage Outline & Checklists</span>
                  </div>
                  {isActionExecuting === "outline" ? (
                    <span className="text-[10px] font-mono text-[#cb724e] animate-pulse">Processing...</span>
                  ) : (
                    <span className="text-[10px] font-mono text-[#85766d]">Tier A (No-Prompt)</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => executeAutonomousAction("schedule", `Committed 60m focus calendar block for '${title}'!`)}
                  disabled={isActionExecuting !== null}
                  className="w-full py-2.5 px-3.5 rounded-xl border border-[#e6dfd5] hover:border-[#cb724e]/30 bg-white hover:bg-[#faf6f0] text-[#50443c] hover:text-[#bd6443] transition-all text-xs flex items-center justify-between cursor-pointer shadow-sm"
                >
                  <div className="flex items-center space-x-2">
                    <CalendarRange className="w-4 h-4 text-[#cb724e]" />
                    <span className="font-semibold">Schedule Ideal Work Block</span>
                  </div>
                  {isActionExecuting === "schedule" ? (
                    <span className="text-[10px] font-mono text-[#cb724e] animate-pulse">Scheduling...</span>
                  ) : (
                    <span className="text-[10px] font-mono text-[#85766d]">Tier A (No-Prompt)</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handlePostpone}
                  disabled={isActionExecuting !== null}
                  className="w-full py-2.5 px-3.5 rounded-xl border border-[#e6dfd5] hover:border-[#cb724e]/30 bg-white hover:bg-[#faf6f0] text-[#50443c] hover:text-[#bd6443] transition-all text-xs flex items-center justify-between cursor-pointer shadow-sm"
                >
                  <div className="flex items-center space-x-2">
                    <RefreshCcw className="w-4 h-4 text-[#cb724e]" />
                    <span className="font-semibold">Postpone / Re-prioritize Task</span>
                  </div>
                  <span className="text-[10px] font-mono text-red-600 font-semibold">+2 penalty offset</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-[#e6dfd5] bg-stone-50/50 flex items-center justify-end space-x-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#85766d] hover:bg-stone-100 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !title.trim()}
            className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#5e7d5a] hover:bg-[#4d694a] text-white disabled:opacity-50 cursor-pointer shadow-sm transition-all"
          >
            {isSaving ? "Saving..." : task ? "Update Task" : "Submit & Complete Task"}
          </button>
        </div>

        {/* Internal Floating Toast Banner */}
        {toastMessage && (
          <div className="absolute bottom-4 left-4 right-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[#425d45] text-xs font-mono text-center flex items-center justify-center space-x-2 shadow-lg animate-fade-in z-50">
            <Check className="w-4 h-4 text-[#5e7d5a]" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
        )}

      </div>
    </div>
  );
}
