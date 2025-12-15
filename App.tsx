import React, { useState, useEffect, useCallback } from 'react';
import { Role, Checkpoint, ScanLog, User, ScanStatus } from './types';
import Dashboard from './components/Dashboard';
import Scanner from './components/Scanner';
import HelpModal from './components/HelpModal';
import AdminQrSetup from './components/AdminQrSetup';
import { saveLogToSheet, fetchAllDataFromSheet, getScriptUrl, addOfficerToSheet, removeOfficerFromSheet, addCheckpointToSheet } from './services/sheetService';

// --- MOCK DATA SETUP ---
const DEFAULT_CHECKPOINTS: Checkpoint[] = [
  { 
    id: 'cp-001', 
    name: 'Main Entrance Gate', 
    location: { latitude: 13.7563, longitude: 100.5018 }, 
    allowedRadiusMeters: 100,
    schedule: { 
      type: 'FIXED_TIME', 
      fixedTimes: ['08:00', '12:00', '16:00', '20:00'], 
      toleranceMinutes: 10 // Requested +/- 10 minutes
    }
  },
  { 
    id: 'cp-002', 
    name: 'Server Room B2', 
    location: { latitude: 13.7565, longitude: 100.5020 }, 
    allowedRadiusMeters: 50,
    schedule: { type: 'INTERVAL', intervalMinutes: 60 }
  }
];

const DEFAULT_OFFICERS: User[] = [
  { id: 'OFF-001', name: 'Somsak Jaidee', role: Role.OFFICER },
  { id: 'OFF-002', name: 'Mana Meemark', role: Role.OFFICER }
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'scanner' | 'admin-setup'>('dashboard');
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [initialScanId, setInitialScanId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // --- PERSISTENCE: CHECKPOINTS ---
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(() => {
    try {
      const saved = localStorage.getItem('securepatrol_checkpoints');
      return saved ? JSON.parse(saved) : DEFAULT_CHECKPOINTS;
    } catch (e) {
      return DEFAULT_CHECKPOINTS;
    }
  });

  // --- PERSISTENCE: OFFICERS ---
  const [officers, setOfficers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('securepatrol_officers');
      return saved ? JSON.parse(saved) : DEFAULT_OFFICERS;
    } catch (e) {
      return DEFAULT_OFFICERS;
    }
  });

  useEffect(() => {
    localStorage.setItem('securepatrol_checkpoints', JSON.stringify(checkpoints));
  }, [checkpoints]);

  useEffect(() => {
    localStorage.setItem('securepatrol_officers', JSON.stringify(officers));
  }, [officers]);

  // --- DATA SYNC ---
  const loadCloudData = useCallback(async () => {
        if (!getScriptUrl()) return;
        setIsSyncing(true);
        try {
            const cloudData = await fetchAllDataFromSheet();
            
            // 1. Sync Logs
            if (cloudData.logs.length > 0) {
                setLogs(cloudData.logs);
            }

            // 2. Sync Officers
            if (cloudData.officers.length > 0) {
                console.log("Synced officers from Sheet:", cloudData.officers);
                setOfficers(cloudData.officers);
            }

            // 3. Sync Checkpoints
            if (cloudData.checkpoints.length > 0) {
                console.log("Synced checkpoints from Sheet:", cloudData.checkpoints);
                setCheckpoints(cloudData.checkpoints);
            }

            setLastSyncTime(new Date());
        } catch (e) {
            console.error("Sync failed:", e);
        } finally {
            setIsSyncing(false);
        }
    }, []);

  // Initial Load
  useEffect(() => {
    loadCloudData();
  }, [loadCloudData]);

  // --- DEEP LINK HANDLER ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cpId = params.get('checkpointId');

    if (cpId) {
        const exists = checkpoints.find(c => c.id === cpId);
        if (exists) {
            setInitialScanId(cpId);
            setCurrentView('scanner');
        } else {
            alert(`Error: Checkpoint ID "${cpId}" not found in system.`);
        }
        window.history.replaceState({}, '', window.location.pathname);
    }
  }, [checkpoints]);
  
  const handleScanComplete = async (log: ScanLog) => {
    // 1. Update Local State (Immediate Feedback)
    setLogs(prev => [...prev, log]);
    
    // 2. Save to Google Sheets (Fire and forget)
    // We don't await this to block UI, but we trigger a background sync after a delay to ensure consistency
    saveLogToSheet(log).then(() => {
        setTimeout(() => loadCloudData(), 2000); // Reload after 2s to get updated sheet status if needed
    });

    setInitialScanId(null);
    setCurrentView('dashboard');
  };

  const handleAddCheckpoint = async (newCheckpoint: Checkpoint) => {
      setCheckpoints(prev => [...prev, newCheckpoint]);
      // Save to Cloud
      await addCheckpointToSheet(newCheckpoint);
      loadCloudData(); // Trigger sync
  };

  const handleAddOfficer = async (newOfficer: User) => {
      setOfficers(prev => [...prev, newOfficer]);
      await addOfficerToSheet(newOfficer);
      loadCloudData(); // Sync to be sure
  };

  const handleRemoveOfficer = async (id: string) => {
      if (confirm('Are you sure you want to remove this officer?')) {
        setOfficers(prev => prev.filter(o => o.id !== id));
        await removeOfficerFromSheet(id);
        loadCloudData(); // Sync to be sure
      }
  };
  
  const handleImportCheckpoints = (imported: Checkpoint[]) => {
      setCheckpoints(imported);
      // Optional: Loop through and save all to sheet if needed, 
      // but for bulk import usually we just keep local until configured.
      // For now, we just update local state.
  };

  const handleCancelScan = () => {
      setInitialScanId(null);
      setCurrentView('dashboard');
  }

  const handleResetData = () => {
      if(confirm("Reset all data (Checkpoints & Officers) to default? This cannot be undone.")) {
          setCheckpoints(DEFAULT_CHECKPOINTS);
          setOfficers(DEFAULT_OFFICERS);
          localStorage.removeItem('securepatrol_checkpoints');
          localStorage.removeItem('securepatrol_officers');
      }
  }

  if (currentView === 'admin-setup') {
      return (
        <AdminQrSetup 
            checkpoints={checkpoints} 
            officers={officers}
            onAddCheckpoint={handleAddCheckpoint}
            onAddOfficer={handleAddOfficer}
            onRemoveOfficer={handleRemoveOfficer}
            onBack={() => setCurrentView('dashboard')}
            onResetDefaults={handleResetData}
            onImportData={handleImportCheckpoints}
        />
      );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 pb-20 md:pb-0">
      
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
                <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-white">SecurePatrol</h1>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                        {getScriptUrl() ? <span className="text-emerald-400">● Online</span> : <span className="text-slate-500">○ Offline</span>}
                        {lastSyncTime && <span className="text-slate-500 hidden sm:inline">| Last sync: {lastSyncTime.toLocaleTimeString()}</span>}
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
               <button 
                  onClick={() => setShowHelp(true)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                  title="How to use"
               >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
               </button>
               
               {/* Admin Link */}
               <button 
                  onClick={() => setCurrentView('admin-setup')}
                  className="hidden md:flex p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-full transition-colors"
                  title="Admin Setup"
               >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
               </button>

               {currentView === 'dashboard' && (
                   <button 
                    onClick={() => setCurrentView('scanner')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
                   >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                       Scan Checkpoint
                   </button>
               )}
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {currentView === 'scanner' ? (
          <Scanner 
            officers={officers}
            checkpoints={checkpoints} 
            onScanComplete={handleScanComplete}
            onCancel={handleCancelScan}
            initialCheckpointId={initialScanId}
          />
        ) : (
          <Dashboard 
            logs={logs} 
            checkpoints={checkpoints} 
            onRefresh={loadCloudData}
            isSyncing={isSyncing}
          />
        )}
      </main>
      
      {/* Mobile Footer Nav (Sticky) */}
       <div className="md:hidden fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 p-3 flex justify-around z-40 pb-safe">
            <button 
                onClick={() => setCurrentView('dashboard')}
                className={`flex flex-col items-center gap-1 ${currentView === 'dashboard' ? 'text-emerald-400' : 'text-slate-500'}`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                <span className="text-[10px] font-medium">Dashboard</span>
            </button>
            <button 
                onClick={() => setCurrentView('scanner')}
                className="bg-emerald-600 text-white p-3 rounded-full -mt-6 shadow-lg shadow-emerald-900/50 border-4 border-slate-900"
            >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
            </button>
            <button 
                onClick={() => setCurrentView('admin-setup')}
                className="flex flex-col items-center gap-1 text-slate-500"
            >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                <span className="text-[10px] font-medium">Setup</span>
            </button>
       </div>

    </div>
  );
};

export default App;