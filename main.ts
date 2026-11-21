// The driver the harness runs (`node /bot/main.ts`, Node 22): reads every case from /input/cases.json, answers each
// one with run() from solve.js, and writes /output/answers.json, one answer per case in the cases' order.
// MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR stand in for /input and /output outside a container.
//
// The file is written as JSON.stringify(answers) would write it ('[' + each answer's JSON joined by ',' + ']'), but each
// answer is serialised and written as soon as it is made, so no answer stays alive while the next case is read: the
// garbage collector never has to copy a finished answer around.

import { closeSync, openSync, readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// V8's incremental marking off before solve.js is imported, as the house driver does.
setFlagsFromString('--no-incremental-marking');

const { run } = await import(new URL('./solve.js', import.meta.url).href);

// JIT warm-up: a few readings of two tiny texts that take every path of run() (BOM, empty LF and CRLF lines, doubled
// quotes, CR, CRLF and LF inside quotes, quote junk with a stray CR, an unterminated quote, a line of stray CRs, short
// and long rows, a trailing comma, no final line break, header on and off). Without it the reader's rare paths have no
// type feedback when V8 first optimises it, and each one met later costs a deoptimisation and a recompile. Their
// answers are thrown away; nothing is kept from them.
const WARM = [
  { text: '﻿a,b,c\r\n1,"q""x",3\r\n\r\n"m\r\nn\ro\np",2\n\n4,5,6,7,8\nx\ry,"j"k\rl,"z"\r\n\r\r\n"",""\r"a"," é """,\n"b"', header: true },
  { text: 'é,"x"\n\r\n,,,\n"open,a\nlast,', header: false },
];
for (let k = 0; k < 30; k++) for (const w of WARM) run(w);

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(readFileSync(join(INPUT_DIR, 'cases.json'), 'utf8'));
const fd = openSync(join(OUTPUT_DIR, 'answers.json'), 'w');
for (let i = 0; i < cases.length; i++) {
  const input = cases[i].input;
  cases[i] = null;
  writeSync(fd, (i === 0 ? '[' : ',') + JSON.stringify(run(input)));
}
writeSync(fd, cases.length === 0 ? '[]' : ']');
closeSync(fd);
