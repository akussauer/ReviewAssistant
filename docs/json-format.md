# Review JSON format (PySide v2)

**File → Export → JSON…** writes this format, and **File → Import old JSON…** reads it.
It is the format the old PySide6 Review Assistant saves (`schema_version` 2), so:

- a file exported here opens in the old app, and
- a file from the old app imports here.

The `.review` file (SQLite) is still the main format. JSON is for moving data to other
tools, or to the old app.

## Top level

```jsonc
{
  "schema_version": 2,
  "columns": [ /* column objects, in display order */ ],
  "rows": [ /* row objects, in the main table's order */ ],
  "row_heights": [80, 120],           // one per row, in pixels
  "row_checked": [false, true],       // one per row
  "row_ids": ["17", "18"],            // one per row; tabs refer to these
  "tabs": [ /* tab objects, not including the main tab */ ],
  "active_tab": "main"                // "main", or a tab's name
}
```

`rows`, `row_heights`, `row_checked` and `row_ids` are parallel lists: entry *i* of each
describes the same row.

## Columns

```jsonc
{
  "name": "Study Type",       // the column label; row objects use it as their key
  "type_key": "combobox",     // see the table below
  "options": ["RCT", "Cohort"],   // dropdown labels; [] for other types
  "min_val": 0,               // number columns: the allowed range
  "max_val": 9999,
  "width": 150                // pixels
}
```

| `type_key` | Column type | Value in a row |
|---|---|---|
| `textedit` | Text | string (may contain newlines and markdown) |
| `combobox` | Dropdown | the option's label, or `""` when empty |
| `checkbox` | Checkbox | `true` / `false` |
| `date` | Date | `"YYYY-MM-DD"`, or `""` when empty |
| `spinbox` | Number | a whole number, or `""` when empty |

## Rows

Each row is an object keyed by column name, e.g.
`{"Title": "…", "Study Type": "RCT", "Year": 2021, "Read": true}`.

## Tabs

```jsonc
{
  "name": "Juniors",
  "type": "review",           // "review" or "synthesis"
  "row_ids": ["17", "21"],    // rows in this tab, from the top-level row_ids
  "assistant_enabled": false
}
```

A tab's own sort, filters and search are not part of this format.

## Older files and leniency

When importing, the app accepts:

- **Version 1 files** (no `schema_version`): their tabs list rows by position (`row_idx`)
  instead of `row_ids`. Missing `row_heights`, `row_checked` or `row_ids` fall back to 80 px,
  unchecked, and new ids.
- **Imperfect files.** Nothing is dropped silently. Every change made below is listed in
  the summary shown after the import.
  - An unknown `type_key` (e.g. `plain_text`) becomes Text.
  - A dropdown value that isn't in `options` is added as an option.
  - A number outside `min_val`–`max_val` widens the range.
  - A value that can't fit its column (e.g. text in a number column) is left empty.
  - Duplicate column or tab names get " (2)".
  - Values under a key that isn't a column are not imported.
  - Column widths are kept within 20–5000 px, and row heights within 16–5000 px.
  - A `min_val` greater than `max_val` is swapped.
