import type { LogEntry } from '../types/index';

type JsonProperty = { Name: string; Value: string };
type DeviceProperty = { Name: string; Value: string };

function findInExtended(
  props: JsonProperty[],
  name: string
): string | undefined {
  const prop = props?.find((p) => p.Name === name);
  return prop?.Value;
}

function findInDevice(
  props: DeviceProperty[],
  name: string
): string | undefined {
  const prop = props?.find((p) => p.Name === name);
  return prop?.Value;
}

const USER_HEADERS = ["Nom d'utilisateur"];
const IP_HEADERS = ['Adresse IP'];
const DATE_HEADERS = ['Date (UTC)'];
const APP_HEADERS = ['Application'];
const COMPLIANT_HEADERS = ['Conforme'];
const MANAGED_HEADERS = ['Géré'];
const OS_HEADERS = ["Système d'exploitation"];
const BROWSER_HEADERS = ['Navigateur'];
const UA_HEADERS = ['Agent utilisateur'];
const MFA_REQ_HEADERS = [
  'Exigence d’authentification',
  "Exigence d'authentification",
];
const MFA_METHOD_HEADERS = [
  'Méthode d’authentification multifacteur',
  "Méthode d'authentification multifacteur",
];

function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function detectDelimiter(line: string): string {
  const potentialDelimiters = [';', ',', '\t', '|'];
  let bestDelimiter = ',';
  let maxCount = 0;
  const testLine = line.replace(/^"|"$/g, '');
  for (const delim of potentialDelimiters) {
    const count = (testLine.match(new RegExp(`\\${delim}`, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = delim;
    }
  }
  if (bestDelimiter === ',' && (testLine.match(/;/g) || []).length > 10) {
    return ';';
  }
  return bestDelimiter;
}

function splitCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  const delimChar = delimiter[0];
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimChar && !inQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  fields.push(currentField);
  return fields;
}

export function parseCSV(fileContent: string): LogEntry[] {
  const logs: LogEntry[] = [];

  if (fileContent.charCodeAt(0) === 0xfeff) {
    fileContent = fileContent.substring(1);
  }

  const lines = fileContent.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerLine = lines[0] || '';
  const delimiter = detectDelimiter(headerLine);
  const headers = splitCSVLine(headerLine, delimiter).map((h) =>
    h.replace(/^"|"$/g, '').trim()
  );

  // --- Audit Log Format ---
  const auditDataIndex = headers.indexOf('AuditData');
  const creationDateIndex = headers.indexOf('CreationDate');
  const userIdIndex = headers.indexOf('UserId');

  if (auditDataIndex !== -1 && creationDateIndex !== -1 && userIdIndex !== -1) {
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const fields = splitCSVLine(line, delimiter).map((f) =>
        f.replace(/^"|"$/g, '')
      );
      const auditDataStr = fields[auditDataIndex];
      if (!auditDataStr) continue;

      const userId = fields[userIdIndex]?.trim();
      const timestampStr = fields[creationDateIndex]?.trim();

      if (!userId || !timestampStr) continue;

      try {
        const auditData = JSON.parse(auditDataStr);

        const extendedProps = auditData.ExtendedProperties || [];
        const deviceProps = auditData.DeviceProperties || [];

        const compliant = findInDevice(deviceProps, 'IsCompliant');
        const managed = findInDevice(deviceProps, 'IsCompliantAndManaged');

        logs.push({
          user: userId,
          ip: auditData.ClientIP,
          timestamp: new Date(timestampStr),

          userAgent: findInExtended(extendedProps, 'UserAgent'),
          os: findInDevice(deviceProps, 'OS'),
          browser: findInDevice(deviceProps, 'BrowserType'),

          compliant: compliant ? compliant.toLowerCase() : undefined,
          managed: managed ? managed.toLowerCase() : undefined,
        });
      } catch (e) {
        console.error('Error parsing AuditData JSON:', e, auditDataStr);
      }
    }
  } else {
    // --- Sign-in Log Format ---
    const userIndex = headers.findIndex((h) => USER_HEADERS.includes(h));
    const ipIndex = headers.findIndex((h) => IP_HEADERS.includes(h));
    const dateIndex = headers.findIndex((h) => DATE_HEADERS.includes(h));

    const appIndex = headers.findIndex((h) => APP_HEADERS.includes(h));
    const compliantIndex = headers.findIndex((h) =>
      COMPLIANT_HEADERS.includes(h)
    );
    const managedIndex = headers.findIndex((h) => MANAGED_HEADERS.includes(h));
    const osIndex = headers.findIndex((h) => OS_HEADERS.includes(h));
    const browserIndex = headers.findIndex((h) => BROWSER_HEADERS.includes(h));
    const uaIndex = headers.findIndex((h) => UA_HEADERS.includes(h));
    const mfaReqIndex = headers.findIndex((h) => MFA_REQ_HEADERS.includes(h));
    const mfaMethodIndex = headers.findIndex((h) =>
      MFA_METHOD_HEADERS.includes(h)
    );

    if (userIndex !== -1 && ipIndex !== -1 && dateIndex !== -1) {
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const fields = splitCSVLine(line, delimiter).map((f) =>
          f.replace(/^"|"$/g, '')
        );

        const userId = fields[userIndex]?.trim();
        const ip = fields[ipIndex]?.trim();
        const timestampStr = fields[dateIndex]?.trim();

        if (!userId || !isValidEmail(userId) || !ip || !timestampStr) continue;

        logs.push({
          user: userId,
          ip: ip,
          timestamp: new Date(timestampStr),
          application: appIndex !== -1 ? fields[appIndex]?.trim() : undefined,
          compliant:
            compliantIndex !== -1 ? fields[compliantIndex]?.trim() : undefined,
          managed:
            managedIndex !== -1 ? fields[managedIndex]?.trim() : undefined,
          os: osIndex !== -1 ? fields[osIndex]?.trim() : undefined,
          browser:
            browserIndex !== -1 ? fields[browserIndex]?.trim() : undefined,
          userAgent: uaIndex !== -1 ? fields[uaIndex]?.trim() : undefined,
          mfaRequirement:
            mfaReqIndex !== -1 ? fields[mfaReqIndex]?.trim() : undefined,
          mfaMethod:
            mfaMethodIndex !== -1 ? fields[mfaMethodIndex]?.trim() : undefined,
        });
      }
    }
  }

  return logs;
}
