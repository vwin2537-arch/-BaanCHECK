import React from 'react';

interface HelpModalProps {
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="bg-emerald-600 w-8 h-8 rounded-lg flex items-center justify-center text-sm">SP</span>
              How to use
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center font-bold text-emerald-400 border border-slate-600">1</div>
              <div>
                <h3 className="text-white font-medium mb-1">Start Patrol</h3>
                <p className="text-slate-400 text-sm">Go to the location of the checkpoint (e.g., Main Entrance).</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center font-bold text-emerald-400 border border-slate-600">2</div>
              <div>
                <h3 className="text-white font-medium mb-1">Scan QR Code</h3>
                <p className="text-slate-400 text-sm">
                  Press <span className="text-emerald-400 font-mono text-xs border border-emerald-500/30 px-1 rounded">Scan Checkpoint</span>. Point your camera at the QR code tag fixed at the location.
                </p>
                <p className="text-xs text-slate-500 mt-2 italic bg-slate-900/50 p-2 rounded border border-slate-700/50">
                  *Simulation Mode: Use the buttons on the screen to simulate scanning different QR codes.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center font-bold text-amber-400 border border-slate-600">!</div>
              <div>
                <h3 className="text-amber-200 font-medium mb-1">Anti-Cheat Check</h3>
                <p className="text-slate-400 text-sm">
                  The system automatically compares your <strong>GPS Location</strong> with the <strong>Checkpoint's Location</strong>.
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  <li className="flex items-center gap-2 text-emerald-400">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"></path></svg>
                    If Nearby: <span className="text-white">Verified</span>
                  </li>
                  <li className="flex items-center gap-2 text-red-400">
                     <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                    If Far away: <span className="text-white">REJECTED (Location Mismatch)</span>
                  </li>
                </ul>
              </div>
            </div>
            
             {/* Step 4 */}
             <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center font-bold text-indigo-400 border border-slate-600">4</div>
              <div>
                <h3 className="text-white font-medium mb-1">Manager Report</h3>
                <p className="text-slate-400 text-sm">
                   At the end of the day, managers click <span className="text-indigo-400 font-mono text-xs border border-indigo-500/30 px-1 rounded">Analyze Day</span>. AI will summarize performance and highlight any "Location Mismatches".
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-900 px-6 py-4 flex justify-end">
          <button 
            onClick={onClose}
            className="bg-white text-slate-900 hover:bg-slate-200 font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;