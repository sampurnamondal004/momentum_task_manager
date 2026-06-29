import React, { useState } from "react";
import { Task } from "../types";
import { Plus, CheckSquare, Square, Calendar, Clock, ChevronDown, ChevronRight, MoreHorizontal, Video, Paperclip } from "lucide-react";

interface TaskSidebarProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onToggleStatus: (task: Task) => void;
  onAddNewTask: () => void;
  selectedTaskId?: string;
}

export default function TaskSidebar({
  tasks,
  onSelectTask,
  onToggleStatus,
  onAddNewTask,
  selectedTaskId
}: TaskSidebarProps) {
  const [activeOpen, setActiveOpen] = useState(true);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);

  // Divide tasks
  const activeTasks = tasks.filter((t) => t.status === "todo");
  const completedTasks = tasks.filter((t) => t.status === "done");

  // Format date helper
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "No deadline";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Category colored square icon
  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "coding":
        return "bg-[#51a179]";
      case "writing":
        return "bg-[#78629f]";
      case "calls":
        return "bg-[#a0525d]";
      case "financial":
        return "bg-[#c88452]";
      case "social":
        return "bg-[#4f6ea3]";
      case "admin":
      default:
        return "bg-[#3c9b74]";
    }
  };

  // Get progress bar percentage
  const getProgressPercentage = (task: Task) => {
    // Dynamic calculation: Higher importance and lower postponements gives better readiness score
    const importancePercent = (task.importance / 5) * 100;
    const postponementPenalty = Math.max(0, 100 - task.postponements * 20);
    return Math.round((importancePercent + postponementPenalty) / 2);
  };

  const getProgressBarColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "coding":
        return "bg-[#51a179]";
      case "writing":
        return "bg-[#78629f]";
      case "calls":
        return "bg-[#a0525d]";
      case "financial":
        return "bg-[#c88452]";
      case "social":
        return "bg-[#4f6ea3]";
      case "admin":
      default:
        return "bg-[#3c9b74]";
    }
  };

  return (
    <div className="w-full lg:w-80 flex flex-col bg-white border border-[#e6dfd5] rounded-2xl shadow-sm overflow-hidden" id="task-sidebar">
      {/* Header */}
      <div className="p-4 border-b border-[#e6dfd5] bg-stone-50/50 flex items-center justify-between" id="sidebar-header">
        <h2 className="text-sm font-bold text-[#3c3029]">Tasks</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={onAddNewTask}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold bg-[#cb724e] text-white hover:bg-[#b8613f] rounded-lg shadow-sm transition-all cursor-pointer"
            id="sidebar-new-task-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>
          <button className="p-1 hover:bg-[#faf8f5] border border-transparent hover:border-[#e6dfd5] rounded-lg text-[#85766d] cursor-pointer">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Accordions */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" id="sidebar-scroll-container">
        {/* Active Section */}
        <div>
          <button
            onClick={() => setActiveOpen(!activeOpen)}
            className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#85766d] hover:text-[#3c3029] mb-2 font-mono"
          >
            <span className="flex items-center space-x-1">
              <span>Active</span>
              <span className="text-[10px] bg-[#f5eade] text-[#bd6443] px-1.5 py-0.5 rounded-full">
                {activeTasks.length}
              </span>
            </span>
            {activeOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {activeOpen && (
            <div className="space-y-3" id="active-tasks-list">
              {activeTasks.length === 0 ? (
                <div className="text-center py-4 text-xs text-[#b0a297] border border-dashed border-[#e6dfd5] rounded-xl">
                  No active tasks.
                </div>
              ) : (
                activeTasks.map((task) => {
                  const isSelected = selectedTaskId === task.id;
                  const progress = getProgressPercentage(task);
                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col space-y-2 ${
                        isSelected
                          ? "bg-[#fdf0e8]/60 border-[#cb724e] shadow-sm"
                          : "bg-white border-stone-200/80 hover:border-[#cb724e]/50 hover:bg-[#faf8f5]/20"
                      }`}
                    >
                      {/* Top Row: Category dot, client info, deadline */}
                      <div className="flex items-center justify-between text-[10px] text-[#85766d] font-mono">
                        <div className="flex items-center space-x-1.5">
                          <span className={`w-2.5 h-2.5 rounded ${getCategoryColor(task.category)}`} />
                          <span className="capitalize">{task.category}</span>
                        </div>
                        <span className="flex items-center space-x-1 text-[9px]">
                          <Calendar className="w-3 h-3 text-[#b0a297]" />
                          <span>{formatDate(task.deadline)}</span>
                        </span>
                      </div>

                      {/* Middle Row: Checkbox + Title */}
                      <div className="flex items-start space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleStatus(task);
                          }}
                          className="mt-0.5 text-[#b0a297] hover:text-[#cb724e] transition-colors shrink-0"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-bold text-[#3c3029] leading-tight flex-1 line-clamp-2">
                          {task.title}
                        </span>
                      </div>

                      {/* Google linkage badges */}
                      {(task.google_event_id || task.google_meet_link || task.google_drive_attachment) && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5" id={`google-badges-${task.id}`}>
                          {task.google_event_id && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-md text-[9px] font-semibold font-mono" id={`google-cal-badge-${task.id}`}>
                              <Calendar className="w-2.5 h-2.5" />
                              <span>Synced</span>
                            </span>
                          )}
                          {task.google_meet_link && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-md text-[9px] font-semibold font-mono" onClick={(e) => e.stopPropagation()} id={`google-meet-badge-${task.id}`}>
                              <Video className="w-2.5 h-2.5" />
                              <a href={task.google_meet_link} target="_blank" rel="noopener noreferrer" className="hover:underline">Meet Call</a>
                            </span>
                          )}
                          {task.google_drive_attachment && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-violet-50 text-violet-600 border border-violet-100 rounded-md text-[9px] font-semibold font-mono" onClick={(e) => e.stopPropagation()} id={`google-drive-badge-${task.id}`}>
                              <Paperclip className="w-2.5 h-2.5" />
                              <a href={task.google_drive_attachment.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[90px]" title={task.google_drive_attachment.name}>{task.google_drive_attachment.name}</a>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Progress Bar (Matches the progress bar styling from the screenshot perfectly!) */}
                      <div className="space-y-1 pt-1">
                        <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getProgressBarColor(task.category)}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Completed Section */}
        <div>
          <button
            onClick={() => setCompletedOpen(!completedOpen)}
            className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#85766d] hover:text-[#3c3029] mb-2 font-mono"
          >
            <span className="flex items-center space-x-1">
              <span>Completed</span>
              <span className="text-[10px] bg-stone-100 text-[#85766d] px-1.5 py-0.5 rounded-full">
                {completedTasks.length}
              </span>
            </span>
            {completedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {completedOpen && (
            <div className="space-y-3" id="completed-tasks-list">
              {completedTasks.length === 0 ? (
                <div className="text-center py-4 text-xs text-[#b0a297] border border-dashed border-[#e6dfd5] rounded-xl">
                  No completed tasks yet.
                </div>
              ) : (
                completedTasks.map((task) => {
                  const isSelected = selectedTaskId === task.id;
                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col space-y-2 bg-[#fdfdfd]/80 opacity-60 line-through ${
                        isSelected
                          ? "border-[#cb724e]"
                          : "border-stone-150"
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleStatus(task);
                          }}
                          className="mt-0.5 text-[#5e7d5a] shrink-0"
                        >
                          <CheckSquare className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-semibold text-stone-500 leading-tight flex-1 line-clamp-2">
                          {task.title}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
