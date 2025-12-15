import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { Checkpoint, ScheduleConfig, ScheduleType, User, Role } from '../types';
import { getCurrentPosition, downloadFile, latLonToUtm } from '../utils';
import { setScriptUrl, getScriptUrl, testConnection } from '../services/sheetService';

interface AdminQrSetupProps {
  checkpoints: Checkpoint[];
  officers: User[];
  onAddCheckpoint: (newCheckpoint: Checkpoint) => void;
  onAddOfficer: (newOfficer: User) => void;
  onRemoveOfficer: (id: string) => void;
  onBack: () => void;
  onResetDefaults?: () => void;
  onImportData?: (data: Checkpoint[]) => void;
}

const AdminQrSetup: React.FC<AdminQrSetupProps> = ({ checkpoints, officers, onAddCheckpoint, onAddOfficer, onRemoveOfficer, onBack, onResetDefaults, onImportData }) => {
  const [activeTab, setActiveTab] = useState<'checkpoints' | 'officers'>('checkpoints');
  const [isAdding, setIsAdding] = useState(false);
  
  // Checkpoint Form
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState<string>('');
  const [newLng, setNewLng] = useState<string>('');
  const [newRadius, setNewRadius] = useState<number>(50);
  const [currentUtm, setCurrentUtm] = useState<string>('');
  
  // Officer Form
  const [newOfficerName, setNewOfficerName] = useState('');
  const [newOfficerId, setNewOfficerId] = useState('');

  // Schedule State
  const [scheduleType, setScheduleType] = useState<ScheduleType>('NONE');
  const [intervalMins, setIntervalMins] = useState<number>(90);
  const [fixedTimes, setFixedTimes] = useState<string[]>(['08:00']);

  const [loadingGps, setLoadingGps] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [baseUrl, setBaseUrl] = useState<string>(window.location.origin + window.location.pathname);
  const [scriptUrl, setScriptUrlState] = useState<string>(getScriptUrl());
  const [connectionStatus, setConnectionStatus] = useState<{success: boolean; message: string} | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setScriptUrlState(getScriptUrl());
  }, []);

  // Update UTM display when Lat/Lng changes manually
  useEffect(() => {
      const lat = parseFloat(newLat);
      const lng = parseFloat(newLng);
      if (!isNaN(lat) && !isNaN(lng)) {
          setCurrentUtm(latLonToUtm(lat, lng));
      } else {
          setCurrentUtm('');
      }
  }, [newLat, newLng]);

  const handlePrint = () => {
    window.print();
  };

  const handleGetLocation = async () => {
    setLoadingGps(true);
    try {
        const pos = await getCurrentPosition();
        setNewLat(pos.latitude.toString());
        setNewLng(pos.longitude.toString());
        // UTM will update via useEffect
    } catch (error) {
        alert("Could not get location. Please allow permissions.");
    } finally {
        setLoadingGps(false);
    }
  };

  const handleUpdateScriptUrl = () => {
      setScriptUrl(scriptUrl);
      setConnectionStatus(null);
  };

  const handleTestConnection = async () => {
      setConnectionStatus({ success: false, message: "Testing..." });
      const result = await testConnection();
      setConnectionStatus(result);
  };

  const handleAddFixedTime = () => {
      setFixedTimes([...fixedTimes, "12:00"]);
  };

  const handleFixedTimeChange = (index: number, val: string) => {
      const updated = [...fixedTimes];
      updated[index] = val;
      setFixedTimes(updated);
  };

  const handleRemoveFixedTime = (index: number) => {
      setFixedTimes(fixedTimes.filter((_, i) => i !== index));
  };

  const handleSubmitCheckpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newLat || !newLng) return;

    const schedule: ScheduleConfig = {
        type: scheduleType,
        intervalMinutes: scheduleType === 'INTERVAL' ? intervalMins : undefined,
        fixedTimes: scheduleType === 'FIXED_TIME' ? fixedTimes : undefined,
        toleranceMinutes: 15
    };

    const newCheckpoint: Checkpoint = {
        id: `cp-${Date.now()}`,
        name: newName,
        location: {
            latitude: parseFloat(newLat),
            longitude: parseFloat(newLng)
        },
        allowedRadiusMeters: newRadius,
        schedule: schedule
    };

    onAddCheckpoint(newCheckpoint);
    
    // Reset Form
    setNewName('');
    setNewLat('');
    setNewLng('');
    setNewRadius(50);
    setScheduleType('NONE');
    setFixedTimes(['08:00']);
    setIsAdding(false);
  };
  
  const handleSubmitOfficer = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newOfficerName || !newOfficerId) return;
      
      const newOfficer: User = {
          id: newOfficerId,
          name: newOfficerName,
          role: Role.OFFICER
      };
      
      onAddOfficer(newOfficer);
      setNewOfficerName('');
      setNewOfficerId('');
  };

  const getQrValue = (checkpointId: string) => {
      const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      return `${cleanBase}?checkpointId=${checkpointId}`;
  };

  const handleExportConfig = () => {
      const dataStr = JSON.stringify(checkpoints, null, 2);
      downloadFile(dataStr, `securepatrol_config_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const content = e.target?.result as string;
              const parsed = JSON.parse(content) as Checkpoint[];
              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
                  if (onImportData) {
                      onImportData(parsed);
                      alert(`Successfully imported ${parsed.length} checkpoints!`);
                  }
              } else {
                  alert("Invalid file format.");
              }
          } catch (err) {
              alert("Error parsing file.");
          }
      };
      reader.readAsText(file);
      event.target.value = '';
  };

  return (
    <div className="bg-slate-900 min-h-screen text-slate-200">
      {/* Header */}
      <div className="no-print p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center sticky top-0 bg-slate-900 z-10 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">System Administration</h2>
          <p className="text-slate-400 text-sm">Manage checkpoints and officer accounts.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
             <button 
                onClick={handlePrint}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
            >
                Print QRs
            </button>
            <button onClick={onBack} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg">
                Back
            </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        
        {/* TABS */}
        <div className="no-print flex space-x-4 mb-8 border-b border-slate-700 pb-2">
            <button 
                onClick={() => setActiveTab('checkpoints')}
                className={`pb-2 px-2 font-medium transition-colors ${activeTab === 'checkpoints' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'}`}
            >
                Checkpoints & QRs
            </button>
            <button 
                onClick={() => setActiveTab('officers')}
                className={`pb-2 px-2 font-medium transition-colors ${activeTab === 'officers' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'}`}
            >
                Officers & Staff
            </button>
        </div>
        
        {/* GOOGLE SHEETS CONNECTION */}
        <div className="no-print mb-8 bg-slate-800 border-l-4 border-emerald-500 p-4 rounded-r-lg shadow-lg">
            <h3 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.9 2.5 3.2 3.3l12.3-21.3h-26l6.65 11.35Z" fill="#0066da"/><path d="m43.65 25-12.3-21.3c-1.3.8-2.4 1.9-3.2 3.3l-25.4 44h26l14.9-26Z" fill="#00ac47"/><path d="m73.55 76.8c1.3-.8 2.4-1.9 3.2-3.3l6.65-11.35-26-45h-25.55l12.3 21.3 29.4 38.35Z" fill="#ea4335"/><path d="m43.65 25 14.9 26-14.9 26-14.9-26 14.9-26Z" fill="#2684fc"/></svg>
                Google Sheets Connection
            </h3>
            <div className="flex flex-col md:flex-row gap-2">
                <input 
                    type="text" 
                    value={scriptUrl}
                    onChange={(e) => setScriptUrlState(e.target.value)}
                    placeholder="https://script.google.com/macros/s/..."
                    className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                />
                <button onClick={handleUpdateScriptUrl} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm font-medium">Save</button>
                <button onClick={handleTestConnection} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm font-medium whitespace-nowrap">Test</button>
            </div>
            {connectionStatus && (
                <div className={`mt-2 text-xs font-mono p-2 rounded ${connectionStatus.success ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
                    {connectionStatus.message}
                </div>
            )}
        </div>

        {/* --- OFFICERS TAB --- */}
        {activeTab === 'officers' && (
            <div className="space-y-6">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-lg font-bold text-white mb-4">Add New Officer</h3>
                    <form onSubmit={handleSubmitOfficer} className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-sm text-slate-400 mb-1">Full Name</label>
                            <input 
                                type="text" 
                                required
                                placeholder="e.g. Somsak Jaidee"
                                value={newOfficerName}
                                onChange={(e) => setNewOfficerName(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"
                            />
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-sm text-slate-400 mb-1">Officer ID / Employee Code</label>
                            <input 
                                type="text" 
                                required
                                placeholder="e.g. EMP-009"
                                value={newOfficerId}
                                onChange={(e) => setNewOfficerId(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"
                            />
                        </div>
                        <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded font-medium w-full md:w-auto">
                            Add Officer
                        </button>
                    </form>
                </div>

                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <h3 className="text-lg font-bold text-white p-4 border-b border-slate-700">Registered Officers</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-400">
                            <thead className="text-xs text-slate-300 uppercase bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3">ID</th>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-6 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {officers.map(officer => (
                                    <tr key={officer.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                        <td className="px-6 py-4 font-mono text-emerald-400">{officer.id}</td>
                                        <td className="px-6 py-4 text-white font-medium">{officer.name}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => onRemoveOfficer(officer.id)}
                                                className="text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/40 px-3 py-1 rounded text-xs"
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {officers.length === 0 && (
                                    <tr><td colSpan={3} className="px-6 py-4 text-center text-slate-500">No officers registered.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* --- CHECKPOINTS TAB --- */}
        {activeTab === 'checkpoints' && (
            <>
                <div className="no-print mb-6 flex justify-between items-center">
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setIsAdding(!isAdding)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                            {isAdding ? 'Cancel' : 'Add Checkpoint'}
                        </button>
                        <button 
                            onClick={handleExportConfig}
                            className="bg-slate-700 hover:bg-slate-600 text-emerald-400 border border-slate-600 px-3 py-2 rounded text-xs flex items-center gap-1"
                        >
                            Export
                        </button>
                        <label className="bg-slate-700 hover:bg-slate-600 text-blue-400 border border-slate-600 px-3 py-2 rounded text-xs flex items-center gap-1 cursor-pointer">
                            Import
                            <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleFileImport} />
                        </label>
                    </div>

                    <button 
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-xs text-slate-400 hover:text-white"
                    >
                        {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
                    </button>
                </div>
                    
                {showAdvanced && (
                    <div className="no-print bg-slate-800 border border-slate-700 p-4 rounded-lg text-sm mb-6">
                        <label className="block text-slate-400 mb-1">Base URL for QR Codes</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                            />
                            <button 
                                onClick={() => setBaseUrl(window.location.origin + window.location.pathname)}
                                className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 rounded"
                            >
                                Reset
                            </button>
                        </div>
                        {onResetDefaults && (
                            <div className="mt-4 pt-4 border-t border-slate-700">
                                <button onClick={onResetDefaults} className="text-red-400 hover:text-red-300 text-xs">
                                    ⚠ Reset All Data
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ADD CHECKPOINT FORM */}
                {isAdding && (
                    <div className="no-print mb-8 bg-slate-800 border border-slate-700 p-6 rounded-xl max-w-3xl mx-auto shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Create New Checkpoint</h3>
                        <form onSubmit={handleSubmitCheckpoint} className="space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Checkpoint Name</label>
                                        <input 
                                            type="text" 
                                            required
                                            placeholder="e.g. Back Warehouse Door"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">
                                            Allowed Radius: <span className="text-white">{newRadius} meters</span>
                                        </label>
                                        <input 
                                            type="range" min="10" max="500" step="10"
                                            value={newRadius}
                                            onChange={(e) => setNewRadius(parseInt(e.target.value))}
                                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-400">GPS Location (Lat/Long)</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input 
                                            type="number" step="any" required placeholder="Lat"
                                            value={newLat} onChange={(e) => setNewLat(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white"
                                        />
                                        <input 
                                            type="number" step="any" required placeholder="Lng"
                                            value={newLng} onChange={(e) => setNewLng(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white"
                                        />
                                    </div>
                                    
                                    {/* UTM Display for reference */}
                                    <div className="text-xs bg-slate-700 p-2 rounded border border-slate-600 text-slate-300 font-mono">
                                        <strong>UTM System: </strong> {currentUtm || "-"}
                                    </div>

                                    <button 
                                        type="button" 
                                        onClick={handleGetLocation}
                                        disabled={loadingGps}
                                        className="w-full text-xs flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 text-emerald-400 py-2 rounded border border-slate-600"
                                    >
                                        {loadingGps ? 'Locating...' : '📍 Use Current Device Location'}
                                    </button>
                                </div>
                            </div>

                            {/* Scheduling Section */}
                            <div className="border-t border-slate-700 pt-4">
                                <label className="block text-sm font-medium text-slate-400 mb-3">Schedule Strategy</label>
                                <div className="flex flex-wrap gap-4 mb-4">
                                    <label className={`cursor-pointer px-4 py-2 rounded-lg border ${scheduleType === 'NONE' ? 'bg-emerald-900/30 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                                        <input type="radio" className="hidden" name="sched" checked={scheduleType === 'NONE'} onChange={() => setScheduleType('NONE')} />
                                        No Schedule
                                    </label>
                                    <label className={`cursor-pointer px-4 py-2 rounded-lg border ${scheduleType === 'INTERVAL' ? 'bg-emerald-900/30 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                                        <input type="radio" className="hidden" name="sched" checked={scheduleType === 'INTERVAL'} onChange={() => setScheduleType('INTERVAL')} />
                                        Recurring Interval
                                    </label>
                                    <label className={`cursor-pointer px-4 py-2 rounded-lg border ${scheduleType === 'FIXED_TIME' ? 'bg-emerald-900/30 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                                        <input type="radio" className="hidden" name="sched" checked={scheduleType === 'FIXED_TIME'} onChange={() => setScheduleType('FIXED_TIME')} />
                                        Fixed Times
                                    </label>
                                </div>

                                {/* Interval Inputs */}
                                {scheduleType === 'INTERVAL' && (
                                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                                        <label className="block text-sm text-slate-400 mb-1">Check every (minutes):</label>
                                        <input 
                                            type="number" min="15" step="15"
                                            value={intervalMins} onChange={(e) => setIntervalMins(parseInt(e.target.value))}
                                            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white w-32"
                                        />
                                        <p className="text-xs text-slate-500 mt-2">Example: 90 minutes = 1.5 hours loop.</p>
                                    </div>
                                )}

                                {/* Fixed Time Inputs */}
                                {scheduleType === 'FIXED_TIME' && (
                                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                                        <label className="block text-sm text-slate-400 mb-2">Required Check-in Times:</label>
                                        <div className="flex flex-wrap gap-2">
                                            {fixedTimes.map((time, idx) => (
                                                <div key={idx} className="flex items-center gap-1">
                                                    <input 
                                                        type="time" 
                                                        value={time}
                                                        onChange={(e) => handleFixedTimeChange(idx, e.target.value)}
                                                        className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white"
                                                    />
                                                    {fixedTimes.length > 1 && (
                                                        <button type="button" onClick={() => handleRemoveFixedTime(idx)} className="text-red-400 hover:text-red-300">×</button>
                                                    )}
                                                </div>
                                            ))}
                                            <button 
                                                type="button" 
                                                onClick={handleAddFixedTime}
                                                className="bg-slate-800 border border-slate-600 border-dashed text-slate-400 px-3 py-1 rounded hover:text-white"
                                            >
                                                + Add Time
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button 
                                type="submit" 
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-emerald-900/20 transition-all"
                            >
                                Save Checkpoint
                            </button>
                        </form>
                    </div>
                )}

                {/* LIST & QR GRIDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-8">
                {checkpoints.map((cp) => (
                    <div key={cp.id} className="qr-card bg-white p-6 rounded-xl border-4 border-slate-200 text-center flex flex-col items-center shadow-lg print:shadow-none print:border-2 print:border-black break-inside-avoid">
                    
                    <div className="mb-2 w-full border-b-2 border-slate-100 pb-2">
                        <h3 className="text-xl font-bold text-slate-900">{cp.name}</h3>
                        <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Secure Checkpoint</p>
                    </div>

                    <div className="bg-white p-2">
                        <QRCode 
                            value={getQrValue(cp.id)} 
                            size={160} 
                            fgColor="#000000" 
                            bgColor="#ffffff" 
                            level="H" 
                        />
                    </div>

                    <div className="mt-2 pt-2 border-t-2 border-slate-100 w-full text-left">
                        <div className="text-[10px] text-slate-400 flex justify-between items-center">
                            <span className="font-mono">{cp.id}</span>
                            <span>Range: {cp.allowedRadiusMeters}m</span>
                        </div>
                        
                        {/* Schedule Display on Card */}
                        <div className="mt-2 bg-slate-50 p-2 rounded text-xs text-slate-600">
                            <strong>Schedule: </strong>
                            {!cp.schedule || cp.schedule.type === 'NONE' ? (
                                <span className="text-slate-400">None</span>
                            ) : cp.schedule.type === 'INTERVAL' ? (
                                <span className="text-blue-600">Every {cp.schedule.intervalMinutes} mins</span>
                            ) : (
                                <span className="text-purple-600">
                                    At {cp.schedule.fixedTimes?.join(", ")}
                                </span>
                            )}
                        </div>
                    </div>

                    </div>
                ))}
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default AdminQrSetup;