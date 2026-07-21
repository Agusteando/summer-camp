const SUMMER_API = Object.freeze({
  version: 2,
  spreadsheetId: '1c5BnKpZXeVeyFIAx01GbVYlp3uujfFu24Eat115ZQYg',
  sheetNames: ['PREEM', 'PREET', 'PM', 'PT', 'SM', 'ST'],
  cacheSeconds: 60,
  apiKeyProperty: 'SUMMER_API_KEY'
});

const PLANTEL_META = Object.freeze({
  PREET: { campus: 'Toluca', label: 'Preescolar Toluca' },
  PT: { campus: 'Toluca', label: 'Primaria Toluca' },
  ST: { campus: 'Toluca', label: 'Secundaria Toluca' },
  PREEM: { campus: 'Metepec', label: 'Preescolar Metepec' },
  PM: { campus: 'Metepec', label: 'Primaria Metepec' },
  SM: { campus: 'Metepec', label: 'Secundaria Metepec' }
});

const HEADER_ALIASES = Object.freeze({
  apiId: ['ID API'],
  folio: ['Folio'],
  name: ['Nombre completo del menor'],
  age: ['Edad (años)', 'Edad'],
  modality: ['Modalidad'],
  studentType: ['Tipo de alumno'],
  breakfast: ['Desayuno'],
  lunch: ['Comida'],
  dinner: ['Cena'],
  extendedTime: ['Tiempo extendido'],
  entryTime: ['Hora de entrada'],
  exitTime: ['Hora de salida'],
  primaryContact: ['Contacto principal'],
  primaryRelation: ['Parentesco'],
  primaryPhone: ['Teléfono principal', 'Telefono principal'],
  alternateContact: ['Contacto alterno'],
  alternateRelation: ['Parentesco alterno'],
  alternatePhone: ['Teléfono alterno', 'Telefono alterno'],
  allergies: ['Alergias / información relevante', 'Alergias / informacion relevante'],
  observations: ['Observaciones']
});

const OPTIONAL_HEADER_ALIASES = Object.freeze({
  transport: ['Transporte', 'Servicio de transporte', 'Ruta de transporte']
});

function doGet(e) {
  try {
    const action = cleanText_(e && e.parameter && e.parameter.action).toLowerCase() || 'snapshot';

    if (action === 'health') {
      return json_({
        ok: true,
        version: SUMMER_API.version,
        service: 'summer-camp-sheet-api',
        generatedAt: new Date().toISOString()
      });
    }

    assertAuthorized_(e);

    if (action === 'schema') {
      return json_({
        ok: true,
        version: SUMMER_API.version,
        requiredHeaders: Object.keys(HEADER_ALIASES).reduce(function (result, key) {
          result[key] = HEADER_ALIASES[key].slice();
          return result;
        }, {}),
        optionalHeaders: Object.keys(OPTIONAL_HEADER_ALIASES).reduce(function (result, key) {
          result[key] = OPTIONAL_HEADER_ALIASES[key].slice();
          return result;
        }, {}),
        sheets: SUMMER_API.sheetNames.slice(),
        planteles: PLANTEL_META
      });
    }

    if (action !== 'snapshot') {
      throw new Error('Acción no soportada: ' + action);
    }

    const snapshot = readCachedSnapshot_();
    const filtered = filterSnapshot_(snapshot, e && e.parameter ? e.parameter : {});
    return json_(filtered);
  } catch (error) {
    return json_({
      ok: false,
      version: SUMMER_API.version,
      generatedAt: new Date().toISOString(),
      error: {
        name: error && error.name ? String(error.name) : 'Error',
        message: error && error.message ? String(error.message) : String(error),
        stack: error && error.stack ? String(error.stack).slice(0, 12000) : null
      }
    });
  }
}


function initializeApiIds() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = SpreadsheetApp.openById(SUMMER_API.spreadsheetId);
    const result = initializeApiIds_(spreadsheet);
    CacheService.getScriptCache().remove('summer-camp-sheet-snapshot-v' + SUMMER_API.version);
    return result;
  } finally {
    lock.releaseLock();
  }
}

function initializeApiIds_(spreadsheet) {
  return SUMMER_API.sheetNames.map(function (sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) throw new Error('No existe la pestaña requerida: ' + sheetName);
    return ensureApiIdColumn_(sheet);
  });
}

function ensureApiIdColumn_(sheet) {
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const normalizedApiHeader = normalizeText_(HEADER_ALIASES.apiId[0]);
  const normalizedNameHeaders = HEADER_ALIASES.name.map(normalizeText_);
  let apiColumnIndex = -1;
  let nameColumnIndex = -1;

  headers.forEach(function (header, index) {
    const normalized = normalizeText_(header);
    if (normalized === normalizedApiHeader) apiColumnIndex = index;
    if (normalizedNameHeaders.indexOf(normalized) !== -1) nameColumnIndex = index;
  });

  if (nameColumnIndex === -1) {
    throw new Error('Falta la columna "' + HEADER_ALIASES.name[0] + '" en la pestaña ' + sheet.getName() + '.');
  }

  let createdColumn = false;
  if (apiColumnIndex === -1) {
    apiColumnIndex = lastColumn;
    sheet.getRange(1, apiColumnIndex + 1).setValue(HEADER_ALIASES.apiId[0]);
    createdColumn = true;
  }
  sheet.hideColumns(apiColumnIndex + 1, 1);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { sheet: sheet.getName(), column: apiColumnIndex + 1, createdColumn: createdColumn, assignedIds: 0 };
  }

  const rowCount = lastRow - 1;
  const names = sheet.getRange(2, nameColumnIndex + 1, rowCount, 1).getDisplayValues();
  const idRange = sheet.getRange(2, apiColumnIndex + 1, rowCount, 1);
  const ids = idRange.getDisplayValues();
  let assignedIds = 0;

  for (let index = 0; index < rowCount; index += 1) {
    if (cleanText_(names[index][0]) && !cleanText_(ids[index][0])) {
      ids[index][0] = Utilities.getUuid();
      assignedIds += 1;
    }
  }

  if (assignedIds) idRange.setValues(ids);
  return { sheet: sheet.getName(), column: apiColumnIndex + 1, createdColumn: createdColumn, assignedIds: assignedIds };
}

function readCachedSnapshot_() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'summer-camp-sheet-snapshot-v' + SUMMER_API.version;
  const cached = cache.get(cacheKey);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      parsed.meta = parsed.meta || {};
      parsed.meta.cache = 'hit';
      return parsed;
    } catch (error) {
      cache.remove(cacheKey);
    }
  }

  const snapshot = buildSnapshot_();
  const serialized = JSON.stringify(snapshot);
  if (serialized.length < 95000) {
    cache.put(cacheKey, serialized, SUMMER_API.cacheSeconds);
  }
  snapshot.meta.cache = 'miss';
  return snapshot;
}

function buildSnapshot_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = SpreadsheetApp.openById(SUMMER_API.spreadsheetId);
    initializeApiIds_(spreadsheet);
    const timezone = spreadsheet.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'America/Mexico_City';
    const students = [];
    const warnings = [];
    const seenIds = {};

    SUMMER_API.sheetNames.forEach(function (sheetName) {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) {
        throw new Error('No existe la pestaña requerida: ' + sheetName);
      }

      const range = sheet.getDataRange();
      const displayRows = range.getDisplayValues();
      const rawRows = range.getValues();
      if (!displayRows.length) return;

      const headerMap = resolveHeaders_(displayRows[0], sheetName);

      for (let rowIndex = 1; rowIndex < displayRows.length; rowIndex += 1) {
        const displayRow = displayRows[rowIndex];
        const rawRow = rawRows[rowIndex];
        const name = cellText_(displayRow, headerMap.name);
        if (!name) continue;

        const apiId = cellText_(displayRow, headerMap.apiId);
        if (!apiId) {
          throw new Error('No se pudo asignar ID API en ' + sheetName + ', fila ' + (rowIndex + 1) + '.');
        }
        const folio = cellText_(displayRow, headerMap.folio) || String(rowIndex + 1);
        const id = apiId;
        if (seenIds[id]) {
          throw new Error('ID API duplicado: ' + id + ' (filas ' + seenIds[id] + ' y ' + sheetName + '!' + (rowIndex + 1) + ').');
        }
        seenIds[id] = sheetName + '!' + (rowIndex + 1);

        const meta = PLANTEL_META[sheetName];
        const student = {
          id: id,
          folio: folio,
          name: name,
          age: parseAge_(rawRow[headerMap.age], displayRow[headerMap.age]),
          modality: cellText_(displayRow, headerMap.modality),
          studentType: cellText_(displayRow, headerMap.studentType),
          plantel: sheetName,
          plantelLabel: meta.label,
          campus: meta.campus,
          services: {
            breakfast: parseServiceActive_(cellText_(displayRow, headerMap.breakfast)),
            lunch: parseServiceActive_(cellText_(displayRow, headerMap.lunch)),
            dinner: parseServiceActive_(cellText_(displayRow, headerMap.dinner)),
            extendedTime: parseServiceActive_(cellText_(displayRow, headerMap.extendedTime)),
            transport: parseServiceActive_(cellText_(displayRow, headerMap.transport))
          },
          serviceValues: {
            breakfast: cellText_(displayRow, headerMap.breakfast),
            lunch: cellText_(displayRow, headerMap.lunch),
            dinner: cellText_(displayRow, headerMap.dinner),
            extendedTime: cellText_(displayRow, headerMap.extendedTime),
            transport: cellText_(displayRow, headerMap.transport)
          },
          schedule: {
            entry: formatTime_(rawRow[headerMap.entryTime], displayRow[headerMap.entryTime], timezone),
            exit: formatTime_(rawRow[headerMap.exitTime], displayRow[headerMap.exitTime], timezone)
          },
          contacts: {
            primary: {
              name: cellText_(displayRow, headerMap.primaryContact),
              relation: cellText_(displayRow, headerMap.primaryRelation),
              phone: normalizePhone_(cellText_(displayRow, headerMap.primaryPhone))
            },
            alternate: {
              name: cellText_(displayRow, headerMap.alternateContact),
              relation: cellText_(displayRow, headerMap.alternateRelation),
              phone: normalizePhone_(cellText_(displayRow, headerMap.alternatePhone))
            }
          },
          allergies: cellText_(displayRow, headerMap.allergies),
          observations: cellText_(displayRow, headerMap.observations),
          source: {
            sheet: sheetName,
            row: rowIndex + 1
          }
        };

        if (student.age === null) {
          warnings.push({ code: 'MISSING_AGE', studentId: id, sheet: sheetName, row: rowIndex + 1 });
        }
        students.push(student);
      }
    });

    students.sort(function (a, b) {
      const sheetOrder = SUMMER_API.sheetNames.indexOf(a.plantel) - SUMMER_API.sheetNames.indexOf(b.plantel);
      return sheetOrder || a.name.localeCompare(b.name, 'es');
    });

    const summaries = buildSummaries_(students);
    const generatedAt = new Date().toISOString();
    const revision = sha256_(JSON.stringify(students));

    return {
      ok: true,
      version: SUMMER_API.version,
      generatedAt: generatedAt,
      revision: revision,
      spreadsheet: {
        id: spreadsheet.getId(),
        name: spreadsheet.getName(),
        timezone: timezone
      },
      students: students,
      summaries: summaries,
      meta: {
        cache: 'miss',
        sheetCount: SUMMER_API.sheetNames.length,
        studentCount: students.length,
        warningCount: warnings.length,
        warnings: warnings.slice(0, 100)
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function filterSnapshot_(snapshot, parameters) {
  const plantel = cleanText_(parameters.plantel).toUpperCase();
  const campus = cleanText_(parameters.campus);
  if (!plantel && !campus) return snapshot;

  const students = snapshot.students.filter(function (student) {
    if (plantel && student.plantel !== plantel) return false;
    if (campus && normalizeText_(student.campus) !== normalizeText_(campus)) return false;
    return true;
  });

  return Object.assign({}, snapshot, {
    students: students,
    summaries: buildSummaries_(students),
    meta: Object.assign({}, snapshot.meta, {
      filtered: true,
      filters: { plantel: plantel || null, campus: campus || null },
      studentCount: students.length
    })
  });
}

function buildSummaries_(students) {
  const map = {};
  students.forEach(function (student) {
    if (!map[student.plantel]) {
      map[student.plantel] = {
        plantel: student.plantel,
        label: student.plantelLabel,
        campus: student.campus,
        total: 0,
        breakfast: 0,
        lunch: 0,
        dinner: 0,
        extendedTime: 0,
        transport: 0,
        huskyDreamers: 0,
        footballClinic: 0
      };
    }

    const summary = map[student.plantel];
    summary.total += 1;
    if (student.services.breakfast) summary.breakfast += 1;
    if (student.services.lunch) summary.lunch += 1;
    if (student.services.dinner) summary.dinner += 1;
    if (student.services.extendedTime) summary.extendedTime += 1;
    if (student.services.transport) summary.transport += 1;
    if (normalizeText_(student.modality) === 'husky dreamers') summary.huskyDreamers += 1;
    if (normalizeText_(student.modality) === 'clinica de futbol') summary.footballClinic += 1;
  });

  return SUMMER_API.sheetNames.filter(function (name) { return Boolean(map[name]); }).map(function (name) { return map[name]; });
}

function resolveHeaders_(headerRow, sheetName) {
  const normalizedHeaders = {};
  headerRow.forEach(function (header, index) {
    const normalized = normalizeText_(header);
    if (normalized) normalizedHeaders[normalized] = index;
  });

  const result = {};
  Object.keys(HEADER_ALIASES).forEach(function (key) {
    const aliases = HEADER_ALIASES[key];
    const match = aliases.map(normalizeText_).find(function (alias) {
      return Object.prototype.hasOwnProperty.call(normalizedHeaders, alias);
    });
    if (!match) {
      throw new Error('Falta la columna "' + aliases[0] + '" en la pestaña ' + sheetName + '.');
    }
    result[key] = normalizedHeaders[match];
  });

  Object.keys(OPTIONAL_HEADER_ALIASES).forEach(function (key) {
    const aliases = OPTIONAL_HEADER_ALIASES[key];
    const match = aliases.map(normalizeText_).find(function (alias) {
      return Object.prototype.hasOwnProperty.call(normalizedHeaders, alias);
    });
    result[key] = match ? normalizedHeaders[match] : null;
  });
  return result;
}

function assertAuthorized_(e) {
  const expected = cleanText_(PropertiesService.getScriptProperties().getProperty(SUMMER_API.apiKeyProperty));
  if (!expected) {
    throw new Error('Configura la propiedad de script ' + SUMMER_API.apiKeyProperty + '.');
  }
  const provided = cleanText_(e && e.parameter && e.parameter.key);
  if (!provided || !constantTimeEquals_(provided, expected)) {
    throw new Error('Clave API inválida.');
  }
}

function constantTimeEquals_(left, right) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function parseServiceActive_(value) {
  const normalized = normalizeText_(value);
  if (!normalized) return false;
  return ['no', 'false', '0', 'ninguno', 'ninguna', 'sin servicio', 'no aplica', 'na', 'n a'].indexOf(normalized) === -1;
}

function parseAge_(rawValue, displayValue) {
  if (typeof rawValue === 'number' && isFinite(rawValue)) return Math.round(rawValue * 100) / 100;
  const match = cleanText_(displayValue).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function formatTime_(rawValue, displayValue, timezone) {
  if (Object.prototype.toString.call(rawValue) === '[object Date]' && !isNaN(rawValue.getTime())) {
    return Utilities.formatDate(rawValue, timezone, 'HH:mm');
  }
  if (typeof rawValue === 'number' && isFinite(rawValue)) {
    const totalMinutes = Math.round((rawValue % 1) * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
  }
  return cleanText_(displayValue);
}

function normalizePhone_(value) {
  const text = cleanText_(value);
  if (!text) return '';
  const digits = text.replace(/\D/g, '');
  return digits || text;
}

function cellText_(row, index) {
  return index === undefined || index === null ? '' : cleanText_(row[index]);
}

function cleanText_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function normalizeText_(value) {
  return cleanText_(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sha256_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)
    .map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); })
    .join('')
    .slice(0, 32);
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
