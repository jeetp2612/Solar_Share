#!/usr/bin/env python3
"""
Data Forge — SolarShare pitch deck builder (v2, measurement-driven layout).
Run:  python3 deck/build_deck.py        Out: deck/SolarShare_DataForge.pptx
Every text block is measured with real font metrics so nothing overflows or collides.
"""
from __future__ import annotations
import os, sys
from pptx import Presentation
from pptx.util import Inches as In, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn
from PIL import Image, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
A = lambda n: os.path.join(HERE, "assets", n)

# ---------------------------------------------------------------- metrics
# PowerPoint line height = font ascent/descent (~1.22 em for these faces) * line_spacing.
LK = 1.22
def lh(size_pt, lead):
    """height in inches of one wrapped line at size/leading"""
    return size_pt * lead * LK / 72.0

FD  = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FDB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_cache = {}
def _pil(size_pt, bold):
    k = (round(size_pt * 1.3333), bold)
    if k not in _cache:
        _cache[k] = ImageFont.truetype(FDB if bold else FD, k[0])
    return _cache[k]

def text_w(s, size_pt, bold=False):
    """width in inches"""
    return _pil(size_pt, bold).getlength(s) / 96.0

def wrap_lines(s, size_pt, max_w, bold=False, lead=None):
    words, lines, cur = s.split(), [], ""
    for wd in words:
        t = (cur + " " + wd).strip()
        if text_w(t, size_pt, bold) <= max_w or not cur:
            cur = t
        else:
            lines.append(cur); cur = wd
    if cur:
        lines.append(cur)
    return lines

def nlines(s, size_pt, max_w, bold=False):
    return len(wrap_lines(s, size_pt, max_w, bold))

def block_h(s, size_pt, max_w, bold=False, lead=1.28):
    n = nlines(s, size_pt, max_w, bold)
    return n * lh(size_pt, lead), n

def fit(s, max_w, max_h, size, bold=False, lead=1.28, floor=8.0):
    """largest size <= `size` whose wrapped block fits max_h"""
    while size > floor:
        h, _ = block_h(s, size, max_w, bold, lead)
        if h <= max_h:
            return size, h
        size -= 0.5
    return floor, block_h(s, floor, max_w, bold, lead)[0]

# ---------------------------------------------------------------- palette
BG     = RGBColor.from_string("070A0F")
CARD   = RGBColor.from_string("111827")
CARD2  = RGBColor.from_string("0C121B")
LINE   = RGBColor.from_string("20293A")
GREEN  = RGBColor.from_string("35F08A")
AMBER  = RGBColor.from_string("FFB020")
BLUE   = RGBColor.from_string("5FA8FF")
WHITE  = RGBColor.from_string("EDF3FA")
DIM    = RGBColor.from_string("98AABE")
FAINT  = RGBColor.from_string("61748C")

F_HEAD = "Segoe UI"
F_BODY = "Segoe UI"
F_MONO = "Consolas"
W, H = 13.333, 7.5
ML, MR = 0.85, 12.483          # left margin, right edge
CW_ALL = MR - ML

prs = Presentation()
prs.slide_width, prs.slide_height = In(W), In(H)
BLANK = prs.slide_layouts[6]
WARN = []

# ---------------------------------------------------------------- shapes
def _no_autofit(tf):
    ll = tf._txBody.find(qn("a:bodyPr"))
    for tag in ("a:normAutofit", "a:spAutoFit"):
        e = ll.find(qn(tag))
        if e is not None:
            ll.remove(e)
    ll.append(ll.makeelement(qn("a:noAutofit"), {}))

def _solid(sh, c):
    sh.fill.solid(); sh.fill.fore_color.rgb = c

def _alpha(sh, pct):
    sp = sh.fill._xPr.find(qn("a:solidFill"))
    clr = sp.find(qn("a:srgbClr"))
    clr.append(clr.makeelement(qn("a:alpha"), {"val": str(int(pct * 1000))}))

def rect(s, x, y, w, h, fill=None, line=None, lw=1.0, r=None, alpha=None):
    sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if r is not None else MSO_SHAPE.RECTANGLE,
                            In(x), In(y), In(w), In(h))
    if fill: _solid(sh, fill); [(_alpha(sh, alpha)) for _ in [0] if alpha is not None]
    else:    sh.fill.background()
    if line:
        sh.line.color.rgb = line; sh.line.width = Pt(lw)
    else:
        sh.line.fill.background()
    sh.shadow.inherit = False
    if r is not None:
        try: sh.adjustments[0] = r
        except Exception: pass
    sh.text_frame.word_wrap = True
    return sh

def oval(s, x, y, w, h, fill, alpha=None):
    sh = s.shapes.add_shape(MSO_SHAPE.OVAL, In(x), In(y), In(w), In(h))
    _solid(sh, fill)
    if alpha is not None: _alpha(sh, alpha)
    sh.line.fill.background(); sh.shadow.inherit = False
    return sh

def txt(s, x, y, w, body, size=14, color=WHITE, bold=False, font=F_BODY,
        align=PP_ALIGN.LEFT, lead=1.28, anchor=MSO_ANCHOR.TOP, space_after=0,
        max_h=None, tag="", caps=False):
    """body: str | [(str, kw), ...]  (runs in ONE paragraph)  | [[(para,{}),...], ...]"""
    if max_h is not None:
        need, n = block_h(body if isinstance(body, str) else "".join(t for t, _ in body),
                           size, w, bold, lead)
        if need > max_h + 0.005:
            WARN.append(f"OVERFLOW {tag or s.slides.__len__() if False else tag}: need {need:.2f} > {max_h:.2f} :: {str(body)[:70]}")
    tb = s.shapes.add_textbox(In(x), In(y), In(w), In(max_h if max_h else 0.3))
    tf = tb.text_frame
    tf.word_wrap = True; tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    _no_autofit(tf)
    if isinstance(body, str):
        paras = [([(body, {})], {})]
    elif body and isinstance(body[0], tuple) and isinstance(body[0][0], list):
        paras = [(p[0], p[1] if len(p) > 1 else {}) for p in body]
    else:
        paras = [(body, {})]
    for i, (runs, pkw) in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = pkw.get("align", align)
        p.line_spacing = pkw.get("lead", lead)
        p.space_after = Pt(pkw.get("space_after", space_after))
        for t, kw in runs:
            r = p.add_run(); r.text = t.upper() if pkw.get("caps", caps) else t
            f = r.font
            f.size = Pt(kw.get("size", pkw.get("size", size)))
            f.bold = kw.get("bold", pkw.get("bold", bold))
            f.name = kw.get("font", pkw.get("font", font))
            f.color.rgb = kw.get("color", pkw.get("color", color))
    return tb

def chip_row(s, x, y, w, labels, fg=GREEN, size=9, box_h=0.26, pad=0.11, gap=0.10, row_gap=0.10):
    """Lays chips left-to-right, wrapping rows; returns bottom y."""
    cx, cy = x, y
    for lb in labels:
        cw_ = pad * 2 + text_w(lb, size, True) + 0.04
        if cx + cw_ > x + w:
            cx, cy = x, cy + box_h + row_gap
        chip(s, cx, cy, lb, fg=fg, size=size, box_h=box_h, pad=pad)
        cx += cw_ + gap
    return cy + box_h


def chip_size(label, size=9.5, pad=0.15):
    return pad * 2 + text_w(label, size, True) + 0.04

def chip_plan(x, w, labels, size=9, pad=0.11):
    """How many rows the chip flow needs inside width w (measure-only pass)."""
    rows, cx = 1, x
    for lb in labels:
        cw = chip_size(lb, size, pad)
        if cx + cw > x + w and cx > x:
            rows += 1; cx = x
        cx += cw + 0.10
    return rows

def chip_draw(s, x, y, w, labels, fg=GREEN, size=9, box_h=0.26, pad=0.11):
    cx, cy = x, y
    for lb in labels:
        cw = chip_size(lb, size, pad)
        if cx + cw > x + w and cx > x:
            cx, cy = x, cy + box_h + 0.10
        chip(s, cx, cy, lb, fg=fg, size=size, box_h=box_h, pad=pad)
        cx += cw + 0.10
    return cy + box_h

def chip(s, x, y, label, fg=GREEN, size=9.5, font=F_BODY, pad=0.15, box_h=0.28, fill=None):
    w = chip_size(label, size, pad)
    rect(s, x, y, w, box_h, fill=fill or CARD, line=fg, lw=0.75, r=0.5, alpha=None if fill else 55)
    txt(s, x, y + (box_h - size / 72.0 * 1.05) / 2, w, label, size=size, color=fg, bold=True,
        font=font, align=PP_ALIGN.CENTER)
    return w

def bullet_run(s, x, y, w, items, gap=0.155, dot=GREEN, t_size=13, size=11,
               lead=1.26, avail=None):
    """items: [(title, body)]. If avail is given, shrinks font so the stack fits."""
    if avail:
        while size > 8.5:
            tot = 0.0
            for t, b in items:
                tot += lh(t_size, 1.3) + nlines(b, size, w - 0.2) * lh(size, lead) + gap
            if tot - gap <= avail:
                break
            size -= 0.5; t_size = max(11.5, t_size - 0.25)
    cur = y
    for t, b in items:
        rect(s, x, cur + 0.085, 0.07, 0.07, fill=dot, r=0.5)
        txt(s, x + 0.2, cur, w - 0.2, t, size=t_size, color=WHITE, bold=True, font=F_HEAD, tag="bt")
        cur += lh(t_size, 1.16) + 0.02
        if b:
            h = nlines(b, size, w - 0.2) * lh(size, lead)
            txt(s, x + 0.2, cur, w - 0.2, b, size=size, color=DIM, lead=lead, max_h=h + 0.02, tag="bb")
            cur += h
        cur += gap
    return cur


def device(s, x, y, w, img, bar=True, line=LINE, max_h=None):
    """Rounded window frame sized from the image aspect ratio.
    Returns (bottom_y, frame_x, frame_w) so captions can align to it."""
    iw, ih = Image.open(img).size
    ar = iw / ih
    inset = 0.05
    bar_h = 0.26 if bar else 0.0
    pic_w = w - 2 * inset
    pic_h = pic_w / ar
    if max_h:
        cap = max_h - 2 * inset - bar_h
        if pic_h > cap:
            pic_h = cap
            pic_w = pic_h * ar
    fw = pic_w + 2 * inset
    total = pic_h + bar_h + 2 * inset
    fx = x + (w - fw) / 2
    rect(s, fx, y, fw, total, fill=CARD2, line=line, lw=1.1, r=0.045)
    if bar:
        for i, c in enumerate([RGBColor.from_string("DC5C60"), RGBColor.from_string("E0AE4A"), RGBColor.from_string("4CBE84")]):
            oval(s, fx + 0.18 + i * 0.15, y + 0.105, 0.085, 0.085, c)
        txt(s, fx + 0.62, y + 0.095, fw - 0.8, "solarshare \u00b7 mumbai rooftop microgrid", size=8.5,
            color=FAINT, font=F_MONO)
    s.shapes.add_picture(img, In(fx + inset), In(y + inset + bar_h), width=In(pic_w), height=In(pic_h))
    return y + total, fx, fw


def size_to_fit(cards, avail, size, gap=0.16, lead=1.24, min_h=0.5, floor=9.0, overhead=0.30):
    """cards: [(ignored, body, text_width)]. Returns (size, [card_heights]) sized so the
    whole stack fits `avail`, with `overhead` inches of padding baked into every card."""
    def hs_at(sz):
        return [max(min_h, overhead + nlines(b, sz, tw) * lh(sz, lead)) for _, b, tw in cards]
    while size > floor:
        h = hs_at(size)
        if sum(h) + gap * (len(cards) - 1) <= avail:
            return size, h
        size -= 0.5
    return floor, hs_at(floor)


def notes(sl, lines):
    tf = sl.notes_slide.notes_text_frame
    tf.text = lines[0]
    for l in lines[1:]:
        tf.add_paragraph().text = l

def base(kicker, title, sub=None, t_size=31, title_w=None):
    sl = prs.slides.add_slide(BLANK)
    rect(sl, 0, 0, W, H, fill=BG)
    oval(sl, W - 4.6, -3.6, 6.4, 6.4, GREEN, alpha=7)
    oval(sl, -2.9, H - 3.6, 5.6, 5.6, AMBER, alpha=6)
    rect(sl, 0, 0, W, 0.045, fill=GREEN)
    txt(sl, ML, 0.40, 8.0, kicker, size=10.5, color=GREEN, bold=True, caps=True, tag="kick")
    tw = title_w or CW_ALL
    TS_LEAD, SS_LEAD = 1.06, 1.18
    ts, th = fit(title, tw, 1.02, t_size, bold=True, lead=TS_LEAD)
    txt(sl, ML, 0.68, tw, title, size=ts, color=WHITE, bold=True, font=F_HEAD, lead=TS_LEAD,
        max_h=th + 0.02, tag="title")
    y = 0.68 + th + 0.10
    if sub:
        ss, sh = fit(sub, min(tw, 10.6), 0.62, 13.5, lead=SS_LEAD)
        txt(sl, ML, y, min(tw, 10.6), sub, size=ss, color=DIM, lead=SS_LEAD, max_h=sh + 0.02, tag="sub")
        y += sh + 0.12
    return sl, y

def footer(sl, n, total=6):
    rect(sl, ML, H - 0.50, CW_ALL, 0.010, fill=LINE)
    txt(sl, ML, H - 0.40, 9.0,
        [("DATA FORGE", {"color": GREEN, "bold": True, "size": 9}),
         ("   ·   SolarShare — peer-to-peer solar exchange, priced in ₹", {"color": FAINT, "size": 9})],
        tag="foot")
    txt(sl, MR - 1.3, H - 0.40, 1.3, f"{n} / {total}", size=9, color=FAINT, font=F_MONO,
        align=PP_ALIGN.RIGHT)


# ==================================================================== 1 TITLE
sl = prs.slides.add_slide(BLANK)
rect(sl, 0, 0, W, H, fill=BG)
oval(sl, W - 6.4, -4.4, 9.2, 9.2, GREEN, alpha=10)
oval(sl, -3.4, H - 4.4, 7.6, 7.6, AMBER, alpha=8)
rect(sl, 0, 0, W, 0.05, fill=GREEN)

LW = 6.28
rect(sl, ML, 0.58, 0.05, 0.30, fill=GREEN)
txt(sl, ML + 0.18, 0.60, 3.4, [("TEAM ", {"color": FAINT, "size": 10}),
                              ("DATA FORGE", {"color": GREEN, "size": 12, "bold": True})], tag="badge")
txt(sl, ML, 1.32, LW, "SOLARSHARE  ·  P2P ENERGY EXCHANGE", size=11, color=AMBER, bold=True, tag="t1k")
title = "Trade the sun next door."
ts, th = fit(title, LW, 1.55, 46, bold=True, lead=1.06)
txt(sl, ML, 1.70, LW, title, size=ts, color=WHITE, bold=True, font=F_HEAD, lead=1.06, tag="t1")
sub = ("Peer-to-peer rooftop solar for Indian households — priced in ₹, settled on real Postgres, "
       "and stamped into a SHA-256 hash-chained ledger you can verify in one click.")
ss, sh = fit(sub, LW, 1.05, 15, lead=1.22)
txt(sl, ML, 1.70 + th + 0.24, LW, sub, size=ss, color=DIM, lead=1.22, tag="t1s")

sy = 1.70 + th + 0.24 + sh + 0.30
stats = [("₹8.50", "market base price / kWh"), ("105", "unit tests passing"), ("1 click", "verify chain from genesis")]
sw = (LW - 0.3) / 3
for i, (k, v) in enumerate(stats):
    x = ML + i * (sw + 0.15)
    rect(sl, x, sy, sw, 0.84, fill=CARD, line=LINE, lw=0.9, r=0.10)
    txt(sl, x + 0.18, sy + 0.12, sw - 0.34, k, size=18, color=GREEN, bold=True, font=F_HEAD, tag="s1")
    vs, vh = fit(v, sw - 0.34, 0.36, 9.5, lead=1.1)
    txt(sl, x + 0.18, sy + 0.45, sw - 0.34, v, size=vs, color=FAINT, lead=1.1, max_h=vh, tag="s1b")
txt(sl, ML, sy + 1.02, LW,
    [("6 slides  ·  ~6 minutes  ·  live demo of the running app", {"color": FAINT, "size": 10})], tag="t1d")

RX0 = ML + LW + 0.42
dev_bottom, hx, hw = device(sl, RX0, 1.32, MR - RX0, A("hero.jpg"),
                           line=RGBColor.from_string("26364A"), max_h=H - 1.42 - 0.28 - 0.86 - 1.32)
facts = [("₹500", "welcome credit on sign-up"), ("3.0 kWp", "simulated rooftop per account"),
         ("₹5.5–13.5", "live band, Feeder 14")]
fy = dev_bottom + 0.22
rect(sl, hx, fy, hw, 0.86, fill=CARD, line=LINE, lw=0.9, r=0.08)
for i, (k, v) in enumerate(facts):
    x = hx + 0.24 + i * ((hw - 0.48) / 3)
    txt(sl, x, fy + 0.13, (hw - 0.48) / 3 - 0.22, k, size=13, color=WHITE, bold=True, tag="f1")
    txt(sl, x, fy + 0.43, (hw - 0.48) / 3 - 0.22, v, size=9, color=FAINT, lead=1.15, tag="f1b")
    if i:
        rect(sl, x - 0.22, fy + 0.16, 0.010, 0.54, fill=LINE)

ty = H - 1.42
rect(sl, ML, ty, CW_ALL, 0.80, fill=CARD2, line=LINE, lw=0.9, r=0.09)
txt(sl, ML + 0.26, ty + 0.29, 1.2, "BUILT BY", size=9, color=AMBER, bold=True, tag="by")
for i, (nm, role) in enumerate([("Jeet Patel", "ledger + trading engine"),
                                ("Shlok Vaghasiya", "marketplace UI + deal flow"),
                                ("Dhruvit Vadukiya", "data layer, tests, demo")]):
    x = ML + 1.62 + i * 3.62
    if i:
        rect(sl, x - 0.30, ty + 0.18, 0.010, 0.44, fill=LINE)
    txt(sl, x, ty + 0.15, 3.2, nm, size=13.5, color=WHITE, bold=True, tag="tm")
    txt(sl, x, ty + 0.46, 3.2, role, size=9.5, color=FAINT, tag="tmr")
txt(sl, ML, ty + 0.94, CW_ALL,
    [("Live web app — real accounts, real SQL, real hash chain.   ", {"color": DIM, "size": 11}),
     ("Optional read-only bridge: Polygon Amoy testnet (chainId 80002)", {"color": FAINT, "size": 11})],
    tag="t1f")
notes(sl, [
  "HOOK (20s): 'Your roof exports power at a fixed government rate. Your neighbour buys that same energy back at retail. "
  "Both of you lose, and nobody in between captures the value. We built that market.'",
  "Introduce Data Forge: Jeet (ledger + engine), Shlok (marketplace UI), Dhruvit (data + tests + demo).",
  "Set expectations: 'Everything you see is a running app, not mockups — and I will name exactly which parts are simulated.'",
])

# ==================================================================== 2 PROBLEM
sl, y0 = base("the problem", "Rooftop solar has no market — only a meter",
              "You generate 3 kW on your roof and ₹0 on your terms: surplus leaves at a fixed feed-in rate while "
              "the flat next door buys it back at retail.")
cards = [
  ("01", AMBER, "Locked surplus",
   "Net metering exports your daytime over-generation at a fixed feed-in tariff, settled monthly. You choose "
   "no price, no buyer, no timing — while your evening peak is billed at full retail."),
  ("02", GREEN, "Neighbours never meet",
   "A producer and a buyer on the same feeder, 400 m apart, cannot trade: no shared order book, no per-peer "
   "identity, no settlement rail, no record of who owed whom."),
  ("03", BLUE, "'Blockchain energy' that isn't",
   "Most demo projects ship a mockup and a logo. Judges and utilities ask one question — where is the record? "
   "A ledger you cannot re-hash from raw rows is a slide, not a system."),
]
# why-now band first so the card block can be measured against what is left
BH2 = 0.66
by = H - 0.72 - BH2
cw = (CW_ALL - 0.48) / 3
BWA = cw - 0.6
pb = 12.4
while nlines(cards[0][3], pb, BWA) * lh(pb, 1.24) > 1.95 or \
      any(nlines(b, pb, BWA) * lh(pb, 1.24) > 1.95 for _, _, _, b in cards):
    pb -= 0.3
body_need = max(nlines(b, pb, BWA) for _, _, _, b in cards) * lh(pb, 1.24)
t_lines = max(nlines(t, 19.5, BWA, True) for _, _, t, _ in cards)
HDR = 0.52 + t_lines * lh(19.5, 1.06)
BH = HDR + body_need + 0.62
while y0 + BH + 0.24 > by:
    pb -= 0.3
    body_need = max(nlines(b, pb, BWA) for _, _, _, b in cards) * lh(pb, 1.24)
    BH = HDR + body_need + 0.62
for i, (n, col, t, b) in enumerate(cards):
    x = ML + i * (cw + 0.24)
    rect(sl, x, y0, cw, BH, fill=CARD, line=LINE, lw=1.0, r=0.075)
    rect(sl, x, y0, cw, 0.05, fill=col)
    txt(sl, x + 0.30, y0 + 0.22, cw - 0.6, n, size=11.5, color=col, bold=True, font=F_MONO, tag="c2a")
    txt(sl, x + 0.30, y0 + 0.52, BWA, t, size=19.5, color=WHITE, bold=True, font=F_HEAD,
        lead=1.06, max_h=t_lines * lh(19.5, 1.06), tag="c2b")
    txt(sl, x + 0.30, y0 + HDR, BWA, b, size=pb, color=DIM, lead=1.24, max_h=body_need, tag="c2c")
    txt(sl, x + 0.30, y0 + BH - 0.42, BWA,
        ["Sell into a curve, not a market.", "Same wire. No meeting point.", "Trust needs proof."][i],
        size=11, color=col, bold=True, max_h=0.3, tag="c2d")

rect(sl, ML, by, CW_ALL, BH2, fill=CARD2, line=LINE, lw=0.9, r=0.08)
txt(sl, ML + 0.26, by + (BH2 - lh(9.5, 1.0)) / 2, 1.1, "WHY NOW", size=9.5, color=AMBER, bold=True, tag="wn")
rows = [("Residential rooftop is the fastest-growing solar segment", GREEN),
        ("Retail solar P2P value trades roughly ₹4–₹12 / kWh", AMBER),
        ("Every kWh traded peer-to-peer keeps that margin inside the feeder", BLUE)]
iw = (CW_ALL - 1.62) / 3
for i, (t, col) in enumerate(rows):
    x = ML + 1.62 + i * iw
    vs, vh = fit(t, iw - 0.62, BH2 - 0.20, 10.8, lead=1.14)
    rect(sl, x, by + (BH2 - vh) / 2 + lh(vs, 1.14) * 0.32, 0.075, 0.075, fill=col, r=0.5)
    txt(sl, x + 0.20, by + (BH2 - vh) / 2, iw - 0.62, t, size=vs, color=DIM, lead=1.14, max_h=vh, tag="wn2")
    if i:
        rect(sl, x - 0.24, by + 0.13, 0.010, BH2 - 0.26, fill=LINE)
footer(sl, 2)
notes(sl, [
  "About 60s. Walk the three cards left to right, then the WHY NOW strip. Do not read slides verbatim.",
  "Card 3 plants slide 5: 'in a minute I'll show you the actual hash chain, and I'll verify it in front of you.'",
  "Market honesty: say 'the app prices inside the ₹4–12/kWh band Indian retail solar trades in'. Never invent a TAM on stage.",
])

# ==================================================================== 3 PRODUCT
sl, y0 = base("the product", "One wallet. Two directions. Zero roles.",
              "Every account can Buy kWh and Sell kWh — ₹ balances, a real order book, a live route preview. "
              "This is the running app, not a mockup.", t_size=30, title_w=10.6)
DEW = 7.52
db, dfx, dfw = device(sl, ML, y0 + 0.04, DEW, A("dashboard.jpg"), line=RGBColor.from_string("26364A"),
                      max_h=H - 1.02 - (y0 + 0.04))
txt(sl, dfx, db + 0.10, dfw,
    "Live order book — peer, area, distance, reliability, lot left · best ask ₹5.65 · Trade panel with the "
    "complete route before you sign.", size=9.5, color=FAINT, lead=1.18, max_h=0.42, tag="cap3")
RX, RW = ML + DEW + 0.36, MR - (ML + DEW + 0.36)
chip(sl, RX, y0 + 0.00, "SAME WALLET, BOTH SIDES", fg=GREEN)
bend = bullet_run(sl, RX, y0 + 0.42, RW, [
  ("₹ first, always",
   "Prices, balances and ledger totals are INR. Base ₹8.5/kWh, live band ₹5.5–13.5, IST solar curve for "
   "Mumbai, BKC–Andheri Feeder 14."),
  ("Sign up → trade in 30 s",
   "Email + password lands in real SQL tables. New profiles get ₹500 credit and a 3 kWp rooftop that keeps "
   "generating through the day."),
  ("No producer/consumer tag",
   "Surplus accumulates from the panel curve and can be sold into the book the same minute you need to buy."),
  ("UPI rails for money in and out",
   "Top-up and withdraw against stored payment methods; each movement is a ₹ row plus a minted block."),
], gap=0.155, t_size=13, size=11, avail=(H - 1.30) - (y0 + 0.42))
rect(sl, RX, H - 1.24, RW, 0.78, fill=CARD, line=LINE, lw=0.9, r=0.08)
txt(sl, RX + 0.20, H - 1.10, RW - 0.4, "THE 60-SECOND DEMO", size=9, color=AMBER, bold=True, tag="d3")
dsz, dh = fit("sign up → ₹500 → pick a lot → sign → wallet and chain head move together",
              RW - 0.4, 0.46, 10, lead=1.14)
txt(sl, RX + 0.20, H - 0.83, RW - 0.4, "sign up → ₹500 → pick a lot → sign → wallet and chain head move together",
    size=dsz, color=DIM, lead=1.14, max_h=dh + 0.02, tag="d3b")
footer(sl, 3)
notes(sl, [
  "THIS SLIDE IS THE DEMO. If you can, alt-tab to the running app: sign up, ₹500 appears, sweep 5 kWh, watch ₹ go down and kWh go up in the same instant.",
  "Read one book row aloud: 'Sharma Rooftop, Andheri, 400 metres, 3.9 of 8.4 kWh left, ₹5.65, rating 4.9.' Specificity is what makes it credible.",
  "If the projector dies: this screenshot is from the same build, so the pitch survives without the demo.",
])

# ==================================================================== 4 ENGINE
sl, y0 = base("how trading works", "Three ways to trade — all quoted before you sign",
              "src/lib/deal.ts is a pure TypeScript engine: no React, no network, no DB. The same maths drives "
              "the preview and the settlement.", t_size=29, title_w=7.4)
DEW = 4.30
db, dfx, dfw = device(sl, ML, y0 + 0.02, DEW, A("deal.jpg"), line=RGBColor.from_string("26364A"),
                      max_h=H - 1.16 - (y0 + 0.02))
txt(sl, dfx, db + 0.12, dfw,
    "Direct P2P deal sheet: a slice of one neighbour's lot, offer band, instalments, margin vs mid, blocks to mint.",
    size=9.5, color=FAINT, lead=1.18, max_h=0.44, tag="cap4")
RX = ML + DEW + 0.40
RW = MR - RX
modes = [
  ("MARKET SWEEP", GREEN, "routeFill()",
   "Walk the cheapest asks (or richest bids) until you are filled — across as many neighbours as it takes. "
   "One order can produce several legs, and one leg can take part of a lot."),
  ("LIMIT ORDER", AMBER, "rests on the book",
   "Set your own price with an explicit margin versus the mid. The unfilled remainder stays on the order book "
   "as your order; a match settles it atomically."),
  ("DIRECT P2P DEAL", BLUE, "directDeal() · splitInstalments()",
   "One named neighbour, any slice from their minimum up to the whole lot, an offer inside a ±2.5% band "
   "(accepted or countered), and delivery split into instalments — each one its own block."),
]
QCH = ["average price", "gross", "grid fee 1%", "you pay", "slippage vs best", "margin vs mid", "blocks minted"]
qrows = chip_plan(RX + 0.26, RW - 0.52, QCH)
QOH = 0.40 + (qrows - 1) * 0.36 + 0.16
bs, hs = size_to_fit([(0, b, RW - 0.52) for _, _, _, b in modes],
                     (H - 0.72) - (y0 + 0.02) - (QOH + 0.16) - 3 * 0.16, 11.5, gap=0.16,
                     lead=1.24, min_h=0.72, overhead=0.63)
y = y0 + 0.02
for (name, col, fn, body), hh in zip(modes, hs):
    rect(sl, RX, y, RW, hh, fill=CARD, line=LINE, lw=1.0, r=0.07)
    rect(sl, RX + 0.02, y + 0.12, 0.045, hh - 0.24, fill=col)
    txt(sl, RX + 0.26, y + 0.15, 3.0, name, size=11, color=col, bold=True, tag="m4")
    txt(sl, RX + 3.2, y + 0.16, RW - 3.46, fn, size=9.5, color=FAINT, font=F_MONO,
        align=PP_ALIGN.RIGHT, max_h=0.24, tag="m4f")
    txt(sl, RX + 0.26, y + 0.45, RW - 0.52, body, size=bs, color=DIM, lead=1.24,
        max_h=hh - 0.59, tag="m4b")
    y += hh + 0.16
qy = y + 0.02
rect(sl, RX, qy, RW, QOH, fill=CARD2, line=LINE, lw=0.9, r=0.07)
txt(sl, RX + 0.26, qy + 0.11, 4.6, "EVERY QUOTE SHOWS BEFORE YOU SIGN", size=9, color=AMBER, bold=True, tag="q4")
chip_draw(sl, RX + 0.26, qy + 0.40, RW - 0.52, QCH)
footer(sl, 4)
notes(sl, [
  "Depth slide for the technical judge: 'The engine is pure and unit-tested, so what the UI quotes is exactly what the database settles — there is no second implementation to disagree with.'",
  "Human moment: 'Can I buy just 2 of Sharma's 3.9 kWh now and the rest next week?' Yes — and it becomes four verifiable blocks instead of one promise.",
  "Money question: 'Nothing settles silently. Grid fee, slippage and margin versus the mid price are on screen before you sign.'",
])

# ==================================================================== 5 LEDGER
sl, y0 = base("the trust layer", "Every trade mints a block — and you can re-hash the chain",
              "Not a whitepaper promise: a SHA-256 hash chain stored in the same Postgres as your balance.",
              t_size=29, title_w=7.6)
DEW = 3.62
db, dfx, dfw = device(sl, ML, y0 + 0.02, DEW, A("ledger.jpg"), bar=False, line=RGBColor.from_string("26364A"),
                     max_h=H - 1.14 - (y0 + 0.02))
txt(sl, dfx, db + 0.14, dfw, "Energy ledger dialog: chain head, verification banner, recent blocks.",
    size=9, color=FAINT, lead=1.18, max_h=0.44, tag="cap5")
RX = ML + DEW + 0.42
RW = MR - RX
rows = [
  ("What a block is", GREEN,
   "Block n carries the SHA-256 of its canonical payload — block number, previous hash, timestamp, transactions "
   "— and links to block n−1. Genesis is deterministic."),
  ("What mints one", AMBER,
   "Top-up, buy, sell, order listing, withdrawal. A 3-instalment deal is 3 blocks, so 'first some kWh, then the "
   "next some' is three auditable records, not one."),
  ("verifyChain()", BLUE,
   "Recomputes every hash from raw DB rows and reports the first bad block: edited transaction → hash mismatch, "
   "deleted block → broken link, changed prev hash → broken link."),
  ("Live, no reloads", GREEN,
   "ledger-feed.ts folds each poll into the list: unchanged blocks keep object identity so rows never re-render, "
   "new blocks queue and land one at a time, inserts above you are scroll-anchored, polling pauses while the tab hides."),
  ("A real chain, read live", AMBER,
   "JSON-RPC to public Polygon Amoy endpoints, chainId verified before a reading is accepted, last healthy "
   "endpoint kept sticky, and an honest reason shown when the sandbox has no egress."),
]
bs, hs = size_to_fit([(0, b, RW - 2.62) for _, _, b in rows],
                     (H - 0.70) - (y0 + 0.02), 10.8, gap=0.14, lead=1.22, min_h=0.56, overhead=0.28)
y = y0 + 0.02
for (t, col, b), hh in zip(rows, hs):
    rect(sl, RX, y, RW, hh, fill=CARD, line=LINE, lw=0.95, r=0.07)
    rect(sl, RX + 0.02, y + 0.12, 0.045, hh - 0.24, fill=col)
    txt(sl, RX + 0.24, y + 0.13, 2.34, t, size=12.5, color=WHITE, bold=True, lead=1.08,
        max_h=hh - 0.22, tag="l5t")
    txt(sl, RX + 2.56, y + 0.13, RW - 2.62, b, size=bs, color=DIM, lead=1.22,
        max_h=hh - 0.24, tag="l5b")
    y += hh + 0.14
footer(sl, 5)
notes(sl, [
  "Your moat slide. Most teams cannot answer 'show me the record'.",
  "Say the distinction so nobody calls it an overclaim: 'The SolarShare chain is an application ledger BUILT like a blockchain — hash-chained, verifiable, tamper-evident. Amoy is a genuine external chain we read from; we are not claiming to run consensus ourselves.'",
  "Demo if possible: open Ledger → Verify chain → 'Verified N blocks from genesis — hashes and links intact'. Then: 'edit any row by hand in Postgres and this turns red at that exact block.'",
  "If asked about Merkle trees or PoS: 'No Merkle tree, no validator set — PoA-shaped. The payload is already canonical, so anchoring the head hash on-chain is a next step, not a rewrite.'",
])

# ==================================================================== 6 REAL / NEXT
sl, y0 = base("what's real · what's next", "Shipped today — and defensible in Q&A",
              "We would rather hand you the exact boundary of what is simulated than be caught inflating it.",
              t_size=29, title_w=7.4)
COLW = (CW_ALL - 0.44) / 2
X2 = ML + COLW + 0.44
BAND_H, ROAD_H = 0.28, 0.70
BAND_TOP = H - 0.80 - BAND_H - 0.10 - ROAD_H
COL_BOT = BAND_TOP - 0.18
txt(sl, ML, y0, 4.0, "STACK", size=9.5, color=AMBER, bold=True, tag="h6a")
txt(sl, X2, y0, 4.0, "PROOF ON THE RECORD", size=9.5, color=AMBER, bold=True, tag="h6b")
stack = [
  ("Frontend", "React 19 · TanStack Start + Router with SSR · Tailwind 4 · Recharts · Radix"),
  ("Server", "createServerFn + bearer-token middleware → SQL in the same request path"),
  ("Auth", "better-auth email+password → user/session/account, bcrypt-scrypt, httpOnly cookies"),
  ("Data", "PGLite (embedded PostgreSQL 16) or Neon via DATABASE_URL · migrations 0001–0003"),
  ("Ledger", "ledger-core.ts (pure hashing) · ledger.server.ts (mint/verify) · ledger-feed.ts (live UI)"),
  ("Chain read", "testnet.server.ts → Polygon Amoy, read-only, chainId-guarded, graceful offline"),
]
proof = [
  ("105 / 105", "app tests pass — ledger core, live feed, trading engine, network bridge"),
  ("6 + 14", "tests on the chain (deterministic hashing, genesis, tamper) and on the live ledger list"),
  ("1 E2E", "HTTP smoke mirroring the browser: sign-up → ₹500 → top-up → buy → list → verify → withdraw"),
  ("SSR", "dashboard renders server-side — ₹ balances, market, wallet, all in the HTML"),
]
GAP6 = 0.08
top6 = y0 + 0.26
RH = (COL_BOT - top6 - GAP6 * (len(stack) - 1)) / len(stack)
y = top6
for k_, v in stack:
    rect(sl, ML, y, COLW, RH, fill=CARD, line=LINE, lw=0.9, r=0.07)
    txt(sl, ML + 0.16, y + (RH - lh(10.5, 1.0)) / 2, 1.12, k_, size=10.5, color=GREEN, bold=True, tag="st6")
    vs, vh = fit(v, COLW - 1.58, RH - 0.10, 10.2, lead=1.14)
    txt(sl, ML + 1.44, y + (RH - vh) / 2, COLW - 1.58, v, size=vs, color=DIM, lead=1.14,
        max_h=vh + 0.02, tag="st6b")
    y += RH + GAP6
y2 = top6
for big, small in proof:
    rect(sl, X2, y2, COLW, RH, fill=CARD, line=LINE, lw=0.9, r=0.07)
    txt(sl, X2 + 0.16, y2 + (RH - lh(13, 1.0)) / 2, 0.98, big, size=13, color=WHITE, bold=True,
        font=F_HEAD, tag="pr6")
    vs, vh = fit(small, COLW - 1.38, RH - 0.10, 10.2, lead=1.14)
    txt(sl, X2 + 1.22, y2 + (RH - vh) / 2, COLW - 1.38, small, size=vs, color=DIM, lead=1.14,
        max_h=vh + 0.02, tag="pr6b")
    y2 += RH + GAP6
# honest-limits box fills whatever the proof column left
HON = ("PGLite is in-memory per process (swap in Postgres for durability)  ·  neighbour lots and ambient "
       "activity are simulated client-side  ·  the chain is PoA-shaped, not a consensus network  ·  "
       "live Amoy reads depend on egress")
box_top = y2 + 0.04
box_avail = COL_BOT - box_top
hz = 10.0
while 0.22 + nlines(HON, hz, COLW - 1.72) * lh(hz, 1.16) > box_avail and hz > 8.0:
    hz -= 0.25
HH = min(box_avail, 0.22 + nlines(HON, hz, COLW - 1.72) * lh(hz, 1.16))
rect(sl, X2, box_top, COLW, HH, fill=CARD2, line=RGBColor.from_string("40341A"), lw=1.0, r=0.07)
rect(sl, X2 + 0.02, box_top + 0.11, 0.045, HH - 0.22, fill=AMBER)
txt(sl, X2 + 0.22, box_top + 0.11, 1.32, "HONEST\nLIMITS", size=9.5, color=AMBER, bold=True, lead=1.12, tag="hon6")
_hh = nlines(HON, hz, COLW - 1.80) * lh(hz, 1.16)
txt(sl, X2 + 1.62, box_top + (HH - _hh) / 2, COLW - 1.80, HON, size=hz, color=DIM, lead=1.16,
    max_h=_hh + 0.02, tag="hon6b")

# bottom band: label + thank-you on one line, then 4 roadmap cards
txt(sl, ML, BAND_TOP, 3.2, "NEXT, IN ORDER", size=9.5, color=GREEN, bold=True, tag="rn6")
ty6 = "Thank you — DATA FORGE   ·   Jeet Patel · Shlok Vaghasiya · Dhruvit Vadukiya"
tsz6, _ = fit(ty6, 7.6, 0.3, 10.5, lead=1.0)
txt(sl, MR - 7.7, BAND_TOP - 0.005, 7.7, ty6, size=tsz6, color=FAINT, align=PP_ALIGN.RIGHT, tag="ty6")
road = [("1 · Persist", "managed Postgres + real UPI payout and settlement records"),
        ("2 · Share", "server-side order book so neighbours are real members, with disputes"),
        ("3 · Anchor", "deploy EnergyPool on Amoy; anchor each block head hash on-chain"),
        ("4 · Comply", "feeder-level P2P within net-metering rules · WhatsApp / UPI-lite reach")]
ry = BAND_TOP + BAND_H
rw = (CW_ALL - 0.36) / 4
for i, (t, b) in enumerate(road):
    x = ML + i * (rw + 0.12)
    rect(sl, x, ry, rw, ROAD_H, fill=CARD, line=LINE, lw=0.95, r=0.07)
    txt(sl, x + 0.18, ry + 0.10, rw - 0.36, t, size=11, color=GREEN, bold=True, tag="rd6")
    bs2, bh2 = fit(b, rw - 0.36, ROAD_H - 0.40, 9.6, lead=1.14)
    txt(sl, x + 0.18, ry + 0.335, rw - 0.36, b, size=bs2, color=DIM, lead=1.14, max_h=bh2 + 0.02, tag="rd6b")
footer(sl, 6)
notes(sl, [
  "Close honest and get credit for it: 'Working app, real accounts, real SQL, real hash chain — and here is exactly the part we simulated.'",
  "Then the ask: 'Give us real feeder data and one pilot housing society and we run this for real.'",
  "Q&A prep — (1) Is this legal? We assume open-access / net-metering rules, which is why Comply is step 4. (2) Why not just net-metering? It prices nothing and matches nobody. (3) What if someone edits the database? verifyChain() re-hashes from raw rows and names the first broken block. (4) Why was Amoy unreachable? No egress from the sandbox — the app marks the head stale with a reason instead of faking it.",
])

OUT = os.path.join(HERE, "SolarShare_DataForge.pptx")
prs.save(OUT)
print("saved", OUT, round(os.path.getsize(OUT) / 1024), "KB, slides:", len(prs.slides._sldIdLst))
if WARN:
    print("\n".join("!! " + w for w in WARN[:25]))
    print(f"{len(WARN)} layout warnings")
else:
    print("no layout warnings")
