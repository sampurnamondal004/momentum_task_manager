import React from "react";
import { Task } from "../types";
import { Clock, DollarSign, Plus } from "lucide-react";

interface WeeklyCalendarProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onAddTaskOnDate: (date: Date) => void;
  currentDate: Date;
  onNavigateWeek: (direction: "prev" | "next" | "today") => void;
  calendarMode: "day" | "week" | "month";
  onCalendarModeChange: (mode: "day" | "week" | "month") => void;
}

export default function WeeklyCalendar({
  tasks,
  onSelectTask,
  onAddTaskOnDate,
  currentDate,
  onNavigateWeek,
  calendarMode,
  onCalendarModeChange
}: WeeklyCalendarProps) {
  // Get Monday of the current week
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const startOfWeek = getMonday(currentDate);

  // Generate 7 days of the week (Monday to Sunday)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    return day;
  });

  // Format date range for the header
  const formatDateRange = () => {
    if (calendarMode === "day") {
      return currentDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    if (calendarMode === "month") {
      return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }

    // Week mode
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startMonth = startOfWeek.toLocaleDateString("en-US", { month: "short" });
    const startDay = startOfWeek.getDate();
    const endMonth = endOfWeek.toLocaleDateString("en-US", { month: "short" });
    const endDay = endOfWeek.getDate();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  };

  // Check if a task falls on a specific day
  const getTasksForDay = (day: Date) => {
    return tasks.filter((task) => {
      if (!task.deadline) return false;
      const taskDate = new Date(task.deadline);
      return (
        taskDate.getFullYear() === day.getFullYear() &&
        taskDate.getMonth() === day.getMonth() &&
        taskDate.getDate() === day.getDate()
      );
    });
  };

  // Hourly rate for earnings display (to match the screenshot's financial stats!)
  const HOURLY_RATE = 30; // $30/hr

  // Calculate day total stats (hours and simulated earnings)
  const getDayStats = (dayTasks: Task[]) => {
    const totalMins = dayTasks.reduce((acc, t) => acc + (t.calibrated_effort || 30), 0);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const earnings = (totalMins / 60) * HOURLY_RATE;

    let timeStr = "";
    if (hours > 0) {
      timeStr += `${hours}h `;
    }
    if (mins > 0 || hours === 0) {
      timeStr += `${mins}m`;
    }

    return {
      timeStr,
      earnings: earnings > 0 ? `$${earnings.toFixed(2)}` : null,
      totalMins
    };
  };

  // Get task color block classes to match screenshot perfectly
  const getTaskBlockStyles = (category: string, isCompleted: boolean) => {
    const base = "p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between h-28 relative shadow-sm";
    
    if (isCompleted) {
      return `${base} bg-[#f5f6f8] border-stone-200/80 text-stone-400 opacity-60 line-through`;
    }

    switch (category.toLowerCase()) {
      case "coding":
        return `${base} bg-[#51a179] hover:bg-[#46916c] border-[#46916c]/30 text-white`;
      case "writing":
        return `${base} bg-[#78629f] hover:bg-[#6c5691] border-[#6c5691]/30 text-white`;
      case "calls":
        return `${base} bg-[#a0525d] hover:bg-[#914651] border-[#914651]/30 text-white`;
      case "financial":
        return `${base} bg-[#c88452] hover:bg-[#b87543] border-[#b87543]/30 text-white`;
      case "social":
        return `${base} bg-[#4f6ea3] hover:bg-[#425e91] border-[#425e91]/30 text-white`;
      case "admin":
      default:
        return `${base} bg-[#3c9b74] hover:bg-[#328763] border-[#328763]/30 text-white`;
    }
  };

  // Generate 42 days for the Month grid (6 rows of 7 columns)
  const getMonthGridDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay();
    // Adjust to Monday-start layout (0: Mon, 1: Tue ... 6: Sun)
    const mondayAdjusted = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const startOfGrid = new Date(firstDayOfMonth);
    startOfGrid.setDate(firstDayOfMonth.getDate() - mondayAdjusted);

    return Array.from({ length: 42 }, (_, i) => {
      const day = new Date(startOfGrid);
      day.setDate(startOfGrid.getDate() + i);
      return day;
    });
  };

  return (
    <div className="flex flex-col flex-1 bg-[#f4f5f8] rounded-2xl border border-[#e6dfd5] shadow-sm overflow-hidden" id="weekly-calendar-card">
      {/* Top Controller Row */}
      <div className="flex flex-wrap items-center justify-between border-b border-[#e6dfd5] bg-white px-5 py-3.5 gap-4" id="calendar-controls">
        <div className="flex items-center space-x-2">
          {/* Active calendar mode selection tabs */}
          <div className="inline-flex rounded-lg border border-[#e6dfd5] p-0.5 bg-[#f5f2eb]">
            <button
              onClick={() => onCalendarModeChange("day")}
              className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer transition-all ${
                calendarMode === "day"
                  ? "bg-[#3c3029] text-white shadow-sm"
                  : "text-[#85766d] hover:text-[#3c3029]"
              }`}
            >
              Day
            </button>
            <button
              onClick={() => onCalendarModeChange("week")}
              className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer transition-all ${
                calendarMode === "week"
                  ? "bg-[#3c3029] text-white shadow-sm"
                  : "text-[#85766d] hover:text-[#3c3029]"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => onCalendarModeChange("month")}
              className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer transition-all ${
                calendarMode === "month"
                  ? "bg-[#3c3029] text-white shadow-sm"
                  : "text-[#85766d] hover:text-[#3c3029]"
              }`}
            >
              Month
            </button>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => onNavigateWeek("prev")}
              className="p-1.5 hover:bg-[#faf8f5] border border-[#e6dfd5] rounded-lg text-[#50443c] cursor-pointer"
            >
              &lt;
            </button>
            <span className="px-3 py-1 text-xs font-mono font-bold text-[#3c3029]">
              {formatDateRange()}
            </span>
            <button
              onClick={() => onNavigateWeek("next")}
              className="p-1.5 hover:bg-[#faf8f5] border border-[#e6dfd5] rounded-lg text-[#50443c] cursor-pointer"
            >
              &gt;
            </button>
          </div>

          <button
            onClick={() => onNavigateWeek("today")}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-[#e6dfd5] hover:bg-[#faf8f5] text-[#3c3029] rounded-lg shadow-sm cursor-pointer"
          >
            Today
          </button>
        </div>

        {/* Global Stats */}
        <div className="flex items-center space-x-4 text-xs font-mono text-[#6e5d53]">
          <div className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-[#bd6443]" />
            <span className="font-semibold text-[#3c3029]">
              {(() => {
                const totalMins = tasks.reduce((acc, t) => acc + (t.calibrated_effort || 30), 0);
                const hrs = Math.floor(totalMins / 60);
                const mins = totalMins % 60;
                return `${hrs}h ${mins}m`;
              })()}
            </span>
            <span className="text-[#85766d]">planned</span>
          </div>
          <div className="h-4 w-px bg-[#e6dfd5]" />
          <div className="flex items-center space-x-1">
            <DollarSign className="w-3.5 h-3.5 text-[#5e7d5a]" />
            <span className="font-semibold text-[#3c3029]">
              {(() => {
                const totalMins = tasks.reduce((acc, t) => acc + (t.calibrated_effort || 30), 0);
                return `$${((totalMins / 60) * HOURLY_RATE).toFixed(2)}`;
              })()}
            </span>
            <span className="text-[#85766d]">projected</span>
          </div>
        </div>
      </div>

      {/* RENDER MODE: DAY */}
      {calendarMode === "day" && (
        <div className="flex-1 bg-white flex flex-col overflow-y-auto" id="calendar-day-view">
          <div className="max-w-3xl mx-auto w-full p-6 space-y-6">
            {/* Day Header */}
            <div className="flex items-center justify-between border-b border-[#e6dfd5] pb-4">
              <div>
                <h2 className="text-xl font-bold text-[#3c3029]">
                  {currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h2>
                <p className="text-xs text-[#85766d]">
                  {(() => {
                    const dayTasks = getTasksForDay(currentDate);
                    const stats = getDayStats(dayTasks);
                    return `${dayTasks.length} task${dayTasks.length === 1 ? "" : "s"} scheduled — ${stats.timeStr} total effort`;
                  })()}
                </p>
              </div>
              <button
                onClick={() => onAddTaskOnDate(currentDate)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-[#bd6443] hover:bg-[#a65335] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Task</span>
              </button>
            </div>

            {/* Tasks List */}
            <div className="space-y-4">
              {(() => {
                const dayTasks = getTasksForDay(currentDate);
                if (dayTasks.length === 0) {
                  return (
                    <div
                      onClick={() => onAddTaskOnDate(currentDate)}
                      className="border-2 border-dashed border-[#e6dfd5] hover:border-[#bd6443] rounded-2xl p-12 text-center cursor-pointer bg-[#faf8f5]/30 hover:bg-[#faf8f5]/60 transition-all group flex flex-col items-center justify-center space-y-3"
                    >
                      <div className="p-3 rounded-full bg-stone-100 text-stone-400 group-hover:text-[#bd6443] transition-colors">
                        <Plus className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#3c3029]">No tasks planned for today</h4>
                        <p className="text-xs text-[#85766d] mt-1">Get a head start or schedule a new action item.</p>
                      </div>
                    </div>
                  );
                }

                return dayTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md flex items-center justify-between gap-4 ${
                      task.status === "done"
                        ? "bg-[#f5f6f8] border-stone-200/80 text-stone-400 opacity-60"
                        : "bg-white border-[#e6dfd5] shadow-sm hover:border-[#bd6443]/30"
                    }`}
                  >
                    <div className="flex items-center space-x-4 min-w-0">
                      {/* Left color bar */}
                      <div
                        className={`w-2.5 h-10 rounded-full shrink-0 ${
                          task.status === "done"
                            ? "bg-stone-300"
                            : task.category.toLowerCase() === "coding"
                            ? "bg-[#51a179]"
                            : task.category.toLowerCase() === "writing"
                            ? "bg-[#78629f]"
                            : task.category.toLowerCase() === "calls"
                            ? "bg-[#a0525d]"
                            : task.category.toLowerCase() === "financial"
                            ? "bg-[#c88452]"
                            : task.category.toLowerCase() === "social"
                            ? "bg-[#4f6ea3]"
                            : "bg-[#3c9b74]"
                        }`}
                      />
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#bd6443] font-bold">
                          {task.category}
                        </span>
                        <h3 className={`text-sm font-bold text-[#3c3029] truncate ${task.status === "done" ? "line-through text-stone-400" : ""}`}>
                          {task.title}
                        </h3>
                        {task.explanation && (
                          <p className="text-xs text-[#85766d] truncate max-w-md">
                            {task.explanation}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-6 shrink-0">
                      <span className="text-xs font-mono bg-[#f5eade] border border-[#f0dacd] text-[#bd6443] px-2.5 py-1 rounded-lg font-bold">
                        ★ {task.importance}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#3c3029] bg-stone-100 px-2.5 py-1 rounded-lg">
                        {task.calibrated_effort < 60
                          ? `${task.calibrated_effort}m`
                          : `${(task.calibrated_effort / 60).toFixed(1)}h`}
                      </span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* RENDER MODE: WEEK */}
      {calendarMode === "week" && (
        <div className="grid grid-cols-7 flex-1 divide-x divide-[#e6dfd5] bg-white overflow-x-auto min-w-[750px]" id="calendar-columns-grid">
          {weekDays.map((day, idx) => {
            const isToday = new Date().toDateString() === day.toDateString();
            const dayTasks = getTasksForDay(day);
            const stats = getDayStats(dayTasks);

            return (
              <div
                key={idx}
                className={`flex flex-col min-h-[500px] pb-6 ${
                  isToday ? "bg-[#fcfaf5]" : ""
                }`}
              >
                {/* Day Header */}
                <div className="p-4 border-b border-[#e6dfd5] bg-stone-50/50 flex flex-col space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isToday ? "text-[#bd6443]" : "text-[#50443c]"}`}>
                      {day.toLocaleDateString("en-US", { weekday: "short" })}, {day.getDate()}
                      {isToday && " (Today)"}
                    </span>
                    <button
                      onClick={() => onAddTaskOnDate(day)}
                      className="p-1 hover:bg-[#e6dfd5]/40 rounded text-[#85766d] hover:text-[#3c3029] transition-colors"
                      title="Add Task for this Day"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  {stats.totalMins > 0 ? (
                    <div className="flex flex-col text-[10px] font-mono text-[#85766d]">
                      <span className="font-semibold text-[#3c3029]">{stats.timeStr}</span>
                      {stats.earnings && <span className="text-[#5e7d5a]">{stats.earnings}</span>}
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono text-[#b0a297]">0h - $0.00</span>
                  )}
                </div>

                {/* Tasks List for Day */}
                <div className="flex-1 p-3.5 space-y-3.5 overflow-y-auto max-h-[480px]">
                  {dayTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className={getTaskBlockStyles(task.category, task.status === "done")}
                    >
                      {/* Block Content */}
                      <div className="flex flex-col space-y-1">
                        <span className="text-[9px] uppercase font-mono tracking-wider opacity-80">
                          {task.category}
                        </span>
                        <h3 className="text-xs font-bold leading-tight line-clamp-2">
                          {task.title}
                        </h3>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/10">
                        <span className="text-[9px] font-mono font-bold bg-white/15 px-1.5 py-0.5 rounded">
                          ★ {task.importance}
                        </span>
                        <span className="text-[10px] font-mono font-bold opacity-90">
                          {task.calibrated_effort < 60
                            ? `${task.calibrated_effort}m`
                            : `${(task.calibrated_effort / 60).toFixed(1)}h`}
                        </span>
                      </div>
                    </div>
                  ))}

                  {dayTasks.length === 0 && (
                    <div className="h-full min-h-[100px] border border-dashed border-[#e6dfd5] rounded-xl flex items-center justify-center bg-[#faf8f5]/20 hover:bg-[#faf8f5]/50 transition-colors cursor-pointer group" onClick={() => onAddTaskOnDate(day)}>
                      <Plus className="w-4 h-4 text-[#b0a297] group-hover:text-[#bd6443] transition-colors" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RENDER MODE: MONTH */}
      {calendarMode === "month" && (
        <div className="flex-1 flex flex-col bg-white overflow-hidden" id="calendar-month-view">
          {/* Weekday Labels Header */}
          <div className="grid grid-cols-7 bg-stone-50 border-b border-[#e6dfd5] text-center py-2 shrink-0">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
              <span key={label} className="text-xs font-bold text-[#50443c] font-mono">
                {label}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 grid-rows-6 flex-1 divide-x divide-y divide-[#e6dfd5] border-b border-[#e6dfd5] overflow-y-auto">
            {getMonthGridDays().map((day, idx) => {
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = new Date().toDateString() === day.toDateString();
              const dayTasks = getTasksForDay(day);

              return (
                <div
                  key={idx}
                  className={`p-2 flex flex-col min-h-[90px] transition-all relative ${
                    isToday ? "bg-[#fcfaf5]" : isCurrentMonth ? "bg-white" : "bg-[#faf9f6]/40 text-stone-400"
                  }`}
                >
                  {/* Day Number Label */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded-full ${
                        isToday
                          ? "bg-[#bd6443] text-white"
                          : isCurrentMonth
                          ? "text-[#3c3029]"
                          : "text-[#85766d]/60"
                      }`}
                    >
                      {day.getDate() === 1 ? `${day.toLocaleDateString("en-US", { month: "short" })} 1` : day.getDate()}
                    </span>
                    
                    <button
                      onClick={() => onAddTaskOnDate(day)}
                      className="p-0.5 hover:bg-stone-100 rounded text-[#85766d] opacity-0 hover:opacity-100 transition-opacity"
                      title="Add Task"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Tasks List */}
                  <div className="flex-1 space-y-1 overflow-y-auto max-h-[70px] pr-0.5 scrollbar-thin">
                    {dayTasks.slice(0, 3).map((task) => {
                      let bgClass = "bg-[#3c9b74]"; // default
                      if (task.status === "done") {
                        bgClass = "bg-stone-300 text-stone-500 line-through";
                      } else {
                        switch (task.category.toLowerCase()) {
                          case "coding":
                            bgClass = "bg-[#51a179]";
                            break;
                          case "writing":
                            bgClass = "bg-[#78629f]";
                            break;
                          case "calls":
                            bgClass = "bg-[#a0525d]";
                            break;
                          case "financial":
                            bgClass = "bg-[#c88452]";
                            break;
                          case "social":
                            bgClass = "bg-[#4f6ea3]";
                            break;
                        }
                      }

                      return (
                        <div
                          key={task.id}
                          onClick={() => onSelectTask(task)}
                          className={`text-[9px] truncate font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors hover:brightness-95 ${bgClass} text-white`}
                          title={task.title}
                        >
                          {task.title}
                        </div>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <div
                        onClick={() => {
                          onCalendarModeChange("day");
                        }}
                        className="text-[9px] text-[#bd6443] font-bold text-center bg-[#faf8f5] py-0.5 rounded border border-[#e6dfd5] cursor-pointer hover:bg-[#fcfaf5]"
                      >
                        +{dayTasks.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
