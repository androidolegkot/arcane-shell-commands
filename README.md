# Arcane Shell Commands

Tampermonkey userscript that adds a **Commands** menu to the Arcane container Shell page.

## Features

- **Insert** — put a saved command into the Shell input without executing it.
- **Execute** — put a saved command into the Shell input and send Enter.
- **Edit** — edit the folder and command tree as JSON.
- Opens on hover, with cascading submenus that do not require clicks to navigate folders.
- Supports nested folders and commands.
- Stores the command tree in this browser's `localStorage`; no server or external dependencies.

## Install

1. Open the repository and copy `arcane-shell-commands.user.js`.
2. Create a new userscript in Tampermonkey and paste the file contents.
3. Open an Arcane container page with the Shell tab selected, for example `http://localhost:3552/containers/<container-id>?tab=shell`.

## Command tree format

Folders are nested objects. A string value is a command; its key is the label shown in the menu.

```json
{
  "vpn": {
    "wg": {
      "de": {
        "status": "wg show",
        "interfaces": "ip -br link"
      }
    }
  }
}
```

Hover over **Commands**, then click **Edit** to open the editor. Replace the JSON with your tree, then click **Save**. The sample commands above are examples only.

## Adapt to another panel

The script is plain JavaScript and does not depend on Svelte, React, or xterm.js APIs. To adapt it, edit the `SELECTORS` object near the top of the userscript:

- `shellInput` — the textarea used for terminal input.
- `insertBefore` — the control beside which the menu button is inserted.

The tested Arcane input is `textarea.xterm-helper-textarea`. The script also expects the Shell tab to be indicated by `?tab=shell` and a container URL beginning with `/containers/`; adjust `isShellPage()` if the target panel uses a different URL.

## Notes

- The script targets `http://localhost:3552/containers/*`. Change the Tampermonkey `@match` line if your Arcane instance uses a different host, port, or protocol.
- The Execute action uses a synthetic Enter `keydown`, confirmed to work in the tested Arcane setup. Other terminal panels may handle synthetic keyboard events differently.
