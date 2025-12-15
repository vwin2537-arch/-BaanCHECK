import React from 'react';
import { Checkpoint, ScanLog, ScanStatus } from '../types';
import { formatTime, convertLogsToCSV, downloadFile } from '../utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend } from 'recharts';

interface DashboardProps {
  logs: ScanLog[];
  checkpoints: Checkpoint[];
  onRefresh?: () => void;
  isSyncing?: boolean;
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6']; // Emerald, Red, Amber, Blue
const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1q0exFEAkQQTlnyL2HOjy4Tl4H9s-iFtk?usp=sharing";

const Dashboard: React.FC<DashboardProps> = ({ logs, checkpoints, onRefresh, isSyncing }) => {
  // Calculate Stats
  const validScans = logs.filter(l => l.status === ScanStatus.VALID).length;
  const invalidScans = logs.filter(l => l.status === ScanStatus.INVALID_LOCATION).length;
  const issueScans = logs.filter(l => l.status === ScanStatus.ISSUE_REPORTED).length;
  const lateScans = logs.filter(l => l.status === ScanStatus.LATE).length;

  const data = [
    { name: 'Valid', value: validScans },
    { name: 'Invalid/Distance', value: invalidScans },
    { name: 'Issues', value: issueScans },
    { name: 'Late', value: lateScans },
  ].filter(d => d.value > 0);

  const handleExportCsv = () => {
      const csvContent = convertLogsToCSV(logs);
      downloadFile(csvContent, `scan_logs_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-slate-400 text-xs uppercase font-bold">Total Scans</p>
          <p className="text-2xl font-bold text-white mt-1">{logs.length}</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-emerald-400 text-xs uppercase font-bold">Verified</p>
          <p className="text-2xl font-bold text-emerald-100 mt-1">{validScans}</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-red-400 text-xs uppercase font-bold">Rejected (Geo)</p>
          <p className="text-2xl font-bold text-red-100 mt-1">{invalidScans}</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-amber-400 text-xs uppercase font-bold">Issues</p>
          <p className="text-2xl font-bold text-amber-100 mt-1">{issueScans}</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 min-h-[300px] flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4">Scan Distribution</h3>
            {data.length > 0 ? (
                <div className="flex-1 w-full h-full min-h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <ReTooltip 
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                    No data available yet.
                </div>
            )}
        </div>
      </div>

      {/* Detailed Logs Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-white">Recent Patrol Logs</h3>
                {onRefresh && (
                    <button 
                        onClick={onRefresh}
                        disabled={isSyncing}
                        className={`text-slate-400 hover:text-emerald-400 transition-all ${isSyncing ? 'animate-spin text-emerald-500' : ''}`}
                        title="Refresh Data from Cloud"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    </button>
                )}
            </div>
            
            <div className="flex gap-2">
                 <button 
                    onClick={handleExportCsv}
                    disabled={logs.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Export to CSV
                </button>
                <a 
                    href={DRIVE_FOLDER_URL}
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-slate-700 hover:bg-slate-600 text-blue-400 border border-slate-600 px-3 py-1.5 rounded text-xs flex items-center gap-1 transition-colors"
                >
                    <svg className="w-4 h-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.9 2.5 3.2 3.3l12.3-21.3h-26l6.65 11.35Z" fill="#0066da"/><path d="m43.65 25-12.3-21.3c-1.3.8-2.4 1.9-3.2 3.3l-25.4 44h26l14.9-26Z" fill="#00ac47"/><path d="m73.55 76.8c1.3-.8 2.4-1.9 3.2-3.3l6.65-11.35-26-45h-25.55l12.3 21.3 29.4 38.35Z" fill="#ea4335"/><path d="m43.65 25 14.9 26-14.9 26-14.9-26 14.9-26Z" fill="#2684fc"/></svg>
                    Open Sheet
                </a>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-400">
                <thead className="text-xs text-slate-300 uppercase bg-slate-900/50">
                    <tr>
                        <th className="px-6 py-3">Time</th>
                        <th className="px-6 py-3">Checkpoint</th>
                        <th className="px-6 py-3">Officer</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Details</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.length === 0 && (
                        <tr><td colSpan={5} className="px-6 py-4 text-center">No scans recorded today.</td></tr>
                    )}
                    {[...logs].reverse().map(log => (
                        <tr key={log.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                            <td className="px-6 py-4">{formatTime(log.timestamp)}</td>
                            <td className="px-6 py-4 text-white font-medium">{log.checkpointName}</td>
                            <td className="px-6 py-4">{log.officerId}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                    ${log.status === ScanStatus.VALID ? 'bg-emerald-900 text-emerald-300' : 
                                      log.status === ScanStatus.INVALID_LOCATION ? 'bg-red-900 text-red-300' :
                                      log.status === ScanStatus.ISSUE_REPORTED ? 'bg-amber-900 text-amber-300' :
                                      'bg-blue-900 text-blue-300'}
                                `}>
                                    {log.status === ScanStatus.INVALID_LOCATION ? 'LOCATION MISMATCH' : log.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-xs">
                                {log.distanceFromTarget && log.status === ScanStatus.INVALID_LOCATION ? (
                                    <span className="text-red-400">Dist: {Math.round(log.distanceFromTarget)}m (Allowed: 50m)</span>
                                ) : (
                                    log.note
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;