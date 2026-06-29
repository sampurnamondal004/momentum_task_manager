import React, { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Mail,
  MessageSquare,
  Video,
  HardDrive,
  Plus,
  Send,
  Check,
  Loader2,
  ExternalLink,
  LogOut,
  User,
  Search,
  Lock,
  RefreshCw,
  FileText,
  AlertCircle,
  Clock,
  Briefcase
} from "lucide-react";
import { googleSignIn, logout, initAuth } from "../lib/firebase";
import { User as FirebaseUser } from "firebase/auth";
import { Task } from "../types";

interface GoogleWorkspacePanelProps {
  tasks: Task[];
  onRefreshTasks: () => void;
  onLinkGoogleResource: (taskId: string, resourceType: "event" | "meet" | "drive", resourceData: any) => void;
}

export default function GoogleWorkspacePanel({
  tasks,
  onRefreshTasks,
  onLinkGoogleResource
}: GoogleWorkspacePanelProps) {
  // Auth States
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Panel State
  const [activeTab, setActiveTab] = useState<"calendar" | "gmail" | "chat" | "meet" | "drive">("calendar");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Module Specific States
  // 1. Calendar
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [selectedTaskIdForCal, setSelectedTaskIdForCal] = useState<string>("");
  const [newCalEvent, setNewCalEvent] = useState({
    title: "",
    startTime: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    duration: "60",
    description: ""
  });

  // 2. Gmail
  const [emails, setEmails] = useState<any[]>([]);
  const [emailSearch, setEmailSearch] = useState("");
  const [emailDetails, setEmailDetails] = useState<Record<string, any>>({});
  const [newEmail, setNewEmail] = useState({
    to: "",
    subject: "",
    body: ""
  });

  // 3. Chat
  const [spaces, setSpaces] = useState<any[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [chatMessage, setChatMessage] = useState("");

  // 4. Meet
  const [createdMeets, setCreatedMeets] = useState<any[]>([]);
  const [selectedTaskIdForMeet, setSelectedTaskIdForMeet] = useState<string>("");

  // 5. Drive
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [selectedTaskIdForDrive, setSelectedTaskIdForDrive] = useState<string>("");

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setIsLoadingAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setIsLoadingAuth(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch Workspace data once token is available
  useEffect(() => {
    if (token) {
      fetchCalendarEvents();
      fetchEmails();
      fetchChatSpaces();
      fetchDriveFiles();
    }
  }, [token]);

  // General Notification Helper
  const triggerFeedback = (type: "success" | "error", message: string) => {
    if (type === "success") {
      setSuccessMsg(message);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(message);
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // Google APIs
  // 1. Calendar: List Events
  const fetchCalendarEvents = async () => {
    if (!token) return;
    try {
      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&orderBy=startTime&singleEvents=true&timeMin=" +
          new Date().toISOString(),
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        const data = await res.json();
        setCalendarEvents(data.items || []);
      } else {
        throw new Error("Unable to fetch Calendar events.");
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Create Custom Event
  const handleCreateCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoadingAction("calendar_create");
    try {
      const startDateTime = new Date(newCalEvent.startTime);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(newCalEvent.duration) * 60000);

      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            summary: newCalEvent.title,
            description: newCalEvent.description,
            start: { dateTime: startDateTime.toISOString() },
            end: { dateTime: endDateTime.toISOString() }
          })
        }
      );

      if (res.ok) {
        triggerFeedback("success", `Event "${newCalEvent.title}" added to your Google Calendar!`);
        setNewCalEvent({
          title: "",
          startTime: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
          duration: "60",
          description: ""
        });
        await fetchCalendarEvents();
      } else {
        throw new Error("Failed to create Google Calendar event.");
      }
    } catch (err: any) {
      triggerFeedback("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // Export Task to Calendar
  const handleSyncTaskToCalendar = async (task: Task) => {
    if (!token) return;
    
    const confirmSync = window.confirm(
      `Do you want to export the task "${task.title}" as an event to your Google Calendar?`
    );
    if (!confirmSync) return;

    setLoadingAction(`sync_cal_${task.id}`);
    try {
      const startDateTime = task.deadline ? new Date(task.deadline) : new Date();
      const endDateTime = new Date(startDateTime.getTime() + (task.estimated_effort || 60) * 60000);

      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            summary: `[Momentum] ${task.title}`,
            description: `Auto-generated by Momentum.\n\nCategory: ${task.category}\nImportance: ${task.importance}/5\nPriority Score: ${task.priority_score}\n\nExplanation: ${task.explanation}`,
            start: { dateTime: startDateTime.toISOString() },
            end: { dateTime: endDateTime.toISOString() }
          })
        }
      );

      if (res.ok) {
        const createdEvent = await res.json();
        triggerFeedback("success", `Successfully exported "${task.title}" to Google Calendar!`);
        onLinkGoogleResource(task.id, "event", createdEvent.id);
        await fetchCalendarEvents();
      } else {
        throw new Error("Failed to export task.");
      }
    } catch (err: any) {
      triggerFeedback("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 2. Gmail: List Emails
  const fetchEmails = async () => {
    if (!token) return;
    try {
      const res = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8",
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        const data = await res.json();
        const messages = data.messages || [];
        setEmails(messages);
        
        // Fetch details for each email in parallel
        messages.forEach(async (msg: any) => {
          if (!emailDetails[msg.id]) {
            const detailRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              setEmailDetails(prev => ({ ...prev, [msg.id]: detailData }));
            }
          }
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Send Email with MIME encoding
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const confirmSend = window.confirm(
      `Send this email to "${newEmail.to}" from your Gmail account?`
    );
    if (!confirmSend) return;

    setLoadingAction("email_send");
    try {
      // Build simple RFC 2822 email format
      const emailContent = [
        `To: ${newEmail.to}`,
        `Subject: ${newEmail.subject}`,
        "Content-Type: text/plain; charset=utf-8",
        "MIME-Version: 1.0",
        "",
        newEmail.body
      ].join("\r\n");

      // base64url encode
      const encodedEmail = btoa(unescape(encodeURIComponent(emailContent)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const res = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ raw: encodedEmail })
        }
      );

      if (res.ok) {
        triggerFeedback("success", `Email sent successfully to ${newEmail.to}!`);
        setNewEmail({ to: "", subject: "", body: "" });
        await fetchEmails();
      } else {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to send email via Gmail.");
      }
    } catch (err: any) {
      triggerFeedback("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // Convert Email to Momentum Task
  const handleImportEmailAsTask = async (msgDetails: any) => {
    const headers = msgDetails.payload?.headers || [];
    const subject = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value || "Imported Email Task";
    const dateHeader = headers.find((h: any) => h.name.toLowerCase() === "date")?.value;
    
    const confirmImport = window.confirm(
      `Do you want to create a new Momentum task from the email "${subject}"?`
    );
    if (!confirmImport) return;

    setLoadingAction(`import_email_${msgDetails.id}`);
    try {
      // Create task on backend
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `[Gmail Sync] ${subject}`,
          category: "admin",
          deadline: dateHeader ? new Date(dateHeader).toISOString() : null,
          estimated_effort: 30,
          importance: 3,
          explanation: `Imported from Gmail email thread ID: ${msgDetails.threadId}. Snippet: ${msgDetails.snippet}`
        })
      });

      if (res.ok) {
        triggerFeedback("success", `Created new task: "${subject}"!`);
        onRefreshTasks();
      } else {
        throw new Error("Failed to save imported task.");
      }
    } catch (err: any) {
      triggerFeedback("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 3. Chat: List Spaces
  const fetchChatSpaces = async () => {
    if (!token) return;
    try {
      const res = await fetch("https://chat.googleapis.com/v1/spaces", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const listedSpaces = data.spaces || [];
        setSpaces(listedSpaces);
        if (listedSpaces.length > 0 && !selectedSpaceId) {
          setSelectedSpaceId(listedSpaces[0].name); // store the space resource name e.g. spaces/XXXXX
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Send message to Google Chat Space
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedSpaceId || !chatMessage.trim()) return;

    const confirmSend = window.confirm(
      "Send this message to your selected Google Chat Space?"
    );
    if (!confirmSend) return;

    setLoadingAction("chat_send");
    try {
      const res = await fetch(
        `https://chat.googleapis.com/v1/${selectedSpaceId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ text: chatMessage })
        }
      );

      if (res.ok) {
        triggerFeedback("success", "Message posted to Google Chat successfully!");
        setChatMessage("");
      } else {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to post message to Google Chat.");
      }
    } catch (err: any) {
      triggerFeedback("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // Send task update to Google Chat Space
  const handleDispatchTaskToChat = async (task: Task) => {
    if (!token || !selectedSpaceId) {
      triggerFeedback("error", "Please select a Google Chat space first.");
      return;
    }

    const confirmSend = window.confirm(
      `Dispatch status of task "${task.title}" to the active Google Chat space?`
    );
    if (!confirmSend) return;

    setLoadingAction(`dispatch_chat_${task.id}`);
    try {
      const statusEmoji = task.status === "done" ? "✅ [COMPLETED]" : "⏳ [PENDING]";
      const formattedMessage = `⚡ *Momentum Task Dispatcher* \n\n*Task:* ${task.title}\n*Status:* ${statusEmoji}\n*Priority Score:* \`${task.priority_score}\`\n*Category:* _${task.category}_\n*Explanation:* ${task.explanation}`;

      const res = await fetch(
        `https://chat.googleapis.com/v1/${selectedSpaceId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ text: formattedMessage })
        }
      );

      if (res.ok) {
        triggerFeedback("success", `Dispatched "${task.title}" details to Google Chat!`);
      } else {
        throw new Error("Failed to dispatch task details.");
      }
    } catch (err: any) {
      triggerFeedback("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 4. Meet: Create Instant Space
  const handleCreateMeetSpace = async () => {
    if (!token) return;
    setLoadingAction("meet_create");
    try {
      const res = await fetch("https://meet.googleapis.com/v2/spaces", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedMeets(prev => [data, ...prev]);
        triggerFeedback("success", "Instant Google Meet space generated successfully!");
        
        // If a task is selected, link it automatically
        if (selectedTaskIdForMeet) {
          onLinkGoogleResource(selectedTaskIdForMeet, "meet", data.meetingUri);
          setSelectedTaskIdForMeet("");
        }
      } else {
        throw new Error("Failed to generate Google Meet space.");
      }
    } catch (err: any) {
      triggerFeedback("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // Link selected task with a specific Meet link manually
  const handleLinkMeetToTask = (meetUri: string) => {
    if (!selectedTaskIdForMeet) return;
    onLinkGoogleResource(selectedTaskIdForMeet, "meet", meetUri);
    setSelectedTaskIdForMeet("");
    triggerFeedback("success", "Linked Google Meet space to selected task!");
  };

  // 5. Drive: List Files
  const fetchDriveFiles = async () => {
    if (!token) return;
    try {
      const res = await fetch(
        "https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id,name,mimeType,webViewLink)&orderBy=modifiedTime desc",
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        const data = await res.json();
        setDriveFiles(data.files || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Export tasks as Text report to Drive
  const handleExportTasksToDrive = async () => {
    if (!token) return;

    const confirmExport = window.confirm(
      "Export your complete list of active Momentum tasks as a text file to your Google Drive?"
    );
    if (!confirmExport) return;

    setLoadingAction("drive_export");
    try {
      const reportTitle = `Momentum_Tasks_Report_${new Date().toISOString().slice(0,10)}.txt`;
      
      // Build text body
      let bodyText = `⚡ MOMENTUM TASKS REPORT - GENERATED ${new Date().toLocaleString()}\n`;
      bodyText += `=".=".=".=".=".=".=".=".=".=".=".=".=".=".=".=".=".=".=".="\n\n`;
      
      tasks.forEach((task, i) => {
        bodyText += `${i + 1}. [${task.status.toUpperCase()}] ${task.title}\n`;
        bodyText += `   Category: ${task.category} | Priority Score: ${task.priority_score}\n`;
        bodyText += `   Importance: ${task.importance}/5 | Effort: ${task.calibrated_effort}m\n`;
        bodyText += `   Deadline: ${task.deadline || "No deadline"}\n`;
        bodyText += `   A.I. Analysis: ${task.explanation}\n\n`;
      });

      // 1. Create file metadata in Google Drive
      const metadataRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: reportTitle,
          mimeType: "text/plain"
        })
      });

      if (!metadataRes.ok) {
        throw new Error("Could not create report file metadata in Drive.");
      }

      const fileMetadata = await metadataRes.json();
      const fileId = fileMetadata.id;

      // 2. Upload file content
      const contentRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "text/plain"
          },
          body: bodyText
        }
      );

      if (contentRes.ok) {
        triggerFeedback("success", `Report "${reportTitle}" uploaded to Google Drive!`);
        await fetchDriveFiles();
      } else {
        throw new Error("Could not upload task content to Drive.");
      }
    } catch (err: any) {
      triggerFeedback("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // Link a Drive file to a Task
  const handleLinkFileToTask = (file: any) => {
    if (!selectedTaskIdForDrive) return;
    onLinkGoogleResource(selectedTaskIdForDrive, "drive", {
      name: file.name,
      url: file.webViewLink
    });
    setSelectedTaskIdForDrive("");
    triggerFeedback("success", `Attached "${file.name}" to the task!`);
  };

  // Google OAuth Login
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        triggerFeedback("success", "Successfully connected Google Workspace APIs!");
      }
    } catch (err: any) {
      console.error("Sign-in details error:", err);
      const errCode = err?.code || "";
      const errMsg = err?.message || "";
      let friendlyMsg = errMsg;
      
      if (errCode === "auth/popup-closed-by-user" || errMsg.includes("popup-closed-by-user")) {
        friendlyMsg = "The sign-in window was closed before completion. Please click 'Sign in with Google' again and complete the sign-in process in the popup window.";
      } else if (errCode === "auth/popup-blocked" || errMsg.includes("popup-blocked")) {
        friendlyMsg = "The sign-in popup was blocked by your browser. Please allow popups for this site and try again.";
      } else if (errCode === "auth/cancelled-popup-request" || errMsg.includes("cancelled-popup-request")) {
        friendlyMsg = "The sign-in request was cancelled. This can happen if you clicked the button multiple times.";
      } else if (errCode === "auth/network-request-failed" || errMsg.includes("network-request-failed")) {
        friendlyMsg = "A network error occurred. Please check your internet connection and try again.";
      }
      
      triggerFeedback("error", friendlyMsg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    const confirmLogout = window.confirm("Are you sure you want to disconnect Google Workspace?");
    if (!confirmLogout) return;
    
    try {
      await logout();
      setUser(null);
      setToken(null);
      triggerFeedback("success", "Successfully disconnected Google Workspace APIs.");
    } catch (err: any) {
      triggerFeedback("error", err.message || "Failed to log out.");
    }
  };

  // Helper to get formatted header headers
  const getHeaderFromMsg = (msg: any, name: string) => {
    const headers = msg?.payload?.headers || [];
    return headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
  };

  if (isLoadingAuth) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#e6dfd5] rounded-2xl p-8" id="loading-state">
        <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
        <span className="text-sm font-semibold text-stone-500 mt-4">Restoring Workspace session...</span>
      </div>
    );
  }

  // SIGN IN LANDING SCREEN
  if (!user || !token) {
    return (
      <div className="bg-white border border-[#e6dfd5] rounded-2xl p-8 text-center max-w-2xl mx-auto shadow-sm" id="auth-required-panel">
        <div className="inline-flex p-4 bg-violet-50 text-violet-600 rounded-2xl mb-5" id="workspace-icon-badge">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-[#3c3029] tracking-tight">Connect Google Workspace</h3>
        <p className="text-sm text-[#85766d] mt-2 mb-6 max-w-md mx-auto">
          Momentum needs your permission to securely view and update your **Google Calendar**, **Gmail**, **Google Chat**, **Google Meet**, and **Google Drive** directly from your account.
        </p>

        {/* Alerts and Notices */}
        <div className="space-y-2 mb-6 max-w-md mx-auto text-left">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center space-x-2 animate-fadeIn" id="landing-error-notif">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2 animate-fadeIn" id="landing-success-notif">
              <Check className="w-4 h-4 shrink-0 animate-bounce" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* GSI Material Button Style as requested by workspace-integration skill */}
        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="inline-flex items-center justify-center px-6 py-3 bg-white border border-[#dadce0] hover:bg-[#f8f9fa] active:bg-[#f1f3f4] text-[#3c4043] font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-sm relative disabled:opacity-50"
          id="google-sign-in-btn"
        >
          {isLoggingIn ? (
            <Loader2 className="w-5 h-5 text-[#bd6443] animate-spin mr-3" />
          ) : (
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 mr-3 shrink-0">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            </svg>
          )}
          <span>{isLoggingIn ? "Authorizing Account..." : "Sign in with Google"}</span>
        </button>
      </div>
    );
  }

  // LOGGED-IN WORKSPACE CONTROL HUB
  return (
    <div className="bg-white border border-[#e6dfd5] rounded-2xl shadow-sm flex flex-col md:flex-row min-h-[500px] overflow-hidden" id="workspace-control-hub">
      
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 bg-[#fcfbfa] border-r border-[#e6dfd5] p-5 flex flex-col justify-between" id="workspace-tabs-menu">
        <div>
          {/* Connected User Badge */}
          <div className="flex items-center space-x-3 mb-6 p-2.5 bg-violet-50/50 border border-violet-100 rounded-xl" id="google-profile-badge">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Google Profile" className="w-9 h-9 rounded-full border border-violet-200" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700">
                <User className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-[#3c3029] truncate">{user.displayName || "Google Account"}</h4>
              <p className="text-[10px] text-stone-500 truncate">{user.email || ""}</p>
            </div>
          </div>

          <h3 className="text-[11px] font-mono tracking-wider text-[#bd6443] font-bold uppercase mb-3">Workspace Modules</h3>
          
          <div className="space-y-1" id="workspace-nav-buttons">
            <button
              onClick={() => setActiveTab("calendar")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "calendar"
                  ? "bg-[#3c3029] text-white"
                  : "text-stone-600 hover:bg-[#faf9f7] hover:text-stone-900"
              }`}
            >
              <div className="flex items-center space-x-3">
                <CalendarIcon className="w-4 h-4" />
                <span>Google Calendar</span>
              </div>
              <span className="text-[10px] bg-stone-100 text-stone-600 group-hover:bg-stone-200 px-1.5 py-0.5 rounded-full font-mono">
                {calendarEvents.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("gmail")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "gmail"
                  ? "bg-[#3c3029] text-white"
                  : "text-stone-600 hover:bg-[#faf9f7] hover:text-stone-900"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Mail className="w-4 h-4" />
                <span>Gmail Messages</span>
              </div>
              <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-full font-mono">
                {emails.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("chat")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "chat"
                  ? "bg-[#3c3029] text-white"
                  : "text-stone-600 hover:bg-[#faf9f7] hover:text-stone-900"
              }`}
            >
              <div className="flex items-center space-x-3">
                <MessageSquare className="w-4 h-4" />
                <span>Google Chat Spaces</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("meet")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "meet"
                  ? "bg-[#3c3029] text-white"
                  : "text-stone-600 hover:bg-[#faf9f7] hover:text-stone-900"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Video className="w-4 h-4" />
                <span>Google Meet Calls</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("drive")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "drive"
                  ? "bg-[#3c3029] text-white"
                  : "text-stone-600 hover:bg-[#faf9f7] hover:text-stone-900"
              }`}
            >
              <div className="flex items-center space-x-3">
                <HardDrive className="w-4 h-4" />
                <span>Google Drive Storage</span>
              </div>
            </button>
          </div>
        </div>

        {/* Action / Disconnect buttons */}
        <div className="pt-4 border-t border-[#e6dfd5]" id="workspace-sidebar-footer">
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-2.5 px-3 py-2 text-stone-500 hover:text-red-600 text-xs font-semibold hover:bg-red-50/50 rounded-xl transition-colors cursor-pointer"
            id="disconnect-google-btn"
          >
            <LogOut className="w-4 h-4" />
            <span>Disconnect Account</span>
          </button>
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 p-6 flex flex-col justify-between" id="workspace-panel-body">
        
        {/* Alerts and Notices */}
        <div className="space-y-2 mb-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center space-x-2" id="panel-error-notif">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2" id="panel-success-notif">
              <Check className="w-4 h-4 shrink-0 animate-bounce" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* 1. CALENDAR TAB CONTENT */}
        {activeTab === "calendar" && (
          <div className="space-y-6" id="tab-calendar-content">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#3c3029]">Google Calendar Sync</h3>
                <p className="text-xs text-[#85766d]">Overlay events and export your high-priority planner tasks into calendar slots.</p>
              </div>
              <button
                onClick={fetchCalendarEvents}
                className="p-1.5 border border-[#e6dfd5] hover:bg-stone-100 rounded-lg text-stone-600 transition-colors cursor-pointer"
                title="Refresh Events"
                id="refresh-calendar-btn"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Upcoming Event List */}
              <div className="bg-stone-50/50 border border-[#e6dfd5] rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#bd6443] uppercase tracking-wider mb-3">Upcoming Calendar Events</h4>
                  {calendarEvents.length === 0 ? (
                    <p className="text-xs text-stone-400 py-6 text-center">No upcoming events scheduled on your Google Calendar.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                      {calendarEvents.map((event) => {
                        const start = event.start?.dateTime ? new Date(event.start.dateTime) : (event.start?.date ? new Date(event.start.date) : null);
                        return (
                          <div key={event.id} className="p-2.5 bg-white border border-[#e6dfd5] rounded-lg text-xs flex justify-between items-start gap-3">
                            <div>
                              <p className="font-semibold text-stone-800">{event.summary || "(No Title)"}</p>
                              {start && (
                                <p className="text-[10px] text-[#bd6443] font-mono mt-0.5">
                                  {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} @ {start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              )}
                            </div>
                            {event.htmlLink && (
                              <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Direct Task Exporter */}
                <div className="mt-4 pt-4 border-t border-[#e6dfd5]">
                  <h4 className="text-xs font-bold text-stone-700 mb-2">Sync Momentum Task to Calendar</h4>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 text-xs border border-[#e6dfd5] rounded-lg px-2 py-1.5 bg-white text-[#3c3029]"
                      value={selectedTaskIdForCal}
                      onChange={(e) => setSelectedTaskIdForCal(e.target.value)}
                      id="export-calendar-task-select"
                    >
                      <option value="">-- Choose Task --</option>
                      {tasks.filter(t => t.status !== "done").map(t => (
                        <option key={t.id} value={t.id}>{t.title} (Score: {t.priority_score})</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const targetTask = tasks.find(t => t.id === selectedTaskIdForCal);
                        if (targetTask) handleSyncTaskToCalendar(targetTask);
                      }}
                      disabled={!selectedTaskIdForCal || loadingAction !== null}
                      className="px-3 py-1.5 bg-[#bd6443] text-white text-xs font-semibold rounded-lg hover:bg-[#a95232] cursor-pointer disabled:opacity-50"
                      id="export-calendar-task-btn"
                    >
                      {loadingAction?.startsWith("sync_cal_") ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Export"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Schedule Form */}
              <form onSubmit={handleCreateCalendarEvent} className="bg-[#faf9f7] border border-[#e6dfd5] rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Quickly Add Google Event</h4>
                
                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Event Title</label>
                  <input
                    type="text"
                    required
                    className="w-full text-xs border border-[#e6dfd5] rounded-lg px-3 py-2 bg-white text-stone-800 focus:outline-violet-500"
                    placeholder="e.g. Weekly Roadmap Alignment"
                    value={newCalEvent.title}
                    onChange={(e) => setNewCalEvent(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Start Time</label>
                    <input
                      type="datetime-local"
                      required
                      className="w-full text-xs border border-[#e6dfd5] rounded-lg px-2 py-1.5 bg-white text-stone-800"
                      value={newCalEvent.startTime}
                      onChange={(e) => setNewCalEvent(prev => ({ ...prev, startTime: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Duration</label>
                    <select
                      className="w-full text-xs border border-[#e6dfd5] rounded-lg px-2 py-2 bg-white text-stone-800"
                      value={newCalEvent.duration}
                      onChange={(e) => setNewCalEvent(prev => ({ ...prev, duration: e.target.value }))}
                    >
                      <option value="15">15 Minutes</option>
                      <option value="30">30 Minutes</option>
                      <option value="45">45 Minutes</option>
                      <option value="60">1 Hour</option>
                      <option value="120">2 Hours</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Description</label>
                  <textarea
                    className="w-full text-xs border border-[#e6dfd5] rounded-lg px-3 py-1.5 bg-white text-stone-800 h-16 resize-none"
                    placeholder="Enter details..."
                    value={newCalEvent.description}
                    onChange={(e) => setNewCalEvent(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingAction === "calendar_create"}
                  className="w-full flex items-center justify-center space-x-2 py-2 bg-[#3c3029] hover:bg-stone-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  {loadingAction === "calendar_create" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Add to Calendar</span>
                </button>
              </form>

            </div>
          </div>
        )}

        {/* 2. GMAIL TAB CONTENT */}
        {activeTab === "gmail" && (
          <div className="space-y-6" id="tab-gmail-content">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#3c3029]">Gmail Inbox & Outbox</h3>
                <p className="text-xs text-[#85766d]">Send automated emails with task reports, and import messages directly as actionable items.</p>
              </div>
              <button
                onClick={fetchEmails}
                className="p-1.5 border border-[#e6dfd5] hover:bg-stone-100 rounded-lg text-stone-600 transition-colors cursor-pointer"
                id="refresh-gmail-btn"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Inbox list */}
              <div className="bg-stone-50/50 border border-[#e6dfd5] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-[#bd6443] uppercase tracking-wider">Recent Gmail Messages</h4>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-stone-400" />
                    <input
                      type="text"
                      className="pl-7 pr-2.5 py-1 text-[10px] border border-[#e6dfd5] rounded-lg bg-white w-32 focus:outline-violet-500"
                      placeholder="Search inbox..."
                      value={emailSearch}
                      onChange={(e) => setEmailSearch(e.target.value)}
                    />
                  </div>
                </div>

                {emails.length === 0 ? (
                  <p className="text-xs text-stone-400 py-10 text-center">No messages loaded from your Gmail Inbox.</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {emails
                      .filter(m => {
                        const d = emailDetails[m.id];
                        if (!d) return true;
                        const subj = getHeaderFromMsg(d, "subject").toLowerCase();
                        const from = getHeaderFromMsg(d, "from").toLowerCase();
                        return subj.includes(emailSearch.toLowerCase()) || from.includes(emailSearch.toLowerCase());
                      })
                      .map((msg) => {
                        const detail = emailDetails[msg.id];
                        const fromName = getHeaderFromMsg(detail, "from").split("<")[0] || "Unknown Sender";
                        const subject = getHeaderFromMsg(detail, "subject") || "(No Subject)";
                        
                        return (
                          <div key={msg.id} className="p-2.5 bg-white border border-[#e6dfd5] hover:border-[#bd6443]/30 rounded-lg text-xs flex justify-between items-center gap-2 transition-all">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-stone-700 truncate">{fromName}</p>
                              <p className="text-[11px] text-[#3c3029] font-medium truncate mt-0.5">{subject}</p>
                              <p className="text-[10px] text-stone-400 truncate mt-0.5">{detail?.snippet || ""}</p>
                            </div>
                            <button
                              onClick={() => handleImportEmailAsTask(detail)}
                              disabled={!detail || loadingAction !== null}
                              className="px-2 py-1 bg-[#bd6443]/10 hover:bg-[#bd6443]/20 text-[#bd6443] text-[10px] font-bold rounded-lg transition-colors shrink-0 cursor-pointer"
                              title="Import into Momentum Planner"
                            >
                              + Import
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Composition form */}
              <form onSubmit={handleSendEmail} className="bg-[#faf9f7] border border-[#e6dfd5] rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Compose and Send Email</h4>
                
                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">To (Recipient)</label>
                  <input
                    type="email"
                    required
                    className="w-full text-xs border border-[#e6dfd5] rounded-lg px-3 py-2 bg-white text-stone-800"
                    placeholder="client@partner.corp"
                    value={newEmail.to}
                    onChange={(e) => setNewEmail(prev => ({ ...prev, to: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    className="w-full text-xs border border-[#e6dfd5] rounded-lg px-3 py-2 bg-white text-stone-800"
                    placeholder="Updates from Momentum"
                    value={newEmail.subject}
                    onChange={(e) => setNewEmail(prev => ({ ...prev, subject: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Body</label>
                  <textarea
                    required
                    className="w-full text-xs border border-[#e6dfd5] rounded-lg px-3 py-1.5 bg-white text-stone-800 h-20 resize-none"
                    placeholder="Write your email here..."
                    value={newEmail.body}
                    onChange={(e) => setNewEmail(prev => ({ ...prev, body: e.target.value }))}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingAction === "email_send"}
                  className="w-full flex items-center justify-center space-x-2 py-2 bg-[#3c3029] hover:bg-stone-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  {loadingAction === "email_send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Send Email via Gmail</span>
                </button>
              </form>

            </div>
          </div>
        )}

        {/* 3. CHAT TAB CONTENT */}
        {activeTab === "chat" && (
          <div className="space-y-6" id="tab-chat-content">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#3c3029]">Google Chat Channels</h3>
                <p className="text-xs text-[#85766d]">Broadcast status updates, report backlogs, and dispatch active workspace plans to Chat rooms.</p>
              </div>
              <button
                onClick={fetchChatSpaces}
                className="p-1.5 border border-[#e6dfd5] hover:bg-stone-100 rounded-lg text-stone-600 transition-colors cursor-pointer"
                id="refresh-chat-btn"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Broadcast / Dispatcher center */}
              <div className="bg-stone-50/50 border border-[#e6dfd5] rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#bd6443] uppercase tracking-wider mb-3">Broadcast Task Status to Space</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Target Chat Space</label>
                      {spaces.length === 0 ? (
                        <p className="text-xs text-stone-400 py-2">No Google Chat Spaces found. Please verify you belong to Chat rooms.</p>
                      ) : (
                        <select
                          className="w-full text-xs border border-[#e6dfd5] rounded-lg p-2 bg-white text-stone-800 font-medium"
                          value={selectedSpaceId}
                          onChange={(e) => setSelectedSpaceId(e.target.value)}
                          id="chat-space-select"
                        >
                          {spaces.map(s => (
                            <option key={s.name} value={s.name}>{s.displayName || s.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="pt-3 border-t border-dashed border-[#e6dfd5]">
                      <h5 className="text-[11px] font-bold text-stone-600 mb-2">Available Active Tasks to Post:</h5>
                      {tasks.filter(t => t.status !== "done").length === 0 ? (
                        <p className="text-xs text-stone-400">All tasks are completed.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                          {tasks.filter(t => t.status !== "done").map(task => (
                            <div key={task.id} className="flex justify-between items-center bg-white p-2 border border-[#e6dfd5] rounded-lg text-xs gap-3">
                              <span className="font-semibold truncate text-stone-700">{task.title}</span>
                              <button
                                onClick={() => handleDispatchTaskToChat(task)}
                                disabled={!selectedSpaceId || loadingAction !== null}
                                className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                {loadingAction === `dispatch_chat_${task.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Dispatch"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Send Message form */}
              <form onSubmit={handleSendChatMessage} className="bg-[#faf9f7] border border-[#e6dfd5] rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Send Announcement Message</h4>
                
                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Target Space</label>
                  <p className="text-xs font-mono font-semibold text-stone-700 p-2 bg-white border border-[#e6dfd5] rounded-lg truncate">
                    {spaces.find(s => s.name === selectedSpaceId)?.displayName || selectedSpaceId || "None Selected"}
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Message Content</label>
                  <textarea
                    required
                    className="w-full text-xs border border-[#e6dfd5] rounded-lg px-3 py-1.5 bg-white text-stone-800 h-28 resize-none"
                    placeholder="Hello team, here are the project statuses..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!selectedSpaceId || !chatMessage.trim() || loadingAction === "chat_send"}
                  className="w-full flex items-center justify-center space-x-2 py-2 bg-[#3c3029] hover:bg-stone-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loadingAction === "chat_send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Post to Space</span>
                </button>
              </form>

            </div>
          </div>
        )}

        {/* 4. MEET TAB CONTENT */}
        {activeTab === "meet" && (
          <div className="space-y-6" id="tab-meet-content">
            <div>
              <h3 className="text-lg font-bold text-[#3c3029]">Google Meet Manager</h3>
              <p className="text-xs text-[#85766d]">Instantly spin up meeting spaces and link Google Meet calls to specific task planner items.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Creator Card */}
              <div className="bg-stone-50/50 border border-[#e6dfd5] rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#bd6443] uppercase tracking-wider mb-3">Generate Instant Meet Room</h4>
                  <p className="text-xs text-stone-600 mb-4">
                    Create a virtual room where participants can instantly join to resolve tasks.
                  </p>

                  <div className="space-y-4">
                    {/* Link optional task selector */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Optional: Link meeting to Task</label>
                      <select
                        className="w-full text-xs border border-[#e6dfd5] rounded-lg px-2.5 py-1.5 bg-white text-[#3c3029]"
                        value={selectedTaskIdForMeet}
                        onChange={(e) => setSelectedTaskIdForMeet(e.target.value)}
                        id="link-meet-task-select"
                      >
                        <option value="">-- No linked task --</option>
                        {tasks.map(t => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleCreateMeetSpace}
                      disabled={loadingAction === "meet_create"}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 bg-[#3c3029] hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-sm"
                      id="generate-meet-btn"
                    >
                      {loadingAction === "meet_create" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Video className="w-4 h-4" />
                      )}
                      <span>Create Google Meet Space</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Created Meet listing */}
              <div className="bg-[#faf9f7] border border-[#e6dfd5] rounded-xl p-4">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3">Active & Scheduled Meets</h4>
                
                {createdMeets.length === 0 ? (
                  <p className="text-xs text-stone-400 py-10 text-center">No meet spaces generated in this session yet.</p>
                ) : (
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {createdMeets.map((meet, index) => (
                      <div key={index} className="p-3 bg-white border border-[#e6dfd5] rounded-lg text-xs flex justify-between items-center gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-stone-700">Meeting Space #{createdMeets.length - index}</p>
                          <p className="text-[10px] text-stone-400 font-mono mt-0.5">{meet.name || ""}</p>
                          <p className="text-[10px] text-[#bd6443] font-semibold mt-1 truncate">{meet.meetingUri}</p>
                        </div>
                        <div className="flex space-x-1 shrink-0">
                          <a
                            href={meet.meetingUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-100 cursor-pointer"
                            title="Join Meet Room"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* 5. DRIVE TAB CONTENT */}
        {activeTab === "drive" && (
          <div className="space-y-6" id="tab-drive-content">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#3c3029]">Google Drive Storage</h3>
                <p className="text-xs text-[#85766d]">Browse cloud files, link spreadsheets or mockups directly to planner tasks, and export records.</p>
              </div>
              <button
                onClick={fetchDriveFiles}
                className="p-1.5 border border-[#e6dfd5] hover:bg-stone-100 rounded-lg text-stone-600 transition-colors cursor-pointer"
                id="refresh-drive-btn"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Export Tasks to Drive */}
              <div className="bg-[#faf9f7] border border-[#e6dfd5] rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#bd6443] uppercase tracking-wider mb-2">Export Momentum Backlog</h4>
                  <p className="text-xs text-stone-600 mb-4">
                    Convert your task backlog with calibrated urgency calculations, categories, and AI explanations into a formatted report and backup to Google Drive.
                  </p>
                </div>
                <button
                  onClick={handleExportTasksToDrive}
                  disabled={loadingAction === "drive_export" || tasks.length === 0}
                  className="w-full flex items-center justify-center space-x-2.5 py-2.5 bg-[#3c3029] hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-sm"
                  id="export-drive-btn"
                >
                  {loadingAction === "drive_export" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  <span>Export Report to Drive</span>
                </button>
              </div>

              {/* Browse and Link Storage Files */}
              <div className="bg-stone-50/50 border border-[#e6dfd5] rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3">Browse Files & Link to Task</h4>
                  
                  {driveFiles.length === 0 ? (
                    <p className="text-xs text-stone-400 py-10 text-center">No files found on your Google Drive.</p>
                  ) : (
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {driveFiles.map((file) => (
                        <div key={file.id} className="p-2.5 bg-white border border-[#e6dfd5] rounded-lg text-xs flex justify-between items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-stone-700 truncate">{file.name}</p>
                            <p className="text-[9px] text-stone-400 font-mono truncate">{file.mimeType.split(".").pop()}</p>
                          </div>
                          <div className="flex items-center space-x-1.5 shrink-0">
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleLinkFileToTask(file)}
                              disabled={!selectedTaskIdForDrive}
                              className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                                selectedTaskIdForDrive
                                  ? "bg-violet-600/10 hover:bg-violet-600/20 text-violet-600"
                                  : "bg-stone-100 text-stone-400 cursor-not-allowed"
                              }`}
                              title={selectedTaskIdForDrive ? "Link this file to task" : "Select task below first"}
                            >
                              Attach
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Target selector */}
                <div className="mt-3 pt-3 border-t border-[#e6dfd5]">
                  <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Target Task to Attach To</label>
                  <select
                    className="w-full text-xs border border-[#e6dfd5] rounded-lg p-1.5 bg-white text-[#3c3029]"
                    value={selectedTaskIdForDrive}
                    onChange={(e) => setSelectedTaskIdForDrive(e.target.value)}
                    id="link-drive-task-select"
                  >
                    <option value="">-- Choose target task --</option>
                    {tasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  );
}
