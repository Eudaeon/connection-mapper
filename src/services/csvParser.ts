import type { LogEntry } from "../types";

const USER_HEADERS = ["Nom d'utilisateur"];
const IP_HEADERS = ["Adresse IP"];
const DATE_HEADERS = ["Date (UTC)"];

function isValidEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function splitCSVLine(line: string): string[] {
    const fields: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                currentField += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            fields.push(currentField);
            currentField = "";
        } else {
            currentField += char;
        }
    }

    fields.push(currentField);
    return fields;
}

export function parseCSV(fileContent: string): LogEntry[] {
    const logs: LogEntry[] = [];
    const lines = fileContent.split(/\r?\n/);

    if (lines.length < 2) {
        return [];
    }

    const headers = splitCSVLine(lines[0] || "").map((h) =>
        h.replace(/^"|"$/g, "")
    );

    // Check for Azure AD Audit Log format
    const auditDataIndex = headers.indexOf("AuditData");
    const creationDateIndex = headers.indexOf("CreationDate");
    let userIdIndex = headers.indexOf("UserId");

    if (
        auditDataIndex !== -1 &&
        creationDateIndex !== -1 &&
        userIdIndex !== -1
    ) {
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;

            const fields = splitCSVLine(line);

            const auditDataStr = fields[auditDataIndex];
            if (!auditDataStr) continue;

            const userId = fields[userIdIndex]?.trim();
            const timestampStr = fields[creationDateIndex]?.trim();

            if (!userId || !isValidEmail(userId) || !timestampStr) continue;

            try {
                const auditData = JSON.parse(auditDataStr);
                logs.push({
                    user: userId,
                    ip: auditData.ClientIP,
                    timestamp: new Date(timestampStr),
                });
            } catch (e) {
                console.error("Error parsing AuditData JSON:", e, auditDataStr);
            }
        }
    } else {
        // Check for Azure AD Sign-in Log format
        const userIndex = headers.findIndex((h) => USER_HEADERS.includes(h));
        const ipIndex = headers.findIndex((h) => IP_HEADERS.includes(h));
        const dateIndex = headers.findIndex((h) => DATE_HEADERS.includes(h));

        if (userIndex !== -1 && ipIndex !== -1 && dateIndex !== -1) {
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if (!line) continue;

                const fields = splitCSVLine(line);
                const userId = fields[userIndex]?.trim();
                const ip = fields[ipIndex]?.trim();
                const timestampStr = fields[dateIndex]?.trim();

                if (!userId || !isValidEmail(userId) || !ip || !timestampStr)
                    continue;

                logs.push({
                    user: userId,
                    ip: ip,
                    timestamp: new Date(timestampStr),
                });
            }
        }
    }

    return logs;
}
