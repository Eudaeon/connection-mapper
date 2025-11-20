import type { LogEntry } from '../types/index';

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
  auditData: ['AuditData'],
};

const SUCCESS_STATUS_VALUES = new Set(['Opération réussie', 'Success']);

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
        if (
          auditData.Operation !== 'UserLoggedIn' ||
          !isValidIPAddress(auditData.ClientIP)
        )
          continue;

        const deviceProps = auditData.DeviceProperties || [];
        const extendedProps = auditData.ExtendedProperties || [];
        const findProp = (arr: any[], name: string) =>
          arr?.find((p: any) => p.Name === name)?.Value;

        logs.push({
          user: fields[idx.user]?.trim() || 'Unknown',
          ip: auditData.ClientIP,
          timestamp: new Date(fields[idx.date]?.trim() || ''),
          userAgent: findProp(extendedProps, 'UserAgent'),
          os: capitalizeOS(findProp(deviceProps, 'OS')),
          browser: findProp(deviceProps, 'BrowserType'),
          compliant: findProp(deviceProps, 'IsCompliant')?.toLowerCase(),
          managed: findProp(
            deviceProps,
            'IsCompliantAndManaged'
          )?.toLowerCase(),
        });
      } else {
        if (idx.user === -1 || idx.ip === -1 || idx.date === -1) continue;

        const status = idx.status !== -1 ? fields[idx.status]?.trim() : null;
        if (status && !SUCCESS_STATUS_VALUES.has(status)) continue;

        const userId = fields[idx.user]?.trim();
        const ip = fields[idx.ip]?.trim();
        const timeStr = fields[idx.date]?.trim();

        if (!userId || !isValidEmail(userId)) continue;
        if (!ip || !isValidIPAddress(ip)) continue;
        if (!timeStr) continue;

        logs.push({
          user: userId,
          ip: ip,
          timestamp: new Date(timeStr),
          application: fields[idx.app]?.trim(),
          compliant: fields[idx.compliant]?.trim(),
          managed: fields[idx.managed]?.trim(),
          os: capitalizeOS(fields[idx.os]?.trim()),
          browser: fields[idx.browser]?.trim(),
          userAgent: fields[idx.ua]?.trim(),
          mfaRequirement: fields[idx.mfaReq]?.trim(),
          mfaMethod: fields[idx.mfaMethod]?.trim(),
        });
      }
    } catch (e) {
      continue;
    }
  }

  return logs;
}