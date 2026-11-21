# csv-reader-speed-01

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/museraycat-wq/csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/museraycat-wq/csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in replacement for csv-reader 1.0.0 that gives exactly the same answers on broken CSV. `solve.js` exports
`run({text, header})` and returns the same `{columns, rows, errors}` that csv-reader 1.0.0 returns, with the same error
codes in the same order (`stray_cr`, `quote_junk`, `unterminated_quote`, `short_row` with `fields`, `long_row` with
`extra`). It also matches csv-reader on the BOM rule, on LF, CRLF and lone-CR handling inside and outside quotes, on
doubled quotes, on padding or cutting rows to the first record's width, and on line and row numbering.

How it gets its speed:

- **One pass over char codes, all state in locals.** Each field is a single `slice` of the text. It is only built from
  pieces when a stray CR, a doubled quote or a CR inside quotes forces it.
- **Answers are serialised as soon as they are made.** `main.ts` writes the same bytes `JSON.stringify(answers)` would
  write, but it serialises and writes each answer right after it is produced. A finished answer is never kept alive,
  so the garbage collector never has to copy it.
- **JIT warm-up.** Before the real cases, the driver reads two tiny texts that take every path of the reader. When V8
  optimises it, the rare paths already have type feedback, so they don't deoptimise later. The warm-up answers are
  thrown away and nothing is carried into the cases.

On the practice set (6 cases, 11 MB), net of a do-nothing Node run and pinned to 1 CPU, this entry uses about 0.41 s of
CPU and csv-reader 1.0.0 behind the house driver about 1.58 s (12 interleaved runs each). Its `answers.json` is byte-identical to the baseline's.

## Run it

```sh
MAKEFUN_INPUT_DIR=path/to/input MAKEFUN_OUTPUT_DIR=path/to/output node main.ts   # Node 22.18+; defaults /input, /output
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=fxwax1pq&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
