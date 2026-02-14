
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Download, LogOut, Shield, User as UserIcon, Lock, Mail, Smartphone, 
  PlusCircle, FileText, Activity, Bell, Trash2, CheckCircle, XCircle, 
  Send, ChevronLeft, Loader2, Sparkles, Image as ImageIcon, Search, MessageCircle, X, Save, Camera, Eye, List
} from 'lucide-react';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { View, AuthMode, User, ActivityLog, Report, TableRow, SavedList } from './types';
import { GoogleGenAI } from "@google/genai";

const LOGO_URL = "https://scontent.fdac140-1.fna.fbcdn.net/v/t39.30808-6/476368353_635211659010343_163258174244584004_n.jpg?_nc_cat=106&ccb=1-7&_nc_sid=6ee11a&_nc_eui2=AeEz0P0bImkU9JsTmOlbnXfXYP7jtEwYcoBg_uO0TBhygLK5aWGBHztvsOjPo_XbPdA5K6GqjpgmKy3W8L_YkxX7&_nc_ohc=Pa7UyeyAtPYQ7kNvwHDN9aK&_nc_oc=Admar4zYXz-i9-Hn8LTNLWxgP4jBCTuuHCRKvwp3kKRN_ouJVQKvyayDIxz9HALQmWc&_nc_zt=23&_nc_ht=scontent.fdac140-1.fna&_nc_gid=WpY1IfgU6F84qR7mLjLVCw&oh=00_AftDzrSPHe-UbO50o-aXWZcpLOPBZvrier1b3qGRpXaOMw&oe=69962FC9";

const ADMIN_CREDS = { USERNAME: "NAHIDUL79", PASSWORD: "51535759" };

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

const generateCaptchaText = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let res = "";
  for (let i = 0; i < 6; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
  return res;
};

const toBengaliNumber = (num: number | string) => {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/\d/g, (d) => digits[parseInt(d)]);
};

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>(() => JSON.parse(localStorage.getItem('team_users') || '[]'));
  const [reports, setReports] = useState<Report[]>(() => JSON.parse(localStorage.getItem('team_reports') || '[]'));
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('team_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [view, setView] = useState<View>(currentUser ? (currentUser.role === 'admin' ? 'ADMIN' : 'DASHBOARD') : 'AUTH');
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  const [formData, setFormData] = useState({ fullName: '', email: '', username: '', password: '', phone: '', message: '', captchaInput: '' });
  const [captcha, setCaptcha] = useState(generateCaptchaText());
  const [isProcessing, setIsProcessing] = useState(false);
  const [memberCount, setMemberCount] = useState(10);
  const [tableData, setTableData] = useState<TableRow[]>([]);
  const [documentTitle, setDocumentTitle] = useState('সদস্য তথ্য তালিকা রেজিস্টার - ২০২৬');

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTargetUser, setSelectedTargetUser] = useState<string | null>(null);
  const [individualMessage, setIndividualMessage] = useState('');
  const [viewUserDetails, setViewUserDetails] = useState<User | null>(null);
  const [dashboardTab, setDashboardTab] = useState<'lists' | 'logs'>('lists');

  const documentRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  // Auto-delete reports older than 7 days
  useEffect(() => {
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const validReports = reports.filter(r => (now - r.timestamp) < sevenDaysInMs);
    if (validReports.length !== reports.length) {
      setReports(validReports);
    }
  }, [reports]);

  useEffect(() => {
    localStorage.setItem('team_users', JSON.stringify(users));
    localStorage.setItem('team_reports', JSON.stringify(reports));
    if (currentUser) {
      localStorage.setItem('team_session', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('team_session');
    }
  }, [users, reports, currentUser]);

  const logActivity = useCallback((action: string, username?: string) => {
    const target = username || currentUser?.username;
    if (!target) return;
    const log: ActivityLog = { action, timestamp: Date.now() };
    setUsers(prev => prev.map(u => u.username === target ? { ...u, activityLog: [...(u.activityLog || []), log] } : u));
    if (currentUser?.username === target) {
      setCurrentUser(prev => prev ? { ...prev, activityLog: [...(prev.activityLog || []), log] } : null);
    }
  }, [currentUser]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    if (authMode === 'admin_login') {
      if (formData.username === ADMIN_CREDS.USERNAME && formData.password === ADMIN_CREDS.PASSWORD) {
        // Ensure admin profile exists in users array for persistence of profile pic
        let adminUser = users.find(u => u.username === ADMIN_CREDS.USERNAME);
        if (!adminUser) {
          adminUser = {
            username: ADMIN_CREDS.USERNAME,
            fullName: 'Nahidul Islam',
            email: 'admin@system.com',
            isActive: true,
            role: 'admin',
            notifications: [],
            activityLog: [],
            password: ADMIN_CREDS.PASSWORD
          };
          setUsers(prev => [...prev, adminUser as User]);
        }
        setCurrentUser(adminUser);
        setView('ADMIN');
        showToast("Welcome Admin Nahidul", "success");
      } else {
        showToast("Invalid Admin Credentials", "error");
      }
    } else if (authMode === 'login') {
      const user = users.find(u => u.username === formData.username && u.password === formData.password);
      if (user) {
        if (!user.isActive) {
          showToast("Account Banned by Admin", "error");
          setIsProcessing(false);
          return;
        }
        setCurrentUser(user);
        setView(user.role === 'admin' ? 'ADMIN' : 'DASHBOARD');
        logActivity('Logged into the system', user.username);
        showToast(`Login Successful! Welcome, ${user.fullName}`, "success");
      } else {
        showToast("Invalid Username or Password", "error");
      }
    } else if (authMode === 'register') {
      if (formData.captchaInput !== captcha) {
        setCaptcha(generateCaptchaText());
        showToast("Captcha Incorrect", "error");
        setIsProcessing(false);
        return;
      }
      if (users.some(u => u.username === formData.username)) {
        showToast("Username already taken", "error");
        setIsProcessing(false);
        return;
      }
      const newUser: User = { ...formData, isActive: true, role: 'user', notifications: [], activityLog: [{ action: 'Account Created', timestamp: Date.now() }], savedLists: [] };
      setUsers([...users, newUser]);
      showToast("Registration Successful! Please login.", "success");
      setAuthMode('login');
    } else if (authMode === 'forgot') {
      const report: Report = { id: Math.random().toString(36).substr(2, 9).toUpperCase(), username: formData.username, phone: formData.phone, message: formData.message, timestamp: Date.now(), status: 'pending' };
      setReports([...reports, report]);
      showToast("Recovery request sent to admin", "success");
      setAuthMode('login');
    }

    setIsProcessing(false);
  };

  const handleLogout = () => {
    if (currentUser) logActivity('Logged out');
    setCurrentUser(null);
    setView('AUTH');
    setAuthMode('login');
    showToast("Logged out successfully");
  };

  const startEditing = () => {
    const initialRows: TableRow[] = Array.from({ length: memberCount }, (_, i) => ({
      id: i + 1,
      name: `সদস্য নাম ${i + 1}`,
      group: 'উপদল এ',
      skill: 'দক্ষতা'
    }));
    setTableData(initialRows);
    setDocumentTitle('সদস্য তথ্য তালিকা রেজিস্টার - ২০২৬');
    setView('EDITOR');
    logActivity(`Started editing list with ${memberCount} members`);
  };

  const saveCurrentList = () => {
    if (!currentUser) return;
    
    // Save to Saved Lists
    const newList: SavedList = {
      id: Math.random().toString(36).substr(2, 9),
      name: documentTitle || "Untitled List",
      timestamp: Date.now(),
      data: [...tableData]
    };

    const updatedUser: User = {
      ...currentUser,
      savedLists: [...(currentUser.savedLists || []), newList]
    };

    setUsers(prev => prev.map(u => u.username === currentUser.username ? updatedUser : u));
    setCurrentUser(updatedUser);
    
    showToast(`"${newList.name}" সংরক্ষিত হয়েছে!`, "success");
    logActivity(`Saved list: ${newList.name}`);
  };

  const loadSavedList = (list: SavedList) => {
    setTableData(list.data);
    setMemberCount(list.data.length);
    setDocumentTitle(list.name);
    setView('EDITOR');
    showToast(`Loaded list: ${list.name}`, "info");
    logActivity(`Loaded saved list: ${list.name}`);
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUser) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const updatedUser = { ...currentUser, profilePic: base64String };
        setUsers(prev => prev.map(u => u.username === currentUser.username ? updatedUser : u));
        setCurrentUser(updatedUser);
        showToast("Profile picture updated", "success");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExport = async () => {
    if (!documentRef.current) return;
    const pageElements = documentRef.current.querySelectorAll('.a4-page');
    
    setIsProcessing(true);
    try {
      if (pageElements.length === 1) {
        const canvas = await html2canvas(pageElements[0] as HTMLElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const link = document.createElement('a');
        link.download = `${documentTitle || 'List'}_${Date.now()}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.9);
        link.click();
        showToast("JPEG Downloaded", "success");
      } else {
        const zip = new JSZip();
        for (let i = 0; i < pageElements.length; i++) {
          const canvas = await html2canvas(pageElements[i] as HTMLElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          const imgData = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
          zip.file(`Page_${i + 1}.jpg`, imgData, { base64: true });
        }
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.download = `${documentTitle || 'Lists'}_Package_${Date.now()}.zip`;
        link.href = URL.createObjectURL(content);
        link.click();
        showToast("ZIP Downloaded", "success");
      }
    } catch (err) {
      showToast("Export failed", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const exportAllUsersCSV = () => {
    if (users.length === 0) return showToast("No users to export", "error");
    
    const headers = ["Full Name", "Email", "Username", "Password", "Phone", "Status", "Role", "Notifications Count"];
    const rows = users.map(u => [
      `"${u.fullName}"`,
      `"${u.email}"`,
      `"${u.username}"`,
      `"${u.password || 'N/A'}"`,
      `"${u.phone || 'N/A'}"`,
      u.isActive ? "Active" : "Banned",
      u.role,
      u.notifications.length
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(r => r.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Full_Users_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV Export Successful", "success");
  };

  const pages = useMemo(() => {
    const result = [];
    const firstPageLimit = 15;
    const otherPageLimit = 20;
    
    if (tableData.length <= firstPageLimit) {
      result.push(tableData);
    } else {
      result.push(tableData.slice(0, firstPageLimit));
      let remaining = tableData.slice(firstPageLimit);
      while (remaining.length > 0) {
        result.push(remaining.slice(0, otherPageLimit));
        remaining = remaining.slice(otherPageLimit);
      }
    }
    return result;
  }, [tableData]);

  const toggleUserStatus = (uname: string) => {
    setUsers(prev => prev.map(u => u.username === uname ? { ...u, isActive: !u.isActive } : u));
    showToast(`User status updated for ${uname}`, "info");
  };

  const deleteUser = (uname: string) => {
    if (confirm(`ARE YOU SURE? This will permanently remove user: @${uname}`)) {
      if (confirm(`FINAL WARNING: Delete @${uname}?`)) {
        setUsers(prev => prev.filter(u => u.username !== uname));
        showToast(`User @${uname} deleted permanently`, "error");
        logActivity(`Admin deleted account: @${uname}`, ADMIN_CREDS.USERNAME);
      }
    }
  };

  const sendGlobalBroadcast = () => {
    if (!broadcastMessage.trim()) return showToast("Message cannot be empty", "error");
    
    setUsers(prev => prev.map(u => {
      const personalized = broadcastMessage
        .split('{username}').join(u.username)
        .split('{fullName}').join(u.fullName);
      return { ...u, notifications: [...u.notifications, personalized] };
    }));
    
    setBroadcastMessage('');
    setIsBroadcastModalOpen(false);
    showToast("Global broadcast sent!", "success");
    logActivity('Admin sent global broadcast', ADMIN_CREDS.USERNAME);
  };

  const sendIndividualMessage = (isReportDone: boolean = false) => {
    if (!selectedTargetUser || (!individualMessage.trim() && !isReportDone)) return;
    
    const msg = isReportDone ? "আপনার রিকোয়েস্টটি সম্পন্ন হয়েছে। ধন্যবাদ।" : individualMessage;

    setUsers(prev => prev.map(u => {
      if (u.username === selectedTargetUser) {
        return { ...u, notifications: [...u.notifications, msg] };
      }
      return u;
    }));
    
    if (isReportDone) {
      setReports(prev => prev.filter(r => r.username !== selectedTargetUser));
      showToast(`Report resolved for ${selectedTargetUser}`, "success");
    } else {
      showToast(`Message sent to @${selectedTargetUser}`, "success");
    }
    
    setIndividualMessage('');
    setSelectedTargetUser(null);
    logActivity(`Admin messaged user: @${selectedTargetUser}`, ADMIN_CREDS.USERNAME);
  };

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return users;
    return users.filter(u => 
      u.fullName.toLowerCase().includes(query) || 
      u.username.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMsg,
        config: {
          systemInstruction: "You are NAHID-AI. You are helpful, professional and speak Bengali/English. You help with TeamInfo Hub tasks."
        }
      });
      setChatHistory(prev => [...prev, { role: 'ai', text: response.text || "I couldn't generate a response." }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "Chat connection error." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Toast System */}
      <div className="fixed top-6 right-6 z-[999] space-y-3 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-up pointer-events-auto border border-white/20 backdrop-blur-md ${
            t.type === 'success' ? 'bg-emerald-600 text-white' : 
            t.type === 'error' ? 'bg-red-600 text-white' : 'bg-black text-white'
          }`}>
            {t.type === 'success' ? <CheckCircle size={18}/> : t.type === 'error' ? <XCircle size={18}/> : <Bell size={18}/>}
            <span className="font-bold text-sm">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Auth View */}
      {view === 'AUTH' && (
        <div className="flex-1 flex items-center justify-center p-4 bg-slate-100">
          <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden animate-slide-up border border-slate-200">
            <div className="bg-black p-12 text-white text-center">
              <Shield className="mx-auto mb-6" size={56} />
              <h1 className="text-3xl font-black italic uppercase tracking-tighter">
                {authMode === 'admin_login' ? 'NAHID GATEWAY' : 'TeamInfo Hub'}
              </h1>
              <p className="text-[10px] uppercase tracking-[6px] opacity-40 mt-3 font-bold">Secure Management v4.0</p>
            </div>
            
            <form onSubmit={handleAuth} className="p-10 space-y-5">
              {authMode === 'register' && (
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-black transition-colors" size={18} />
                  <input required placeholder="Full Name" className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border border-transparent focus:bg-white focus:border-black outline-none transition-all font-bold text-sm" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                </div>
              )}

              <div className="relative group">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-black transition-colors" size={18} />
                <input required placeholder={authMode === 'admin_login' ? "Admin ID" : "Username"} className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border border-transparent focus:bg-white focus:border-black outline-none transition-all font-bold text-sm" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
              </div>

              {(authMode === 'register' || authMode === 'forgot') && (
                <div className="relative group">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-black transition-colors" size={18} />
                  <input required placeholder="Phone Number" className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border border-transparent focus:bg-white focus:border-black outline-none transition-all font-bold text-sm" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              )}

              {authMode === 'register' && (
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-black transition-colors" size={18} />
                  <input required type="email" placeholder="Email Address" className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border border-transparent focus:bg-white focus:border-black outline-none transition-all font-bold text-sm" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              )}

              {authMode === 'forgot' && (
                <textarea required placeholder="Brief message for admin..." className="w-full px-6 py-4 bg-slate-50 rounded-2xl border border-transparent focus:bg-white focus:border-black outline-none transition-all font-bold text-sm h-32 resize-none" value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} />
              )}

              {authMode !== 'forgot' && (
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-black transition-colors" size={18} />
                  <input required type="password" placeholder="Password" className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border border-transparent focus:bg-white focus:border-black outline-none transition-all font-bold text-sm" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                </div>
              )}

              {authMode === 'register' && (
                <div className="flex gap-2">
                  <div className="bg-black text-white px-5 py-4 rounded-2xl font-black italic select-none flex items-center shadow-lg">{captcha}</div>
                  <input required placeholder="Captcha" className="flex-1 px-5 py-4 bg-slate-50 rounded-2xl border border-transparent focus:bg-white focus:border-black outline-none font-bold text-sm" value={formData.captchaInput} onChange={e => setFormData({...formData, captchaInput: e.target.value})} />
                </div>
              )}

              <button type="submit" disabled={isProcessing} className="btn-active w-full bg-black text-white py-5 rounded-2xl font-black text-lg hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 shadow-2xl">
                {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                {authMode === 'login' ? 'লগইন করুন' : authMode === 'register' ? 'নিবন্ধন করুন' : authMode === 'forgot' ? 'রিপোর্ট পাঠান' : 'অ্যাডমিন এক্সেস'}
              </button>
            </form>

            <div className="px-10 pb-10 flex flex-wrap justify-center gap-6 text-[10px] font-black uppercase tracking-[3px] text-gray-400">
              <button onClick={() => setAuthMode('login')} className={`transition-all ${authMode === 'login' ? 'text-black opacity-100 scale-110' : 'hover:text-black opacity-50'}`}>Login</button>
              <button onClick={() => setAuthMode('register')} className={`transition-all ${authMode === 'register' ? 'text-black opacity-100 scale-110' : 'hover:text-black opacity-50'}`}>Register</button>
              <button onClick={() => setAuthMode('forgot')} className={`transition-all ${authMode === 'forgot' ? 'text-black opacity-100 scale-110' : 'hover:text-black opacity-50'}`}>Forgot</button>
              <button onClick={() => setAuthMode('admin_login')} className={`transition-all ${authMode === 'admin_login' ? 'text-black opacity-100 scale-110' : 'hover:text-black opacity-50'}`}>Admin</button>
            </div>
          </div>
        </div>
      )}

      {/* User Dashboard */}
      {view === 'DASHBOARD' && currentUser && (
        <div className="flex-1 bg-slate-50 p-6 md:p-12 space-y-8 animate-slide-up">
          <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
            <div className="flex items-center gap-8 group">
              <div className="relative w-20 h-20 md:w-24 md:h-24">
                {currentUser.profilePic ? (
                  <img src={currentUser.profilePic} className="w-full h-full object-cover rounded-3xl shadow-xl" alt="Profile" />
                ) : (
                  <div className="w-full h-full bg-black rounded-3xl flex items-center justify-center text-white shadow-xl"><UserIcon size={40}/></div>
                )}
                <label className="absolute -bottom-2 -right-2 bg-white p-2 rounded-xl shadow-lg border border-slate-100 cursor-pointer hover:scale-110 transition-transform">
                  <Camera size={16}/>
                  <input type="file" className="hidden" accept="image/*" onChange={handleProfilePicChange} />
                </label>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black italic">{currentUser.fullName}</h1>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Status: <span className="text-emerald-500">Active</span></p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">UID: @{currentUser.username}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="btn-active w-full md:w-auto bg-red-50 text-red-600 px-8 py-4 rounded-3xl font-black flex items-center justify-center gap-3 hover:bg-red-600 hover:text-white transition-all shadow-sm"><LogOut size={20}/> Logout</button>
          </header>

          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white p-8 md:p-12 rounded-[40px] shadow-sm border border-slate-100">
                <h2 className="text-xl md:text-2xl font-black italic flex items-center gap-4 mb-10"><FileText className="opacity-20"/> তালিকা তৈরি করুন</h2>
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="flex-1 w-full">
                    <label className="text-[10px] font-black uppercase tracking-[4px] text-gray-400 mb-4 block">সদস্য সংখ্যা লিখুন (ম্যাক্স ৫০০)</label>
                    <input type="number" min="1" max="500" value={memberCount} onChange={e => setMemberCount(parseInt(e.target.value) || 0)} className="w-full px-8 py-5 bg-slate-50 rounded-[30px] border-none outline-none font-black text-3xl focus:ring-4 focus:ring-black/5 transition-all" />
                  </div>
                  <button onClick={startEditing} className="btn-active w-full md:w-auto bg-black text-white px-12 py-6 rounded-[30px] font-black text-lg flex items-center justify-center gap-4 shadow-2xl hover:scale-105 transition-all"><PlusCircle size={28}/> ইনপুট শুরু করুন</button>
                </div>
              </div>

              {/* Saved Lists Box with Activity Log Button */}
              <div className="bg-white p-8 md:p-12 rounded-[40px] shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl md:text-2xl font-black italic flex items-center gap-4">
                    {dashboardTab === 'lists' ? <Save className="opacity-20"/> : <Activity className="opacity-20"/>}
                    {dashboardTab === 'lists' ? 'সংরক্ষিত তালিকা' : 'অ্যাক্টিভিটি লগ'}
                  </h2>
                  <button 
                    onClick={() => setDashboardTab(dashboardTab === 'lists' ? 'logs' : 'lists')}
                    className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all shadow-sm"
                  >
                    {dashboardTab === 'lists' ? <Activity size={14}/> : <List size={14}/>}
                    {dashboardTab === 'lists' ? 'অ্যাক্টিভিটি লগ' : 'সংরক্ষিত তালিকা'}
                  </button>
                </div>
                
                <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {dashboardTab === 'lists' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentUser.savedLists?.slice().reverse().map(list => (
                        <div key={list.id} className="bg-slate-50 p-6 rounded-[30px] border border-black/5 hover:border-black/20 transition-all flex flex-col justify-between group">
                          <div>
                            <h4 className="font-black italic text-lg leading-tight mb-2">{list.name}</h4>
                            <p className="text-[10px] font-bold opacity-30 uppercase">{toBengaliNumber(list.data.length)} সদস্য • {new Date(list.timestamp).toLocaleDateString()}</p>
                          </div>
                          <button onClick={() => loadSavedList(list)} className="mt-6 w-full py-3 bg-white border border-black/10 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all group-hover:shadow-lg">লোড করুন</button>
                        </div>
                      ))}
                      {(!currentUser.savedLists || currentUser.savedLists.length === 0) && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-10">
                          <Save size={64}/>
                          <p className="font-black text-sm uppercase tracking-widest mt-4">কোন তালিকা সংরক্ষিত নেই</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {currentUser.activityLog?.slice().reverse().map((log, i) => (
                        <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-black/5">
                          <span className="font-bold text-gray-700 text-sm">{log.action}</span>
                          <span className="text-[9px] font-black opacity-30 uppercase">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      ))}
                      {(!currentUser.activityLog || currentUser.activityLog.length === 0) && (
                        <div className="py-20 flex flex-col items-center opacity-10">
                          <Activity size={64}/>
                          <p className="font-black text-sm uppercase tracking-widest mt-4">কোন তথ্য পাওয়া যায়নি</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-white p-8 md:p-10 rounded-[40px] shadow-sm flex flex-col h-full border border-slate-100">
                <h2 className="text-xl font-black italic flex items-center gap-4 mb-10"><Bell className="opacity-20"/> নোটিশবোর্ড</h2>
                <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
                  {currentUser.notifications.slice().reverse().map((n, i) => (
                    <div key={i} className="bg-indigo-50/50 text-indigo-700 p-6 rounded-[35px] font-bold text-sm relative overflow-hidden border border-indigo-100">
                      <div className="absolute top-0 right-0 p-3 opacity-5"><Bell size={40}/></div>
                      <p className="leading-relaxed">{n}</p>
                    </div>
                  ))}
                  {currentUser.notifications.length === 0 && (
                    <div className="py-20 flex flex-col items-center opacity-10">
                      <Bell size={48}/>
                      <p className="text-[10px] font-black mt-4 uppercase">কোন নোটিশ নেই</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Dashboard */}
      {view === 'ADMIN' && currentUser?.role === 'admin' && (
        <div className="flex-1 bg-slate-100 p-6 md:p-12 space-y-10 animate-slide-up pb-32">
          <header className="bg-black text-white p-10 rounded-[50px] flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl">
            <div className="flex items-center gap-8 group">
              <div className="relative w-24 h-24">
                {currentUser.profilePic ? (
                  <img src={currentUser.profilePic} className="w-full h-full object-cover rounded-3xl shadow-xl" alt="Admin" />
                ) : (
                  <div className="w-full h-full bg-white text-black rounded-3xl flex items-center justify-center shadow-2xl"><Shield size={48}/></div>
                )}
                <label className="absolute -bottom-2 -right-2 bg-white p-2 rounded-xl shadow-lg border border-slate-100 cursor-pointer hover:scale-110 transition-transform">
                  <Camera size={16} className="text-black"/>
                  <input type="file" className="hidden" accept="image/*" onChange={handleProfilePicChange} />
                </label>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter leading-none">Admin Control</h1>
                <p className="text-[10px] font-black uppercase tracking-[10px] opacity-40 mt-4 font-bold">Nahidul Professional Hub</p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <button onClick={exportAllUsersCSV} className="btn-active bg-white/10 text-white px-8 py-4 rounded-[30px] font-black flex items-center gap-3 hover:bg-white/20 transition-all">
                <Download size={20}/> Export Users (CSV)
              </button>
              <button onClick={handleLogout} className="btn-active bg-white text-black px-12 py-5 rounded-[30px] font-black text-xl shadow-xl">Exit Admin</button>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 hover:scale-105 transition-transform">
              <p className="text-[10px] font-black uppercase opacity-40 tracking-widest mb-3">Total Users</p>
              <h3 className="text-6xl font-black italic">{toBengaliNumber(users.length)}</h3>
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 hover:scale-105 transition-transform">
              <p className="text-[10px] font-black uppercase opacity-40 tracking-widest mb-3">Active Reports</p>
              <h3 className="text-6xl font-black italic">{toBengaliNumber(reports.filter(r => r.status === 'pending').length)}</h3>
            </div>
            <div className="lg:col-span-2 bg-white p-8 rounded-[40px] shadow-sm flex items-center justify-between border border-slate-200">
              <div>
                <p className="text-[10px] font-black uppercase opacity-40 tracking-widest">Global Action</p>
                <h3 className="text-2xl md:text-3xl font-black italic mt-2">Personalized Broadcast</h3>
              </div>
              <button onClick={() => setIsBroadcastModalOpen(true)} className="btn-active p-6 bg-black text-white rounded-[30px] hover:scale-110 transition-transform shadow-2xl"><Bell size={32}/></button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* User Records with Enhanced Search */}
            <div className="bg-white rounded-[50px] shadow-xl overflow-hidden flex flex-col h-[700px] border border-slate-200">
              <div className="p-8 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
                <h2 className="text-2xl font-black italic uppercase">User Database</h2>
                <div className="relative w-full md:w-80">
                  <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"/>
                  <input 
                    type="text" 
                    placeholder="Search name or @username..." 
                    className="w-full pl-14 pr-6 py-4 bg-white rounded-3xl outline-none border border-slate-200 focus:border-black transition-all font-bold text-sm shadow-sm"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-[10px] font-black uppercase tracking-widest sticky top-0 z-20">
                    <tr>
                      <th className="px-8 py-6 border-none">Member</th>
                      <th className="px-8 py-6 border-none text-center">Status</th>
                      <th className="px-8 py-6 border-none text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.username} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                        <td className="px-8 py-6 border-none">
                          <div className="flex items-center gap-4">
                            {u.profilePic ? (
                              <img src={u.profilePic} className="w-12 h-12 rounded-2xl object-cover shadow-md" alt="User" />
                            ) : (
                              <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center text-black/20"><UserIcon size={20}/></div>
                            )}
                            <div>
                              <p className="font-black text-lg italic leading-tight">{u.fullName}</p>
                              <p className="text-[11px] font-bold opacity-30 mt-1">@{u.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 border-none text-center">
                          <span className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {u.isActive ? 'Verified' : 'Banned'}
                          </span>
                        </td>
                        <td className="px-8 py-6 border-none text-right space-x-3">
                          <button onClick={() => setViewUserDetails(u)} className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-black hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-sm"><Eye size={18}/></button>
                          <button onClick={() => setSelectedTargetUser(u.username)} className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-black hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-sm"><MessageCircle size={18}/></button>
                          <button onClick={() => toggleUserStatus(u.username)} className={`p-3 rounded-2xl shadow-sm transition-all ${u.isActive ? 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`}>
                            {u.isActive ? <XCircle size={18}/> : <CheckCircle size={18}/>}
                          </button>
                          <button onClick={() => deleteUser(u.username)} className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-sm">
                            <Trash2 size={18}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-20 text-center opacity-10">
                          <Search size={64} className="mx-auto mb-4"/>
                          <p className="font-black uppercase tracking-widest">No matching found</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Critical Reports */}
            <div className="bg-white rounded-[50px] shadow-xl overflow-hidden flex flex-col h-[700px] border border-slate-200">
              <div className="p-8 border-b bg-slate-50/50">
                <h2 className="text-2xl font-black italic uppercase">Critical Reports</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {reports.slice().reverse().map(r => (
                  <div key={r.id} className="bg-slate-50 p-8 rounded-[40px] border border-black/5 hover:border-black/20 transition-all relative group shadow-sm">
                    <div className="flex justify-between items-start mb-6">
                      <span className="text-[10px] font-black bg-black text-white px-4 py-2 rounded-full tracking-widest">ID: {r.id}</span>
                      <span className="text-[10px] font-black opacity-20 uppercase">{new Date(r.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="font-black text-xl italic text-black">@{r.username}</p>
                    <p className="text-sm font-medium text-slate-600 mt-4 mb-6 leading-relaxed bg-white/50 p-5 rounded-3xl border border-black/5">{r.message}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 font-bold text-xs bg-black/5 px-4 py-2 rounded-xl text-slate-500"><Smartphone size={16}/> {r.phone}</div>
                      <div className="flex gap-3">
                        <button onClick={() => setSelectedTargetUser(r.username)} className="btn-active p-3 bg-white text-black border border-black/10 rounded-2xl hover:shadow-lg transition-all"><MessageCircle size={20}/></button>
                        <button onClick={() => { setSelectedTargetUser(r.username); sendIndividualMessage(true); }} className="btn-active bg-black text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all">Mark as Done</button>
                      </div>
                    </div>
                  </div>
                ))}
                {reports.length === 0 && (
                  <div className="py-40 text-center opacity-10">
                    <CheckCircle size={64} className="mx-auto mb-4"/>
                    <p className="font-black uppercase tracking-widest">System Clear - No Reports</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modals */}
          {isBroadcastModalOpen && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 backdrop-blur-xl bg-black/30">
              <div className="w-full max-w-2xl bg-white rounded-[50px] shadow-2xl overflow-hidden animate-slide-up border border-slate-200">
                <div className="bg-black p-10 text-white flex justify-between items-center">
                  <div>
                    <h3 className="text-3xl font-black italic uppercase leading-none">Global Broadcast</h3>
                    <p className="text-[10px] font-black uppercase opacity-40 mt-4 tracking-[6px]">Distribution Panel</p>
                  </div>
                  <button onClick={() => setIsBroadcastModalOpen(false)} className="hover:opacity-50 transition-all"><X size={32}/></button>
                </div>
                <div className="p-10 space-y-8">
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-3xl border border-black/5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase opacity-40">Tag Name</span>
                      <code className="text-black font-black text-xs">{`{fullName}`}</code>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase opacity-40">Tag ID</span>
                      <code className="text-black font-black text-xs">{`{username}`}</code>
                    </div>
                  </div>
                  <textarea 
                    placeholder="Type broadcast message..."
                    className="w-full h-48 px-8 py-6 bg-slate-50 rounded-[40px] outline-none border-none focus:ring-4 focus:ring-black/5 transition-all font-bold text-slate-700 resize-none shadow-inner"
                    value={broadcastMessage}
                    onChange={e => setBroadcastMessage(e.target.value)}
                  />
                  <button onClick={sendGlobalBroadcast} className="btn-active w-full bg-black text-white py-6 rounded-[30px] font-black text-lg flex items-center justify-center gap-4 hover:shadow-2xl transition-all"><Send size={24}/> Send to All</button>
                </div>
              </div>
            </div>
          )}

          {selectedTargetUser && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 backdrop-blur-xl bg-black/30">
              <div className="w-full max-w-lg bg-white rounded-[50px] shadow-2xl overflow-hidden animate-slide-up border border-slate-200">
                <div className="bg-black p-10 text-white flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-black italic uppercase leading-none">Direct Message</h3>
                    <p className="text-[10px] font-black uppercase opacity-40 mt-4 tracking-[4px]">Target: @{selectedTargetUser}</p>
                  </div>
                  <button onClick={() => setSelectedTargetUser(null)} className="hover:opacity-50 transition-all"><X size={28}/></button>
                </div>
                <div className="p-10 space-y-8">
                  <textarea 
                    placeholder={`Message for @${selectedTargetUser}...`}
                    className="w-full h-40 px-8 py-6 bg-slate-50 rounded-[40px] outline-none border-none focus:ring-4 focus:ring-black/5 transition-all font-bold text-slate-700 resize-none shadow-inner"
                    value={individualMessage}
                    onChange={e => setIndividualMessage(e.target.value)}
                  />
                  <button onClick={() => sendIndividualMessage(false)} className="btn-active w-full bg-black text-white py-6 rounded-[30px] font-black text-lg flex items-center justify-center gap-4 hover:shadow-2xl transition-all"><Send size={24}/> Deliver Message</button>
                </div>
              </div>
            </div>
          )}

          {viewUserDetails && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 backdrop-blur-xl bg-black/30">
              <div className="w-full max-w-2xl bg-white rounded-[50px] shadow-2xl overflow-hidden animate-slide-up border border-slate-200">
                <div className="bg-black p-10 text-white flex justify-between items-center">
                  <h3 className="text-2xl font-black italic uppercase">Node Diagnostics</h3>
                  <button onClick={() => setViewUserDetails(null)} className="hover:opacity-50"><X size={28}/></button>
                </div>
                <div className="p-10 space-y-8">
                  <div className="flex items-center gap-8 border-b border-slate-100 pb-10">
                    <div className="w-24 h-24 bg-slate-100 rounded-3xl overflow-hidden shadow-xl">
                      {viewUserDetails.profilePic ? <img src={viewUserDetails.profilePic} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><UserIcon size={40}/></div>}
                    </div>
                    <div>
                      <h4 className="text-3xl font-black italic">{viewUserDetails.fullName}</h4>
                      <p className="font-bold opacity-30 text-sm">@{viewUserDetails.username}</p>
                      <div className="mt-4 flex gap-3">
                        <span className="px-4 py-1.5 bg-black text-white text-[9px] font-black uppercase rounded-full">Role: {viewUserDetails.role}</span>
                        <span className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-full ${viewUserDetails.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {viewUserDetails.isActive ? 'Status: Active' : 'Status: Banned'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase opacity-30 tracking-widest">Contact Identity</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 text-sm font-bold"><Mail size={16} className="opacity-20"/> {viewUserDetails.email}</div>
                        <div className="flex items-center gap-3 text-sm font-bold"><Smartphone size={16} className="opacity-20"/> {viewUserDetails.phone || 'No Phone'}</div>
                        <div className="flex items-center gap-3 text-sm font-bold text-red-600 bg-red-50 p-2 rounded-xl border border-red-100"><Lock size={16} className="opacity-40"/> Password: {viewUserDetails.password}</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase opacity-30 tracking-widest">Storage Status</p>
                      <div className="text-sm font-bold bg-slate-50 p-4 rounded-2xl border border-black/5">
                        সংরক্ষিত তালিকা: {toBengaliNumber(viewUserDetails.savedLists?.length || 0)} টি
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* A4 Editor View */}
      {view === 'EDITOR' && (
        <div className="flex-1 bg-slate-200">
          <div className="no-print bg-white/90 backdrop-blur-md sticky top-0 z-50 p-4 border-b flex flex-col md:flex-row justify-between items-center gap-4 px-6 md:px-10">
            <div className="flex items-center gap-4">
              <button onClick={() => setView('DASHBOARD')} className="btn-active p-3 bg-black text-white rounded-2xl hover:scale-110 transition-transform shadow-xl"><ChevronLeft size={20}/></button>
              <div className="flex flex-col">
                <input 
                  className="bg-transparent font-black italic uppercase tracking-tighter outline-none border-b border-transparent focus:border-black/20 text-sm md:text-base w-40 md:w-64"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                />
                <span className="text-[8px] font-bold opacity-30 uppercase tracking-widest">Document Editor</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button onClick={saveCurrentList} className="btn-active flex items-center gap-2 bg-emerald-600 text-white px-6 md:px-8 py-2 md:py-3 rounded-2xl font-bold text-xs md:text-sm shadow-xl hover:scale-105 transition-all">
                <Save size={16} /> সেভ করুন
              </button>
              <button onClick={handleExport} disabled={isProcessing} className="btn-active flex items-center gap-2 bg-black text-white px-6 md:px-8 py-2 md:py-3 rounded-2xl font-bold text-xs md:text-sm shadow-xl hover:scale-105 transition-all disabled:opacity-50">
                {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                ডাউনলোড {pages.length > 1 ? '(ZIP)' : '(JPG)'}
              </button>
            </div>
          </div>

          <div className="document-scroller" ref={documentRef}>
            {pages.map((pRows, pIdx) => (
              <div key={pIdx} className="a4-page official-font">
                {pIdx === 0 && (
                  <div className="flex flex-col items-center mb-10 border-b-2 border-black pb-8">
                    <div className="w-full flex justify-between items-start mb-6">
                      <img src={LOGO_URL} className="logo-img" alt="Logo" />
                      <div className="text-right flex flex-col items-end">
                        <p contentEditable className="text-[10px] font-black uppercase tracking-[8px] opacity-20 italic focus:bg-slate-100 p-1">Official Record</p>
                        <div className="flex items-center gap-1 text-xs font-black italic mt-1">
                          <span>তারিখ:</span>
                          <span contentEditable className="min-w-fit text-right focus:bg-slate-100 px-1 border-none outline-none">{new Date().toLocaleDateString('bn-BD')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-center space-y-2">
                      <h1 contentEditable className="text-2xl font-black uppercase tracking-tight text-black focus:bg-slate-100 outline-none">রাজশাহী পলিটেকনিক ইনস্টিটিউট রোভার স্কাউট গ্রুপ</h1>
                      <h3 contentEditable 
                        className="text-lg font-bold italic text-gray-500 focus:bg-slate-100 outline-none"
                        onBlur={(e) => setDocumentTitle(e.currentTarget.innerText)}
                      >{documentTitle}</h3>
                    </div>
                  </div>
                )}

                <div className="flex-1">
                  <table>
                    <thead>
                      <tr>
                        <th className="w-16"><div contentEditable className="focus:bg-slate-200 outline-none">ক্রঃ</div></th>
                        <th className="text-left px-8"><div contentEditable className="focus:bg-slate-200 outline-none">সদস্যের নাম</div></th>
                        <th className="w-40"><div contentEditable className="focus:bg-slate-200 outline-none">উপদল</div></th>
                        <th className="w-40"><div contentEditable className="focus:bg-slate-200 outline-none">দক্ষতা / মন্তব্য</div></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pRows.map((row, rIdx) => {
                        const globalIndex = pIdx === 0 ? rIdx : 15 + (pIdx - 1) * 20 + rIdx;
                        return (
                          <tr key={globalIndex}>
                            <td className="font-bold">{toBengaliNumber(globalIndex + 1)}</td>
                            <td contentEditable className="text-left px-8 font-bold italic outline-none" onBlur={(e) => {
                              const newTable = [...tableData];
                              newTable[globalIndex].name = e.currentTarget.innerText;
                              setTableData(newTable);
                            }}>{row.name}</td>
                            <td contentEditable className="font-medium outline-none" onBlur={(e) => {
                              const newTable = [...tableData];
                              newTable[globalIndex].group = e.currentTarget.innerText;
                              setTableData(newTable);
                            }}>{row.group}</td>
                            <td contentEditable className="font-medium outline-none" onBlur={(e) => {
                              const newTable = [...tableData];
                              newTable[globalIndex].skill = e.currentTarget.innerText;
                              setTableData(newTable);
                            }}>{row.skill}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-8 flex justify-between items-end opacity-40 text-[9px] font-black uppercase tracking-[5px] pt-6">
                  <span contentEditable className="focus:bg-slate-100 p-1 outline-none">Page {pIdx + 1} of {pages.length}</span>
                  <span contentEditable className="focus:bg-slate-100 p-1 outline-none">Managed & Powered by TeamInfo Premium</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating NAHID-AI Chatbox */}
      <div className={`no-print fixed bottom-24 right-6 z-[100] transition-all duration-500 ease-in-out ${isChatOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-20 opacity-0 scale-90 pointer-events-none'}`}>
        <div className="w-[320px] md:w-[420px] bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-slate-200 backdrop-blur-3xl">
          <div className="bg-black p-6 text-white flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center shadow-lg"><Sparkles size={18}/></div>
              <div className="flex flex-col">
                <span className="font-black italic text-sm tracking-tight">NAHID-AI V2</span>
                <span className="text-[8px] font-bold opacity-30 uppercase tracking-widest font-bold">Neural Assistant Active</span>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="hover:rotate-90 transition-all opacity-50"><X size={24}/></button>
          </div>
          <div className="flex-1 h-[450px] overflow-y-auto p-6 space-y-6 bg-slate-50/80 custom-scrollbar">
            <div className="bg-white p-5 rounded-[30px] rounded-tl-none border border-black/5 shadow-sm text-xs font-bold text-slate-600 leading-relaxed">
              Hello! I am NAHID-AI. How can I assist you with your team management today?
            </div>
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-5 rounded-[30px] text-xs font-bold shadow-sm leading-relaxed ${msg.role === 'user' ? 'bg-black text-white rounded-tr-none' : 'bg-white text-slate-600 rounded-tl-none border border-black/5'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-4 rounded-3xl rounded-tl-none border border-black/5 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-black rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleChatSubmit} className="p-4 bg-white border-t border-slate-100 flex gap-3">
            <input 
              value={chatInput} 
              onChange={e => setChatInput(e.target.value)} 
              placeholder="Type your query..." 
              className="flex-1 px-6 py-3 bg-slate-100 rounded-[25px] outline-none text-xs font-bold focus:bg-white focus:ring-2 focus:ring-black transition-all"
            />
            <button type="submit" className="btn-active bg-black text-white p-3 rounded-2xl hover:shadow-xl transition-all">
              <Send size={18}/>
            </button>
          </form>
        </div>
      </div>

      <button onClick={() => setIsChatOpen(!isChatOpen)} className="btn-active no-print fixed bottom-8 right-8 z-[101] w-16 h-16 bg-black text-white rounded-[25px] shadow-2xl flex items-center justify-center hover:scale-110 transition-transform">
        {isChatOpen ? <X size={28}/> : <MessageCircle size={28}/>}
      </button>

      {/* Sticky Glass Footer */}
      <footer className="glass-footer fixed bottom-0 left-0 w-full py-5 md:py-6 px-10 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0 z-50 no-print">
        <div className="flex items-center gap-6">
          <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center text-white shadow-xl"><Shield size={18}/></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[3px] text-black/80 leading-none">Secure Authorized</span>
            <span className="text-[7px] font-bold opacity-30 uppercase tracking-widest mt-1">E2E Encryption Active</span>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <a href="https://www.facebook.com/nahidul407" target="_blank" className="text-[10px] font-black uppercase tracking-[5px] text-black hover:opacity-50 transition-all">MD. NAHIDUL ISLAM</a>
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
        </div>
      </footer>
    </div>
  );
};

export default App;
