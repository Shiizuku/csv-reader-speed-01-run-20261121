# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Shiizuku/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Shiizuku/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's csv-reader 1.0.0, written for the
[csv-reader-speed-01-run-20261121](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
bounty on [make.fun](https://make.fun).

`solve.js` exports `run(input)`, which returns exactly `{columns, rows,
errors}` for `{text, header}` — the same broken-row reading csv-reader
1.0.0 does (BOM dropped, LF/CRLF record ends, stray CRs dropped with a
`stray_cr` error, quoted fields with `""` escapes and CR/LF folded to LF,
`quote_junk` and `unterminated_quote`, short/long rows padded or cut to the
first record's width) — but scanned with a single-pass charCode loop and
slice-based field extraction instead of one character at a time.

On the kit's practice set (6 cases, ~1.4–1.9 MB of CSV each) it answers all
6 cases exactly and parses ~4x faster than the reference; the whole program
runs in ~1.1 s where the house baseline takes ~2.2 s on this machine.

`main.ts` is the harness driver: it reads `/input/cases.json`, answers each
case alone with `run()`, and writes `/output/answers.json`.
