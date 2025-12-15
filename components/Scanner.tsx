import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Checkpoint, Coordinates, ScanLog, ScanStatus, User } from '../types';
import { calculateDistance, getCurrentPosition, formatTime } from '../utils';

interface ScannerProps {
  officers: User[];
  checkpoints: Checkpoint[];
  onScanComplete: (log: ScanLog) => void;
  onCancel: () => void;
  initialCheckpointId?: string | null;
}

const Scanner: React.FC<ScannerProps> = ({ officers, checkpoints, onScanComplete, onCancel, initialCheckpointId }) => {
  const [processing, setProcessing] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef<boolean>(true);
  const [hasAutoScanned, setHasAutoScanned] = useState(false);

  // New States for Confirmation Step
  const [pendingLog, setPendingLog] = useState<ScanLog | null>(null);
  const [noteText, setNoteText] = useState('');
  const [hasPhoto, setHasPhoto] = useState(false);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>("");
  
  // Debug / Info
  const [currentAccuracy, setCurrentAccuracy] = useState<number | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
            track.stop();
        });
        streamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
  };

  const startCamera = useCallback(async () => {
    // Prevent starting if unmounted
    if (!mountedRef.current) return;

    setCameraError(null);
    stopCamera(); // Ensure clean slate

    if (!window.isSecureContext) {
        setCameraError("Security restriction: Camera access requires HTTPS (Secure Context).");
        return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Camera API not supported on this device/browser.");
        return;
    }

    try {
        // First attempt: Environment (Back) Camera
        // We use a slight delay to ensure previous tracks are fully killed by the browser
        await new Promise(r => setTimeout(r, 100));
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        if (mountedRef.current) {
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } else {
            // If we unmounted while waiting, stop immediately
            stream.getTracks().forEach(t => t.stop());
        }
    } catch (err) {
        console.warn("Environment camera failed, retrying with fallback...", err);
        
        if (!mountedRef.current) return;

        try {
            // Second attempt: Any video source
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (mountedRef.current) {
                streamRef.current = fallbackStream;
                if (videoRef.current) {
                    videoRef.current.srcObject = fallbackStream;
                }
            } else {
                fallbackStream.getTracks().forEach(t => t.stop());
            }
        } catch (fallbackErr: any) {
            console.error("Camera access failed:", fallbackErr);
            if (!mountedRef.current) return;

            let msg = "Camera access failed.";
            
            if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
                msg = "Permission denied. Please check your browser settings and allow camera access.";
            } else if (fallbackErr.name === 'NotFoundError') {
                msg = "No camera device found.";
            } else if (fallbackErr.name === 'NotReadableError') {
                msg = "Camera is in use by another app. Please close other apps.";
            } else {
                msg = `Error: ${fallbackErr.message || fallbackErr.name}`;
            }
            setCameraError(msg);
        }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    startCamera();
    
    return () => {
        mountedRef.current = false;
        stopCamera();
    };
  }, [startCamera]);

  useEffect(() => {
    if (initialCheckpointId && !hasAutoScanned) {
        setHasAutoScanned(true);
        setTimeout(() => {
             if(mountedRef.current) handleSimulatedScan(initialCheckpointId);
        }, 500);
    }
  }, [initialCheckpointId]);


  const handleSimulatedScan = async (checkpointId: string) => {
    setProcessing(true);
    setGpsLoading(true);

    try {
        const targetCheckpoint = checkpoints.find(c => c.id === checkpointId);
        if (!targetCheckpoint) throw new Error("Unknown QR Code. Checkpoint ID not found in system.");

        // 1. Get Device Location (with Timeout and High Accuracy)
        const locationPromise = getCurrentPosition();
        const timeoutPromise = new Promise<Coordinates>((_, reject) => 
            setTimeout(() => reject(new Error("GPS timed out. Move to open sky.")), 10000)
        );

        const currentLocation = await Promise.race([locationPromise, timeoutPromise]);
        const accuracy = currentLocation.accuracy || 0;

        // Track accuracy for display
        if (currentLocation.accuracy) {
            setCurrentAccuracy(currentLocation.accuracy);
        }

        // 2. Anti-Cheat Check: Distance
        const distance = calculateDistance(currentLocation, targetCheckpoint.location);
        const isNearby = distance <= targetCheckpoint.allowedRadiusMeters;
        
        // Trust QR if GPS is very poor (Indoors)
        const isGpsPoor = accuracy > 100;

        // 3. Time Check
        let timeStatus: 'VALID' | 'INVALID_TIME' = 'VALID';
        let timeNote = "";

        if (targetCheckpoint.schedule?.type === 'FIXED_TIME' && targetCheckpoint.schedule.fixedTimes) {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const tolerance = targetCheckpoint.schedule.toleranceMinutes || 10;
            
            // Check if current time is within ANY of the scheduled windows
            const isValidTime = targetCheckpoint.schedule.fixedTimes.some(timeStr => {
                const [h, m] = timeStr.split(':').map(Number);
                const targetMinutes = h * 60 + m;
                return Math.abs(currentMinutes - targetMinutes) <= tolerance;
            });

            if (!isValidTime) {
                timeStatus = 'INVALID_TIME';
                timeNote = `Wrong Time. Schedule: ${targetCheckpoint.schedule.fixedTimes.join(', ')} (+/- ${tolerance}m)`;
            }
        }

        let status = ScanStatus.VALID;
        let autoNote = "Routine Check: OK";

        // Logic Priority:
        if (timeStatus === 'INVALID_TIME') {
            status = ScanStatus.INVALID_TIME;
            autoNote = timeNote;
        } else if (isGpsPoor) {
             status = ScanStatus.VALID;
             autoNote = `Weak GPS (Acc: ${Math.round(accuracy)}m). Verified by QR.`;
        } else if (!isNearby) {
             status = ScanStatus.INVALID_LOCATION;
             autoNote = `Location Mismatch. Dist: ${Math.round(distance)}m`;
        }
        
        if (!mountedRef.current) return;
        setGpsLoading(false);
        setProcessing(false);

        const draftLog: ScanLog = {
            id: Date.now().toString(),
            checkpointId: targetCheckpoint.id,
            checkpointName: targetCheckpoint.name,
            officerId: "", 
            timestamp: Date.now(),
            status: status,
            userLocation: currentLocation,
            distanceFromTarget: distance,
            note: autoNote
        };

        setPendingLog(draftLog);
        setNoteText(autoNote); // Pre-fill note with the diagnosis
        setHasPhoto(false);
        setSelectedOfficerId(""); 

    } catch (error) {
        if (!mountedRef.current) return;
        setProcessing(false);
        setGpsLoading(false);
        const errMessage = error instanceof Error ? error.message : "Location verification failed.";
        alert(`Error: ${errMessage}`);
        setHasAutoScanned(true); 
    }
  };

  const handleFinalSubmit = () => {
      if (!pendingLog) return;
      if (!selectedOfficerId) {
          alert("Please select your name/ID from the list.");
          return;
      }
      
      const officer = officers.find(o => o.id === selectedOfficerId);
      const officerDisplayName = officer ? `${officer.name} (${officer.id})` : selectedOfficerId;

      const finalLog: ScanLog = {
          ...pendingLog,
          officerId: officerDisplayName,
          note: noteText,
          evidencePhotoUrl: hasPhoto ? "mock_photo_url.jpg" : undefined
      };
      
      onScanComplete(finalLog);
  };

  // --- REPORT MODAL RENDER ---
  if (pendingLog) {
      const isValid = pendingLog.status === ScanStatus.VALID;
      const isInvalidTime = pendingLog.status === ScanStatus.INVALID_TIME;
      const distance = Math.round(pendingLog.distanceFromTarget || 0);
      const accuracy = pendingLog.userLocation?.accuracy ? Math.round(pendingLog.userLocation.accuracy) : 0;
      
      // Determine UI state
      const isWeakSignal = isValid && accuracy > 100;

      // Card Style Logic
      let cardBg = 'bg-emerald-900/20 border-emerald-500/50';
      let iconColor = 'bg-emerald-500 text-white';
      let textColor = 'text-emerald-400';
      let title = 'Location Verified';
      let subTitle = `You are at ${pendingLog.checkpointName}`;
      let icon = <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>;

      if (isInvalidTime) {
          cardBg = 'bg-red-900/20 border-red-500/50';
          iconColor = 'bg-red-500 text-white';
          textColor = 'text-red-400';
          title = 'Schedule Mismatch';
          subTitle = `Outside allowed scan time`;
          icon = <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
      } else if (pendingLog.status === ScanStatus.INVALID_LOCATION) {
          cardBg = 'bg-red-900/20 border-red-500/50';
          iconColor = 'bg-red-500 text-white';
          textColor = 'text-red-400';
          title = 'Location Mismatch';
          subTitle = `Too far from ${pendingLog.checkpointName} (${distance}m)`;
          icon = <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>;
      }

      return (
          <div className="fixed inset-0 bg-slate-900 z-[100] flex flex-col overflow-y-auto">
              <div className="p-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10 flex justify-between items-center">
                  <h2 className="text-white font-bold text-lg">Report Detail</h2>
                  <button 
                    onClick={() => { setPendingLog(null); setHasAutoScanned(true); }} 
                    className="text-slate-400 text-sm"
                  >
                      Cancel
                  </button>
              </div>

              <div className="p-6 space-y-6 max-w-md mx-auto w-full">
                  {/* Status Card */}
                  <div className={`p-6 rounded-2xl border-2 text-center ${cardBg}`}>
                      
                      <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3 ${iconColor}`}>
                          {icon}
                      </div>

                      <h3 className={`text-xl font-bold ${textColor}`}>
                          {title}
                      </h3>
                      
                      <p className="text-slate-400 text-sm mt-1">
                          {subTitle}
                      </p>

                      {/* Info Chips */}
                      <div className="flex flex-wrap gap-2 justify-center mt-3">
                         {accuracy > 0 && !isInvalidTime && (
                              <div className={`px-3 py-1 rounded text-xs border ${accuracy < 50 ? 'bg-emerald-900/50 border-emerald-500/30 text-emerald-300' : 'bg-slate-800 border-slate-600 text-slate-300'}`}>
                                 Accuracy: +/- {accuracy}m
                              </div>
                          )}
                          {isInvalidTime && (
                              <div className="px-3 py-1 rounded text-xs border bg-red-900/50 border-red-500/30 text-red-300">
                                  Current Time: {formatTime(Date.now())}
                              </div>
                          )}
                      </div>
                      
                      {isWeakSignal && !isInvalidTime && (
                           <div className="mt-3 text-xs text-emerald-200/60">
                              *GPS signal weak (Indoors), but QR verified.
                          </div>
                      )}

                      {isInvalidTime && (
                           <div className="mt-3 text-xs text-red-200/60 leading-relaxed">
                              You can only scan within +/- 10 mins of the scheduled time.
                              <br/>
                              (See schedule in Admin Setup)
                          </div>
                      )}
                  </div>

                  {/* Form Fields */}
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-emerald-400 mb-1">
                              Who is scanning? <span className="text-red-500">*</span>
                          </label>
                          <select 
                            value={selectedOfficerId}
                            onChange={(e) => setSelectedOfficerId(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                          >
                              <option value="" disabled>-- Select Officer Name --</option>
                              {officers.map(off => (
                                  <option key={off.id} value={off.id}>
                                      {off.name} ({off.id})
                                  </option>
                              ))}
                          </select>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1">
                              Note / Observation
                          </label>
                          <textarea 
                              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none h-24"
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              placeholder="e.g., Door locked, windows secure..."
                          />
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-slate-400 mb-2">
                              Photo Evidence (Optional)
                          </label>
                          <button 
                              onClick={() => setHasPhoto(!hasPhoto)}
                              className={`w-full border-2 border-dashed rounded-xl p-4 flex items-center justify-center gap-2 transition-all ${
                                  hasPhoto 
                                  ? 'border-emerald-500 bg-emerald-900/20 text-emerald-400' 
                                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
                              }`}
                          >
                              {hasPhoto ? (
                                  <>
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                      Photo Attached
                                  </>
                              ) : (
                                  <>
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                      Take Photo
                                  </>
                              )}
                          </button>
                      </div>
                  </div>
                  
                  <div className="pt-4">
                      <button 
                          onClick={handleFinalSubmit}
                          disabled={!selectedOfficerId}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                      >
                          <span>Submit Report</span>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                      </button>
                  </div>

              </div>
          </div>
      );
  }

  // --- CAMERA VIEW RENDER ---
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="absolute top-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <h2 className="text-white font-bold text-lg">Scan Checkpoint</h2>
        <button onClick={onCancel} className="text-white bg-white/20 px-3 py-1 rounded-full text-sm">Close</button>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-900">
        {!cameraError ? (
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="absolute min-w-full min-h-full object-cover opacity-70"
            />
        ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-800">
                 <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mb-4 text-slate-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                 </div>
                 <h3 className="text-white font-semibold text-lg mb-2">Camera Unavailable</h3>
                 <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto leading-relaxed">{cameraError}</p>
                 
                 <button 
                    onClick={startCamera}
                    className="mb-6 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-lg transition-all flex items-center gap-2"
                 >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    Retry Camera
                 </button>

                 <p className="text-slate-500 text-xs">You can still use the simulation buttons below.</p>
            </div>
        )}
        
        {!cameraError && (
            <div className="relative w-64 h-64 border-2 border-emerald-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] flex items-center justify-center">
                <div className="absolute top-0 left-0 w-4 h-4 border-l-4 border-t-4 border-emerald-500 -ml-1 -mt-1"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-r-4 border-t-4 border-emerald-500 -mr-1 -mt-1"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-l-4 border-b-4 border-emerald-500 -ml-1 -mb-1"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-r-4 border-b-4 border-emerald-500 -mr-1 -mb-1"></div>
                
                {processing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center flex-col text-center p-4">
                        {gpsLoading && <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mb-2"></div>}
                        <span className="text-white font-semibold text-sm animate-pulse">
                            Verifying GPS (Accuracy)...
                        </span>
                    </div>
                )}
            </div>
        )}
      </div>

      <div className="bg-slate-900 p-6 rounded-t-2xl -mt-4 z-20">
        <p className="text-slate-400 text-sm mb-4 text-center">
            {cameraError ? "Simulate scanning checkpoints:" : "Align QR code within the frame."}
        </p>

        <div className="space-y-2">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 text-center">
                Simulation Mode
            </p>
            <div className="grid grid-cols-2 gap-2">
                {checkpoints.map(cp => (
                    <button
                        key={cp.id}
                        onClick={() => handleSimulatedScan(cp.id)}
                        disabled={processing}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-3 px-2 rounded border border-slate-700 transition-colors disabled:opacity-50"
                    >
                        Scan "{cp.name}"
                    </button>
                ))}
            </div>
            <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded text-xs text-yellow-200">
                <strong>Anti-Cheat Active:</strong> Checks GPS Location & Accuracy (+/- meters).
            </div>
        </div>
      </div>
    </div>
  );
};

export default Scanner;