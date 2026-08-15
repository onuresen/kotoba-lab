# Privacy

Kotoba Lab is a static, browser-only application. It has no user accounts,
analytics, advertising, application backend, or cloud synchronization.

## Text and study data

- Text you paste or import is processed in the browser and is not uploaded by
  Kotoba Lab.
- Saved cards, review scheduling, known words, known kanji, and review history
  are stored in your browser's `localStorage`.
- Saved cards may include the sentence in which a word was encountered.
- Clearing site data removes this local state. Use **Profile & Data** in
  **My Words** if you want to retain or move it.
- Full profile exports include saved sentence context because it belongs to
  saved cards. Portable study packs contain kanji dictionary metadata only and
  exclude schedules, known state, review history, pasted text, and sentences.
- Profile, study-pack, and TSV files are created locally and are only sent
  elsewhere if you choose to share or upload them.

## Optional usage journal

- The local usage journal is off by default and can be enabled, paused, or
  reset from **Profile & Data**.
- When enabled, it stores daily totals for sessions, visible active minutes,
  and a fixed list of coarse actions such as opening a tab, Radical Tree,
  Relations or Atlas view, study session, export, or answering a review card.
- It never stores pasted text, words, kanji, searches, filenames, answers,
  grades, or individual-action timestamps. Its oldest daily totals are removed
  after 90 days.
- Journal data stays in this browser, is never transmitted, and is deliberately
  excluded from profile backups and portable study packs.
- The friction radar derives suggestions locally from these coarse totals and
  the current due-card count. It does not add stored fields, retain the due-card
  count, or inspect study content.
- The optional Markdown usage report contains overall activity totals, six
  feature-category counts, aggregate profile counts, and fixed suggestion text.
  It excludes raw journal data and event names, daily dates, individual-action
  timing, last-review dates, and study content. The report stays local unless
  you choose to copy, share, or upload it.

## Offline storage

- Kotoba Lab installs a service worker so it can open without a connection. The
  worker stores **application files only**: HTML, styles, scripts, icons, and the
  committed dictionary data.
- It never stores pasted text, saved words, review history, or known-kanji state.
  Cache Storage is a separate browser feature from `localStorage` and is excluded
  from profile backups and portable study packs by construction.
- **Profile & Data** reports what is currently stored for offline use. The
  optional precise tokenizer is downloaded only when you ask for it.
- Because fonts are cached after the first online load, an installed copy makes
  *fewer* requests to Google Fonts than an uninstalled one, not more.
- Clearing site data removes this cache. The application then re-downloads its
  files on the next online visit.

## Network requests

The hosted application downloads its HTML, styles, scripts, dictionaries, and
vendored tokenizer from the same static site. It also requests optional fonts
from Google Fonts; the application falls back to system fonts if they are not
available.

As with any website, the hosting provider and font provider may receive normal
request information such as an IP address and browser headers. Kotoba Lab does
not transmit pasted Japanese text or study data in those requests.
