# Using Review Assistant with Claude Desktop

If you have a Claude subscription (Pro or Max), you can chat about your review in **Claude Desktop** and pay nothing extra: no API key and no API costs. Claude reads the review that's open in Review Assistant. It **can't change anything** in it.

## One-time setup

1. Install [Claude Desktop](https://claude.ai/download) and sign in.
2. In Review Assistant, open **Settings → Preferences** and scroll to **Connect to Claude Desktop**.
3. Tick **Let Claude Desktop read the open review** and press **Save**.
4. Open Preferences again and click **Save extension for Claude Desktop…**. Save the file (`Review Assistant.mcpb`); its folder opens afterwards.
5. Double-click the `.mcpb` file, or drag it into the Claude Desktop window. In the dialog that opens, choose **Install**.
   - Alternatively: in Claude Desktop, go to **Settings → Extensions → Advanced settings → Install Extension…** and pick the file.
6. Restart Claude Desktop if it was already open.

## Everyday use

- Keep Review Assistant open with your review. The switch stays on until you turn it off.
- In Claude Desktop, ask about your review, for example:
  - "What tabs are in my review?"
  - "Summarise the notes in the *Elite swimmers* tab."
  - "Find the studies that mention pacing but not juniors, and compare their designs."
- While Claude is reading, Review Assistant's status bar shows **Claude Desktop is reading…**. Claude Desktop may ask you to allow each tool the first time.

## What Claude can see

| Tool | What it returns |
|---|---|
| `list_tabs` | The tabs, with their row counts. Tab 1 (Main) has every row. |
| `get_columns` | The columns, their types and dropdown options. |
| `get_rows` | A tab's rows with every column, 50 at a time (the app's filters are ignored). |
| `search_rows` | Rows matching a search, using the same syntax as the app's search box (`"phrase"`, `OR`, `NOT`, `swim*`). |
| `get_row` | One row, and the tabs it's in. |

Only the file that's open in Review Assistant is visible. Claude can't open other files, and nothing is sent over the network by Review Assistant: Claude Desktop sends what the tools return to Claude as part of your chat, just like text you paste in.

## Turning it off

Untick **Let Claude Desktop read the open review** and press **Save**. The connection closes immediately. Claude's tools then reply that Review Assistant isn't available. To remove the extension completely, uninstall it in Claude Desktop under **Settings → Extensions**.

## Troubleshooting

- **"Review Assistant is not running, or Connect to Claude Desktop is off":** open the app with a review and check that the switch is on (Preferences shows "On: waiting for Claude Desktop").
- **"This extension belongs to another Review Assistant setup":** the extension came from another computer or user account. Save it again from Preferences and reinstall it.
- **"In use by another copy of Review Assistant":** only one running copy of the app can be connected (e.g. the installed app and a development copy started with `npm run dev`). Close the other one, then turn the switch off and on again.
- Review Assistant's log (in the app's user-data `Logs` folder) lists each tool call by name, without its content.

## Security notes

- Review Assistant listens only on a local pipe on this computer, never on a network port. Claude Desktop's extension proves it belongs to this install with a secret token saved in the extension.
- While the switch is on, any program running under your Windows account could in principle read the open review through this pipe, just as it could read the `.review` file itself. With the app closed, a malicious program on your PC could also pretend to be Review Assistant and feed Claude made-up data. On a normal single-user PC this is a minor risk; turn the switch off when you don't need it.
- Nothing can be changed through the connection: the database refuses writes while a tool runs.
