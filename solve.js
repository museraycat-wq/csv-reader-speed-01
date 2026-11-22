// A fast reader with csv-reader 1.0.0's exact broken-row policy: run({text, header}) -> {columns, rows, errors}.
//
// One left-to-right pass, all state in locals of one function. An unquoted field ends at the nearest of the next comma,
// LF and CR, each found with indexOf and kept until the reader passes it; a quoted field is scanned by char code. A
// field is a slice of the text; it is joined from pieces only when a stray CR, a doubled quote or a CR inside quotes
// forces it. The policy:
//   - a U+FEFF at the very start is dropped; a record ends at LF or CRLF; an empty line is no record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a field opening with a quote runs to the next quote that is not doubled ("" is one quote, CRLF and lone CR are
//     LF); text after the closing quote up to the next comma or line break is appended (quote_junk if any is kept);
//     a quote that never closes is literal and the text after it is read again unquoted (unterminated_quote);
//   - records are padded (short_row, fields) or cut (long_row, extra) to the first record's width;
//   - errors carry the record's starting line (line breaks inside quotes counted) and its index in rows.
// Pure: no clock, no randomness, nothing kept between calls.

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = n > 0 && text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let wantHeader = header;
  // The next comma, LF and CR at or after the reader's position (n: none left); -1: not looked up yet.
  let nc = -1;
  let nl = -1;
  let nr = -1;

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos++;
        line++;
      } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line++;
      } else break;
    }
    if (pos >= n) break;

    const recLine = line;
    const recRow = wantHeader ? null : rows.length;
    const fields = [];
    let quoted = false;

    for (;;) {
      // One field. `more`: it ended at a comma.
      let prefix = '';
      let junk = false;
      quoted = pos < n && text.charCodeAt(pos) === 34;
      if (quoted) {
        const open = pos;
        const openLine = line;
        let p = pos + 1;
        let start = p;
        let acc = '';
        let closed = false;
        while (p < n) {
          const c = text.charCodeAt(p);
          if (c > 34) {
            p++;
          } else if (c === 34) {
            if (p + 1 < n && text.charCodeAt(p + 1) === 34) {
              acc += text.slice(start, p + 1);
              p += 2;
              start = p;
            } else {
              acc += text.slice(start, p);
              p++;
              closed = true;
              break;
            }
          } else if (c === 10) {
            line++;
            p++;
          } else if (c === 13) {
            acc += text.slice(start, p) + '\n';
            line++;
            p += p + 1 < n && text.charCodeAt(p + 1) === 10 ? 2 : 1;
            start = p;
          } else {
            p++;
          }
        }
        if (closed) {
          if (p >= n) {
            pos = p;
            fields.push(acc);
            break;
          }
          const c = text.charCodeAt(p);
          if (c === 44) {
            pos = p + 1;
            fields.push(acc);
            continue;
          }
          if (c === 10) {
            pos = p + 1;
            line++;
            fields.push(acc);
            break;
          }
          if (c === 13 && p + 1 < n && text.charCodeAt(p + 1) === 10) {
            pos = p + 2;
            line++;
            fields.push(acc);
            break;
          }
          pos = p;
          prefix = acc;
          junk = true;
        } else {
          pos = open + 1;
          line = openLine;
          nc = nl = nr = -1; // read again from before them
          errors.push({ code: 'unterminated_quote', line: recLine, row: recRow });
          prefix = '"';
        }
      }

      // Unquoted characters onto `prefix`, up to the next comma or line break.
      let start = pos;
      let c = 0;
      for (;;) {
        if (nc < pos) {
          nc = text.indexOf(',', pos);
          if (nc < 0) nc = n;
        }
        if (nl < pos) {
          nl = text.indexOf('\n', pos);
          if (nl < 0) nl = n;
        }
        if (nr < pos) {
          nr = text.indexOf('\r', pos);
          if (nr < 0) nr = n;
        }
        let e = nc < nl ? nc : nl;
        if (nr < e) e = nr;
        pos = e;
        if (e >= n) break;
        c = text.charCodeAt(e);
        if (c !== 13 || (e + 1 < n && text.charCodeAt(e + 1) === 10)) break;
        // A stray CR: dropped.
        errors.push({ code: 'stray_cr', line: recLine, row: recRow });
        if (pos > start) {
          prefix += text.slice(start, pos);
          junk = junk === true ? 2 : junk;
        }
        pos++;
        start = pos;
      }
      if (junk !== false && (junk === 2 || pos > start)) {
        errors.push({ code: 'quote_junk', line: recLine, row: recRow });
      }
      fields.push(start === pos ? prefix : prefix === '' ? text.slice(start, pos) : prefix + text.slice(start, pos));
      if (pos >= n) break;
      if (c === 44) {
        pos++;
        continue;
      }
      // A line break: LF or CRLF.
      line++;
      pos += c === 10 ? 1 : 2;
      break;
    }

    // A line that held only stray CRs: no record (its stray_cr errors stay).
    if (fields.length === 1 && !quoted && fields[0] === '') continue;

    if (width < 0) width = fields.length;
    if (wantHeader) {
      columns = fields;
      wantHeader = false;
      continue;
    }
    const len = fields.length;
    if (len < width) {
      errors.push({ code: 'short_row', line: recLine, row: recRow, fields: len });
      for (let i = len; i < width; i++) fields.push('');
    } else if (len > width) {
      errors.push({ code: 'long_row', line: recLine, row: recRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
