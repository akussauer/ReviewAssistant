# Bundled spellcheck dictionaries

Review Assistant ships these Hunspell dictionaries so spellcheck works offline in English,
German, French and Spanish (plan M10d). They are unchanged copies of the files Chromium
downloads from Google's dictionary server (`redirector.gvt1.com/edgedl/chrome/dict/`), built
by the Chromium project from <https://chromium.googlesource.com/chromium/deps/hunspell_dictionaries>.
At startup the app copies any that are missing into `<settings folder>/Dictionaries`, where
Electron looks for them before downloading.

| File | Language | Source and licence |
|---|---|---|
| `en-US-10-1.bdic`, `en-GB-10-1.bdic`, `en-AU-10-1.bdic`, `en-CA-10-1.bdic` | English | SCOWL word lists by Kevin Atkinson and others: a BSD-style permissive licence ([README_en_US](licenses/README_en_US.txt), [en_GB](licenses/README_en_GB.txt), [en_AU](licenses/README_en_AU.txt), [en_CA](licenses/README_en_CA.txt)) |
| `de-DE-3-0.bdic` | German | igerman98 by Björn Jacke: LGPL ([README](licenses/README_de_DE_neu.txt)) |
| `fr-FR-3-0.bdic` | French (also used for other French variants) | Dicollecte / Grammalecte by Olivier R.: MPL 2.0 ([README](licenses/README_fr_FR.txt)) |
| `es-ES-3-0.bdic` | Spanish (also used for es-419) | Santiago Bosio and Richard Holt: GNU GPL ([README](licenses/README_es_ES.txt)) |

Chromium's additions to these dictionaries are under the GPL 2.0 / LGPL 2.1 / MPL 1.1
tri-licence; the full texts are in [licenses/COPYING.txt](licenses/COPYING.txt), and
Chromium's notes in [licenses/README.chromium.txt](licenses/README.chromium.txt).

The dictionaries are separate data files: the app only reads them through Chromium's
spellchecker and does not link with them.
