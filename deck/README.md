# deck/ — SolarShare pitch deck (Data Forge)

| file | what it is |
| --- | --- |
| `SolarShare_DataForge.pptx` | the deck — 6 slides, 16:9, dark solar-tech theme, speaker notes on every slide |
| `SolarShare_DataForge.pdf` | read-only backup for presenting from any machine |
| `PRESENTER-NOTES.md` | 6-minute talk track, demo steps, Q&A crib sheet, who answers what |
| `build_deck.py` | the generator — **edit this to change the deck**, then re-run |
| `assets/*.jpg` | the four images embedded in the deck (dashboard, hero, deal sheet, ledger) |
| `shots/*.png` | raw full-size screenshots (sources for `assets/`) |
| `../scripts/shots-deck.mjs` | Playwright script that logs into the running app and captures those screenshots |

## Rebuild the deck
```bash
python3 -m pip install --break-system-packages python-pptx Pillow   # once
python3 deck/build_deck.py                                          # writes deck/SolarShare_DataForge.pptx
```
The builder measures every string with real font metrics (DejaVu, a conservative stand-in for Segoe UI) and
prints `no layout warnings` when nothing can overflow its box. If you edit copy and see
`!! OVERFLOW …`, shorten that line or lower the size passed to `fit()` — the layout will not silently break.

## Refresh the screenshots from the app
```bash
npm run dev                                  # serves :8080
LD_LIBRARY_PATH=<chromium-libs> node scripts/shots-deck.mjs   # writes deck/shots/*.png
```
`scripts/shots-deck.mjs` signs up a throwaway profile, opens the ledger dialog, runs *Verify chain*, and
captures the deal sheet — then re-crop into `deck/assets/`:
```python
from PIL import Image
Image.open("deck/shots/dashboard-source.png").crop((40,150,3160,1950)).save("deck/assets/dashboard.jpg", quality=90)
```

## Team names / roles
Hard-coded once per slide, in `build_deck.py` — the cover band (`BUILT BY`), the closing thank-you line, and the
`facts` strip. Search for `"Jeet Patel"` and update all three places together.

## Design tokens
`BG #070A0F`, `CARD #111827`, `LINE #20293A`, accent `GREEN #35F08A` (product), `AMBER #FFB020` (money/claims),
`BLUE #5FA8FF` (verification). Headings/body use **Segoe UI** (falls back cleanly on macOS/Google Slides),
code and hashes use **Consolas**. Slides are 13.333 × 7.5 in (16:9).

## Slide map
1. Cover — hook, team, three proof numbers, live product frame
2. Problem — locked surplus · neighbours never meet · fake "blockchain energy" + why now
3. Product — live dashboard tour, ₹ wallet, no roles, UPI rails, 60-second demo beat
4. Trading engine — market sweep · limit · direct P2P with instalments, quote-before-sign chips
5. Trust layer — hash chain, minting events, `verifyChain()`, live feed, Amoy read
6. Real vs simulated — stack, tests, honest limits, roadmap (Persist → Share → Anchor → Comply)

## Claims discipline (so the deck stays defensible)
Everything stated in these slides is traceable to the repo: `README.md`, `src/lib/deal.ts`,
`src/lib/solar/*`, `migrations/*`. Do not add market-size figures, user counts or "we replaced the grid" style
claims — the honest-limits box on slide 6 is a feature, not a weakness.
