#!/usr/bin/env python3
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

PORT = "8765"
SCREENS = Path("/workspace/eddie-richie-game/screens")
SCREENS.mkdir(parents=True, exist_ok=True)

JS_METRICS = """
() => {
  const leaking = [];
  document.querySelectorAll("h1,h2,h3,p,button,.note,.tag").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (r.left < -2 || r.right > window.innerWidth + 2 || r.top < -2 || r.bottom > window.innerHeight + 2) {
      leaking.push({
        text: (el.textContent || "").trim().slice(0, 60),
        box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
      });
    }
  });
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    leaking,
  };
}
"""


def overflow_report(info):
    return {
        "inner": f"{info['innerWidth']}x{info['innerHeight']}",
        "scroll": f"{info['scrollWidth']}x{info['scrollHeight']}",
        "overflowX": info["scrollWidth"] > info["innerWidth"] + 2,
        "overflowY": info["scrollHeight"] > info["innerHeight"] + 2,
        "leaking": info["leaking"],
    }


def main():
    errors = []
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("console", lambda msg: errors.append(f"console:{msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(f"pageerror:{err}"))

        page.goto(f"http://127.0.0.1:{PORT}/", wait_until="load", timeout=20000)
        page.wait_for_function("() => window.ER && ER.Sprites && ER.Sprites.ready && ER.Test", timeout=15000)
        page.wait_for_timeout(300)

        page.screenshot(path=str(SCREENS / "title-desktop.png"), full_page=False)
        results["titleDesktop"] = overflow_report(page.evaluate(JS_METRICS))

        page.evaluate("() => ER.Test.start('1p-eddie')")
        page.wait_for_timeout(200)
        st = page.evaluate("() => ER.Test.state()")
        if st["screen"] != "play":
            raise RuntimeError(f"1p-eddie did not start: {st}")
        if st["eddie"]["control"] != "p1" or st["richie"]["control"] != "cpu":
            raise RuntimeError(f"1p-eddie controls wrong: {st}")
        if st["eddie"]["hp"] != st["eddie"]["maxHp"]:
            raise RuntimeError("eddie should start at full health")
        hp_before = st["richie"]["hp"]
        damaged = page.evaluate("() => ER.Test.damage('richie', 30)")
        st = page.evaluate("() => ER.Test.state()")
        if not damaged or st["richie"]["hp"] != hp_before - 30:
            raise RuntimeError(f"hit did not reduce health: {st['richie']}")

        retry = page.evaluate(
            """() => {
              const e = ER.Game.eddie, r = ER.Game.richie;
              r.iframes = 0; r.stun = 0;
              ER.Test.move('richie', e.x + 28, e.y);
              e.facing = 1;
              e.action = { type: 'swing', t: ER.EDDIE_SWING.windup + 1, dur: 40, hit: false };
              const before = r.hp;
              e._tryBatHit(r);
              return { before, after: r.hp };
            }"""
        )
        if retry["after"] >= retry["before"]:
            raise RuntimeError(f"bat swing did not connect {retry}")
        results["batHit"] = retry

        page.wait_for_timeout(80)
        page.screenshot(path=str(SCREENS / "fight-desktop.png"), full_page=False)
        results["fightDesktop"] = overflow_report(page.evaluate(JS_METRICS))

        page.evaluate("() => ER.Test.kill('richie')")
        page.wait_for_timeout(150)
        st = page.evaluate("() => ER.Test.state()")
        if st["screen"] != "win" or st["winner"] != "eddie":
            raise RuntimeError(f"expected eddie win, got {st}")
        page.screenshot(path=str(SCREENS / "win-desktop.png"), full_page=False)
        results["winDesktop"] = overflow_report(page.evaluate(JS_METRICS))

        # --- Bug 1: a thrown object must never hurt its thrower -------------
        self_hit = page.evaluate(
            """() => {
              const G = ER.Game, report = { scenarios: [], cpuSelfHits: [], cpuThrows: 0, cpuAwayThrows: 0 };
              const types = Object.keys(ER.ITEM_SPEC);
              const idle = { x: 0, y: 0, attack: false, pickup: false };
              ['richie', 'eddie'].forEach(who => {
                types.forEach(type => {
                  [{ x: 30, facing: -1, label: 'point-blank at left wall' },
                   { x: 930, facing: 1, label: 'point-blank at right wall' },
                   { x: 480, facing: 1, label: 'open floor' }].forEach(sc => {
                    ER.Test.start('2p');
                    const me = G[who], other = who === 'eddie' ? G.richie : G.eddie;
                    other.x = sc.x < 480 ? 900 : 60; other.y = 214;
                    me.x = sc.x; me.y = 200; me.facing = sc.facing; me.vx = -sc.facing * 2; /* drifting backwards */
                    const it = G.items.find(i => i.type === type) || new ER.Item(type, me.x, me.y);
                    if (G.items.indexOf(it) < 0) G.items.push(it);
                    it.state = 'held'; it.holder = me; me.holding = it;
                    const hp0 = me.hp;
                    me.startThrow();
                    for (let f = 0; f < 240; f++) {
                      me.update(idle, G.items, G.level, other);
                      G.items.forEach(i => i.update(G.players, G.level));
                    }
                    report.scenarios.push({ who, type, where: sc.label, lost: hp0 - me.hp });
                  });
                });
              });
              /* Full computer-vs-computer fights, watching for self-hits and backwards throws. */
              const orig = ER.Player.prototype.releaseThrow;
              ER.Player.prototype.releaseThrow = function (aim) {
                const other = this === G.eddie ? G.richie : G.eddie;
                report.cpuThrows += 1;
                if (Math.sign(other.x - this.x) !== this.facing) report.cpuAwayThrows += 1;
                return orig.call(this, aim);
              };
              for (let run = 0; run < 8; run++) {
                ER.Test.start('demo');
                /* vary the start so runs differ */
                G.richie.x += run * 23; G.eddie.x -= run * 11;
                ER.Test.step(4000);
                ER.Test.hits().forEach(h => { if (h.source === h.victim) report.cpuSelfHits.push(h); });
              }
              ER.Player.prototype.releaseThrow = orig;
              report.failing = report.scenarios.filter(s => s.lost !== 0);
              return report;
            }"""
        )
        if self_hit["failing"] or self_hit["cpuSelfHits"]:
            raise RuntimeError(f"thrower was hurt by own object: {self_hit['failing'][:5]} {self_hit['cpuSelfHits'][:5]}")
        if self_hit["cpuAwayThrows"]:
            raise RuntimeError(f"computer threw away from its opponent {self_hit['cpuAwayThrows']} times")
        results["noSelfHits"] = {
            "scenarios": len(self_hit["scenarios"]),
            "scenarioFailures": 0,
            "cpuThrows": self_hit["cpuThrows"],
            "cpuAwayThrows": self_hit["cpuAwayThrows"],
            "cpuSelfHits": 0,
        }

        # --- Bug 2: Eddie can pick up and throw, using the real G key -------
        page.evaluate(
            """() => {
              ER.Test.start('1p-eddie');
              const G = ER.Game, e = G.eddie, r = G.richie;
              r.control = 'none';
              G.items.forEach(i => { i.state = 'ground'; i.x = 20; i.y = 214; });
              const k = G.items.find(i => i.type === 'kettle');
              e.x = 300; e.y = 205; e.facing = 1; e.vx = 0; e.vy = 0;
              k.x = 312; k.y = 205;
              r.x = 400; r.y = 205; r.vx = 0; r.vy = 0;
            }"""
        )
        page.keyboard.down("g"); page.wait_for_timeout(120); page.keyboard.up("g")
        page.wait_for_timeout(120)
        grab = page.evaluate("() => ({ holding: ER.Game.eddie.holding && ER.Game.eddie.holding.type, rhp: ER.Game.richie.hp, ehp: ER.Game.eddie.hp })")
        if grab["holding"] != "kettle":
            raise RuntimeError(f"Eddie could not pick up the kettle with G: {grab}")
        page.screenshot(path=str(SCREENS / "eddie-grab-desktop.png"), full_page=False)
        page.keyboard.down("g"); page.wait_for_timeout(120); page.keyboard.up("g")
        page.wait_for_timeout(1500)
        thrown = page.evaluate("() => ({ holding: !!ER.Game.eddie.holding, rhp: ER.Game.richie.hp, ehp: ER.Game.eddie.hp, hits: ER.Test.hits() })")
        if thrown["holding"] or thrown["rhp"] >= grab["rhp"] or thrown["ehp"] != grab["ehp"]:
            raise RuntimeError(f"Eddie's throw did not land on Richie: before={grab} after={thrown}")
        # F still swings the bat
        page.evaluate("() => { const e = ER.Game.eddie; e.cooldown = 0; e.action = null; }")
        page.keyboard.down("f"); page.wait_for_timeout(60); page.keyboard.up("f")
        swing = page.evaluate("() => ER.Game.eddie.action && ER.Game.eddie.action.type")
        if swing != "swing":
            raise RuntimeError(f"F no longer swings the bat: {swing}")
        results["eddieGrabThrow"] = {"picked": grab["holding"], "richieHp": f"{grab['rhp']} -> {thrown['rhp']}", "eddieHpUnchanged": True, "fStillSwings": True}

        page.evaluate("() => ER.Test.start('2p')")
        page.wait_for_timeout(150)
        st = page.evaluate("() => ER.Test.state()")
        if st["screen"] != "play" or st["eddie"]["control"] != "p1" or st["richie"]["control"] != "p2":
            raise RuntimeError(f"2p start failed {st}")
        results["twoPlayer"] = {"ok": True, "mode": st["mode"]}

        page.evaluate("() => ER.Test.start('1p-richie')")
        st = page.evaluate("() => ER.Test.state()")
        if st["richie"]["control"] != "p1" or st["eddie"]["control"] != "cpu":
            raise RuntimeError("1p-richie controls wrong")
        results["onePlayerRichie"] = {"ok": True}

        page.set_viewport_size({"width": 390, "height": 844})
        page.evaluate("() => { ER.Test.gotoTitle(); ER.fitStage(); }")
        page.wait_for_timeout(300)
        page.screenshot(path=str(SCREENS / "title-phone.png"), full_page=False)
        results["titlePhone"] = overflow_report(page.evaluate(JS_METRICS))

        page.evaluate("() => ER.Test.start('1p-eddie')")
        page.wait_for_timeout(300)
        touch_visible = page.evaluate(
            """() => {
              const t = document.getElementById('touch');
              return t && !t.hidden && t.getBoundingClientRect().height > 0;
            }"""
        )
        if not touch_visible:
            raise RuntimeError("touch controls not visible on phone 1p")
        page.screenshot(path=str(SCREENS / "fight-phone.png"), full_page=False)
        results["fightPhone"] = overflow_report(page.evaluate(JS_METRICS))

        page.evaluate("() => ER.Test.kill('eddie')")
        page.wait_for_timeout(150)
        st = page.evaluate("() => ER.Test.state()")
        if st["winner"] != "richie":
            raise RuntimeError("expected richie win on phone")
        page.screenshot(path=str(SCREENS / "win-phone.png"), full_page=False)
        results["winPhone"] = overflow_report(page.evaluate(JS_METRICS))

        browser.close()

    overflow_fails = [
        (k, v)
        for k, v in results.items()
        if isinstance(v, dict) and (v.get("overflowX") or v.get("leaking"))
    ]
    print(json.dumps({"errors": errors, "results": results, "overflowFails": overflow_fails}, indent=2))
    if errors:
        print("CONSOLE ERRORS", errors, file=sys.stderr)
        return 2
    if overflow_fails:
        print("OVERFLOW", overflow_fails, file=sys.stderr)
        return 3
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
