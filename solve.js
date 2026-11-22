// Fast drop-in for make.fun's csv-reader 1.0.0: run(input) returns exactly
// {columns, rows, errors} for {text, header}, following the same broken-row
// policy the reference implements, but scanning with a single-pass charCode
// loop and slice-based field extraction instead of one character at a time.
//
// Policy (from the competition description):
//  - U+FEFF at the very start is dropped.
//  - A record ends at LF or CRLF; a line with no characters is no record.
//  - Outside quotes a CR not followed by LF is dropped (stray_cr).
//  - A field opening with a quote runs to the next non-doubled quote; ""
//    inside it is one quote, each CRLF or lone CR inside it reads as LF;
//    what follows the closing quote up to the next comma or line break is
//    appended as it stands (quote_junk when the field ends); a quote that
//    never closes is a literal character and the text after it is read again
//    as unquoted (unterminated_quote).
//  - A quote inside an unquoted field is a literal character.
//  - Fields stay strings, never trimmed or converted.
//  - columns is the first record when header is true, else null; rows hold
//    the records after it, each padded (short_row, fields: count) or cut
//    (long_row, extra: cut fields) to the first record's width.
//  - Each error is {code, line, row}, in the order met; line is the 1-based
//    line its record starts on, row its index in rows (null for header).

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0;
  let line = 1;
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on, and its index in rows (null: header).
  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `value` up to the next comma or line
  // break; a CR not followed by LF is dropped (stray_cr). `added` counts
  // the characters kept. The kept span is sliced in one go; only stray CRs
  // split it.
  function readUnquoted(value) {
    let added = 0;
    let start = pos;
    for (;;) {
      while (pos < len) {
        const c = text.charCodeAt(pos);
        if (c === 44) {
          // Comma: the record goes on.
          if (pos > start) {
            value += text.slice(start, pos);
            added += pos - start;
          }
          pos += 1;
          return { value, ended: COMMA, added };
        }
        if (c === 10) {
          // LF: the record ends.
          if (pos > start) {
            value += text.slice(start, pos);
            added += pos - start;
          }
          pos += 1;
          line += 1;
          return { value, ended: LINE_BREAK, added };
        }
        if (c === 13) {
          // CR: a line break when followed by LF, else dropped (stray_cr).
          if (text.charCodeAt(pos + 1) === 10) {
            if (pos > start) {
              value += text.slice(start, pos);
              added += pos - start;
            }
            pos += 2;
            line += 1;
            return { value, ended: LINE_BREAK, added };
          }
          if (pos > start) {
            value += text.slice(start, pos);
            added += pos - start;
          }
          error('stray_cr');
          pos += 1;
          start = pos;
          continue;
        }
        pos += 1;
      }
      if (pos > start) {
        value += text.slice(start, pos);
        added += pos - start;
      }
      return { value, ended: END, added };
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    pos += 1;
    for (;;) {
      const q = text.indexOf('"', pos);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text
        // after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        error('unterminated_quote');
        return readUnquoted('"');
      }
      if (q > pos) {
        let chunk = text.slice(pos, q);
        const cr = chunk.indexOf('\r');
        const lf = chunk.indexOf('\n');
        if (cr !== -1 || lf !== -1) {
          // CRLF and a lone CR inside quotes each read as one LF: one line
          // per LF, plus one per lone CR (a CRLF counts once).
          const lfs = chunk.match(/\n/g);
          const lone = chunk.match(/\r(?!\n)/g);
          line += (lfs ? lfs.length : 0) + (lone ? lone.length : 0);
          chunk = chunk.replace(/\r\n?/g, '\n');
        }
        value += chunk;
      }
      pos = q;
      if (text.charCodeAt(q + 1) === 34) {
        // Doubled quote: one quote, keep reading.
        value += '"';
        pos = q + 2;
        continue;
      }
      pos = q + 1;
      if (pos >= len) return { value, ended: END };
      const c = text[pos];
      if (c === ',') {
        pos += 1;
        return { value, ended: COMMA };
      }
      if (c === '\n') {
        pos += 1;
        line += 1;
        return { value, ended: LINE_BREAK };
      }
      if (c === '\r' && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        return { value, ended: LINE_BREAK };
      }
      // What follows the closing quote is appended as it stands.
      const junk = readUnquoted(value);
      if (junk.added > 0) error('quote_junk');
      return junk;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text[pos];
      if (c === '\n') {
        pos += 1;
        line += 1;
      } else if (c === '\r' && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
