// connection-mapper/src/services/csvParser.ts

import type { LogEntry } from '../types/index';

// Global Variables for Parsing Keywords
const STATUS_SUCCESS = 'Success';
const STATUS_FAILURE = 'Failure';
const STATUS_INTERRUPTED = 'Interrupted';

// Lists for status mapping
const AZURE_STATUS_SUCCESS = ['Opération réussie', 'Success'];
const AZURE_STATUS_INTERRUPTED = ['Interrompu', 'Interrupted'];
const AZURE_STATUS_FAILURE = ['Échec', 'Failure'];

const PURVIEW_OP_SUCCESS = 'UserLoggedIn';
const PURVIEW_OP_FAILURE = 'UserLoginFailed';
const PURVIEW_ERROR_FIELD = 'LogonError';
const INTERRUPT_KEYWORD = 'Interrupt';

const HEADER_MAP = {
  user: ["Nom d'utilisateur", 'Username', 'UserId'],
  ip: ['Adresse IP', 'IP address', 'ClientIP'],
  date: ['Date (UTC)', 'CreationDate'],
  app: ['Application'],
  compliant: ['Conforme', 'Compliant', 'IsCompliant'],
  managed: ['Géré', 'Managed', 'IsCompliantAndManaged'],
  os: ["Système d'exploitation", 'Operating System', 'OS'],
  browser: ['Navigateur', 'Browser', 'BrowserType'],
  userAgent: ['Agent utilisateur', 'User agent', 'UserAgent'],
  mfaReq: ['Exigence d’authentification', 'Authentication requirement'],
  mfaMethod: [
    'Méthode d’authentification multifacteur',
    'Multifactor authentication auth method',
  ],
  status: ['Statut', 'Status'],
  reason: ["Raison de l'échec", 'Failure reason', 'ResultReason'],
  auditData: ['AuditData'],
};

function isValidEmail(email: string): boolean {
  return email.includes('@') && email.includes('.');
}

function isValidIPAddress(ip: string | undefined): boolean {
  if (!ip) return false;
  return ip.length >= 7 && (ip.indexOf('.') > -1 || ip.indexOf(':') > -1);
}

function capitalizeOS(os: string | undefined): string | undefined {
  if (!os) return os;
  const trimmed = os.trim();
  return trimmed.toLowerCase().startsWith('ios')
    ? trimmed.replace(/^ios/i, 'iOS')
    : trimmed;
}

function detectDelimiter(line: string): string {
  if (
    line.includes(';') &&
    (line.match(/;/g) || []).length > line.split(',').length
  )
    return ';';
  return ',';
}

function splitCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  const delimChar = delimiter[0];
  const len = line.length;

  for (let i = 0; i < len; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < len && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimChar && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function findIndexAny(headers: string[], candidates: string[]): number {
  return headers.findIndex((h) => candidates.includes(h));
}

/**
 * Normalizes the reason string:
 * 1. Strips trailing dot only if it is a single sentence (no other dots in the line).
 * 2. Converts "Other" or empty values to "N/A".
 */
function normalizeReason(val: string | undefined): string {
  let trimmed = val?.trim();
  if (!trimmed) return 'N/A';

  // Strip trailing dot only if there isn't already a dot elsewhere in the line
  if (trimmed.endsWith('.')) {
    const base = trimmed.slice(0, -1);
    if (!base.includes('.')) {
      trimmed = base.trim();
    }
  }

  // Convert "Other" or empty results to "N/A"
  if (trimmed === 'Other' || !trimmed) {
    return 'N/A';
  }

  return trimmed;
}

export function parseCSV(fileContent: string): LogEntry[] {
  const content =
    fileContent.charCodeAt(0) === 0xfeff ? fileContent.slice(1) : fileContent;
  const lines = content.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerLine = lines[0] || '';
  const delimiter = detectDelimiter(headerLine);
  const headers = splitCSVLine(headerLine, delimiter).map((h) =>
    h.replace(/^"|"$/g, '').trim()
  );

  const logs: LogEntry[] = [];

  const idx = {
    auditData: headers.indexOf('AuditData'),
    user: findIndexAny(headers, HEADER_MAP.user),
    ip: findIndexAny(headers, HEADER_MAP.ip),
    date: findIndexAny(headers, HEADER_MAP.date),
    app: findIndexAny(headers, HEADER_MAP.app),
    status: findIndexAny(headers, HEADER_MAP.status),
    reason: findIndexAny(headers, HEADER_MAP.reason),
    compliant: findIndexAny(headers, HEADER_MAP.compliant),
    managed: findIndexAny(headers, HEADER_MAP.managed),
    os: findIndexAny(headers, HEADER_MAP.os),
    browser: findIndexAny(headers, HEADER_MAP.browser),
    ua: findIndexAny(headers, HEADER_MAP.userAgent),
    mfaReq: findIndexAny(headers, HEADER_MAP.mfaReq),
    mfaMethod: findIndexAny(headers, HEADER_MAP.mfaMethod),
  };

  const isAuditFormat =
    idx.auditData !== -1 && idx.date !== -1 && idx.user !== -1;

  const lineCount = lines.length;

  for (let i = 1; i < lineCount; i++) {
    const line = lines[i];
    if (!line || line.length < 10) continue;

    const fields = splitCSVLine(line, delimiter).map((f) =>
      f.replace(/^"|"$/g, '')
    );

    try {
      if (isAuditFormat) {
        const auditStr = fields[idx.auditData];
        if (!auditStr) continue;

        const auditData = JSON.parse(auditStr);
        const operation = auditData.Operation;

        if (
          (operation !== PURVIEW_OP_SUCCESS && operation !== PURVIEW_OP_FAILURE) ||
          !isValidIPAddress(auditData.ClientIP)
        )
          continue;

        let status = 'N/A';
        if (operation === PURVIEW_OP_SUCCESS) {
          status = STATUS_SUCCESS;
        } else if (operation === PURVIEW_OP_FAILURE) {
          status = STATUS_FAILURE;
        }

        const rawReason = auditData[PURVIEW_ERROR_FIELD] || 'N/A';
        
        // If the error contains "Interrupt", it's considered Interrupted
        if (status === STATUS_FAILURE && rawReason.includes(INTERRUPT_KEYWORD)) {
          status = STATUS_INTERRUPTED;
        }

        const deviceProps = auditData.DeviceProperties || [];
        const extendedProps = auditData.ExtendedProperties || [];
        const findProp = (arr: any[], name: string) =>
          arr?.find((p: any) => p.Name === name)?.Value;

        logs.push({
          user: fields[idx.user]?.trim() || 'Unknown',
          ip: auditData.ClientIP,
          timestamp: new Date(fields[idx.date]?.trim() || ''),
          userAgent: findProp(extendedProps, 'UserAgent') || 'N/A',
          os: capitalizeOS(findProp(deviceProps, 'OS')) || 'N/A',
          browser: findProp(deviceProps, 'BrowserType') || 'N/A',
          compliant: findProp(deviceProps, 'IsCompliant')?.toLowerCase() || 'N/A',
          managed: findProp(
            deviceProps,
            'IsCompliantAndManaged'
          )?.toLowerCase() || 'N/A',
          status: status,
          reason: normalizeReason(rawReason),
          application: 'N/A',
          mfaRequirement: 'N/A',
          mfaMethod: 'N/A',
        });
      } else {
        if (idx.user === -1 || idx.ip === -1 || idx.date === -1) continue;

        const userId = fields[idx.user]?.trim();
        const ip = fields[idx.ip]?.trim();
        const timeStr = fields[idx.date]?.trim();

        if (!userId || !isValidEmail(userId)) continue;
        if (!ip || !isValidIPAddress(ip)) continue;
        if (!timeStr) continue;

        let status = fields[idx.status]?.trim() || 'N/A';
        if (AZURE_STATUS_SUCCESS.includes(status)) {
          status = STATUS_SUCCESS;
        } else if (AZURE_STATUS_INTERRUPTED.includes(status)) {
          status = STATUS_INTERRUPTED;
        } else if (AZURE_STATUS_FAILURE.includes(status)) {
          status = STATUS_FAILURE;
        }

        logs.push({
          user: userId,
          ip: ip,
          timestamp: new Date(timeStr),
          application: fields[idx.app]?.trim() || 'N/A',
          compliant: fields[idx.compliant]?.trim() || 'N/A',
          managed: fields[idx.managed]?.trim() || 'N/A',
          os: capitalizeOS(fields[idx.os]?.trim()) || 'N/A',
          browser: fields[idx.browser]?.trim() || 'N/A',
          userAgent: fields[idx.ua]?.trim() || 'N/A',
          mfaRequirement: fields[idx.mfaReq]?.trim() || 'N/A',
          mfaMethod: fields[idx.mfaMethod]?.trim() || 'N/A',
          status: status,
          reason: normalizeReason(fields[idx.reason]),
        });
      }
    } catch (e) {
      continue;
    }
  }

  return logs;
}