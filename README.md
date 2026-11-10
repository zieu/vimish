<p align="center"><img src="icons/icon128.png" width="96" alt="Vimish logo"></p>

# Vimish

A small Chrome extension that adds a few Vim keys to every web page. It covers only the keys I use, nothing more.

## Keys

| Key | Action |
| --- | --- |
| `j` / `k` | Scroll down / up. Tap for a short step, hold to scroll smoothly. |
| `gg` | Go to the top of the page (second `g` within 1 second). |
| `G` | Go to the bottom of the page. |
| `H` / `L` | Go back / forward in history. |
| `f` | Show link hints. Type the letters on a hint to click it. `Backspace` removes a letter, `Esc` cancels. |
| `/` | Open the find bar. Matches highlight as you type. `Enter` keeps them, `Esc` clears them. |
| `n` / `N` | Jump to the next / previous match. Wraps around. |
| `Esc` | Clear find highlights. |

Keys are ignored while you type in an input, textarea, select or editable area, and when Ctrl, Alt or Cmd is held.

Find is case-insensitive unless the query has a capital letter (Vim's smartcase).

## Disable on a site

Click the Vimish icon in the toolbar and press **Disable on this site**. The site's open tabs stop using Vimish right away, and its own shortcuts work again. The list is saved per hostname (`github.com` and `gist.github.com` are separate) and syncs with your Chrome profile.

## Install

1. Clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick the repo folder.
4. Reload any tabs that were already open.

After changing the code, click the reload button on the extension card, then reload the page.

## Known limits

- Vimish takes its keys before the page does, so site shortcuts on the same keys (GitHub's `/`, `j`, `k`, `g …`) don't fire. Disable Vimish on that site if you need them.
- Find doesn't match text split across elements, like `f<b>oo</b>`.
- Find results don't update if the page changes after you press `Enter`. Search again.
- Chrome doesn't run extensions on `chrome://` pages or the Chrome Web Store.

## Files

| File | What it is |
| --- | --- |
| `manifest.json` | Extension manifest (MV3). |
| `content.js` | All key handling: scrolling, hints, find, history, per-site disable. |
| `content.css` | Colors for find highlights. |
| `popup.html`, `popup.js` | Toolbar popup with the per-site toggle. |
| `icons/` | `logo.svg` source and the PNG sizes Chrome uses. |
