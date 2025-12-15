import { ScanLog, User, Checkpoint } from "../types";

// Default provided by user
const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw25h6Y4xPk6xmX09wH3J5Z8_-mq1IuOZL-9lyNKdRcIbqzS8sXzBpmJyXBvAY8QCRILQ/exec";

// Load from storage, or fallback to the default URL
let GOOGLE_SCRIPT_URL = localStorage.getItem('google_script_url') || DEFAULT_SCRIPT_URL;

export const setScriptUrl = (url: string) => {
    GOOGLE_SCRIPT_URL = url;
    localStorage.setItem('google_script_url', url);
};

export const getScriptUrl = () => GOOGLE_SCRIPT_URL;

export const testConnection = async (): Promise<{success: boolean; message: string}> => {
    if (!GOOGLE_SCRIPT_URL) return { success: false, message: "No URL configured" };
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();
        return { success: true, message: "Connected. Found " + (data.logs?.length || 0) + " logs." };
    } catch (e: any) {
        return { success: false, message: "Connection Failed. Check URL permissions." };
    }
}

const sendToSheet = async (payload: any) => {
    if (!GOOGLE_SCRIPT_URL) return false;
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        });
        return true;
    } catch (error) {
        console.error("Sheet Sync Error:", error);
        return false;
    }
}

// --- LOGGING ---
export const saveLogToSheet = async (log: ScanLog): Promise<boolean> => {
    console.log("Saving log to sheet...");
    return sendToSheet({ action: "LOG", ...log });
};

// --- OFFICER MANAGEMENT ---
export const addOfficerToSheet = async (officer: User): Promise<boolean> => {
    console.log("Adding officer to sheet...");
    return sendToSheet({ action: "ADD_OFFICER", ...officer });
};

export const removeOfficerFromSheet = async (officerId: string): Promise<boolean> => {
    console.log("Removing officer from sheet...");
    return sendToSheet({ action: "REMOVE_OFFICER", id: officerId });
};

// --- CHECKPOINT MANAGEMENT ---
export const addCheckpointToSheet = async (checkpoint: Checkpoint): Promise<boolean> => {
    console.log("Adding checkpoint to sheet...");
    // We stringify complex objects (location, schedule) to ensure they pass correctly as simple fields if needed by simple backend logic
    // But sending the raw JSON object usually works if the backend parses it. 
    // Sending flattened structure just in case.
    return sendToSheet({ 
        action: "ADD_CHECKPOINT", 
        id: checkpoint.id,
        name: checkpoint.name,
        latitude: checkpoint.location.latitude,
        longitude: checkpoint.location.longitude,
        allowedRadiusMeters: checkpoint.allowedRadiusMeters,
        schedule: JSON.stringify(checkpoint.schedule || {}) 
    });
};

// --- FETCHING DATA ---
export const fetchAllDataFromSheet = async (): Promise<{ logs: ScanLog[], officers: User[], checkpoints: Checkpoint[] }> => {
    if (!GOOGLE_SCRIPT_URL) return { logs: [], officers: [], checkpoints: [] };

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();
        
        let parsedLogs: ScanLog[] = [];
        let parsedOfficers: User[] = [];
        let parsedCheckpoints: Checkpoint[] = [];

        // Parse Logs
        if (data.logs && Array.isArray(data.logs)) {
             parsedLogs = data.logs.map((row: any, index: number) => ({
                id: `sheet-${index}`, // Generate temp ID for sheet rows
                checkpointName: row.checkpointName,
                checkpointId: "unknown", // Sheet might not store raw ID, relying on Name
                officerId: row.officerId,
                status: row.status,
                note: row.note,
                timestamp: new Date(row.timestamp).getTime(),
                distanceFromTarget: Number(row.distanceFromTarget) || 0,
                userLocation: row.userLocation
            }));
        }

        // Parse Officers
        if (data.officers && Array.isArray(data.officers)) {
            parsedOfficers = data.officers.map((row: any) => ({
                id: String(row.id),
                name: row.name,
                role: row.role
            }));
        }

        // Parse Checkpoints
        if (data.checkpoints && Array.isArray(data.checkpoints)) {
            parsedCheckpoints = data.checkpoints.map((row: any) => {
                // Handle schedule parsing safely
                let scheduleConfig = { type: 'NONE' };
                try {
                    if (row.schedule && typeof row.schedule === 'string') {
                        scheduleConfig = JSON.parse(row.schedule);
                    } else if (row.schedule && typeof row.schedule === 'object') {
                        scheduleConfig = row.schedule;
                    }
                } catch (e) {}

                return {
                    id: String(row.id),
                    name: row.name,
                    location: {
                        latitude: Number(row.latitude),
                        longitude: Number(row.longitude)
                    },
                    allowedRadiusMeters: Number(row.allowedRadiusMeters) || 50,
                    schedule: scheduleConfig as any
                };
            });
        }

        return { logs: parsedLogs, officers: parsedOfficers, checkpoints: parsedCheckpoints };

    } catch (error) {
        console.error("Failed to fetch data from sheet", error);
        return { logs: [], officers: [], checkpoints: [] };
    }
};

// Deprecated alias for compatibility if needed, but updated to use new fetch
export const fetchLogsFromSheet = async (): Promise<ScanLog[]> => {
    const data = await fetchAllDataFromSheet();
    return data.logs;
};