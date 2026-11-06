# Eddie vs Richie

A small 2D scrap set in Eddie and Richie’s flat. Round one is just the flat. Later we can add other places from the series, each with its own mini-game.

This is a private project. Please don’t publish it or put it on GitHub Pages unless you’ve said that’s OK.

## How to play

You don’t need to install anything.

1. Download this project (on GitHub: the green **Code** button, then **Download ZIP**).
2. Unzip it.
3. Open `index.html` in your web browser (Chrome, Edge, Firefox or Safari are all fine).
4. Pick a mode on the title screen.

It works on a computer and on a phone. On a phone you’ll get on-screen buttons.

### The idea

- **Eddie** is slower and can take more hits. He swings a cricket bat (press **F**, or the BAT button).
- **Richie** is quicker but not as tough. He picks up household objects and throws them (press **K** to throw, **L** to pick up or drop, or use the phone buttons).

Things you’ll find around the flat: a kettle and pan by the cooker, a toaster in the kitchen, a bottle on the dining table, a chair in the dining room (it’s heavy and also gets in the way), a remote by the TV, a pillow on the sofa, and a cricket ball in the living room.

The fight can run through the living room, through the arch into the dining room, and into the kitchen. The camera follows you.

The first one to run out of health loses the round. Then you can play again.

### Controls

**Eddie (player 1)**  
Move: W A S D  
Swing bat: F

**Richie (player 2)**  
Move: arrow keys  
Throw: K (or pick something up if his hands are empty)  
Pick up / drop: L

**Everyone**  
P or Esc: pause  
M: turn the beeps on or off  
Space: start a 1-player game as Eddie from the title screen, or play again after a win

**Phone (1 player)**  
Use the pad on the left and the buttons on the right.

In **1 player** you choose Eddie or Richie, and the computer takes the other one.  
In **2 players** you share one keyboard: player 1 is Eddie, player 2 is Richie.

## Adding more places later

Round one only lists one location, “the flat”, in `js/levels.js` and `js/level-flat.js`.

To add another place from the series (and a mini-game):

1. Paint or generate a background and write a layout file like `js/level-something.js` (size of the place, where people start, where objects sit).
2. Register it with `ER.registerLevel(...)` the same way the flat does.
3. Hook it up from the title screen in `index.html` and `js/game.js`.

The controls, health, throwing and bat swing can stay as they are.

## Pictures and sound

Character and object pictures come from the private 8-bit sprite sheets (magenta backgrounds removed so they sit cleanly on the flat). The flat itself is an original pixel drawing of the rooms — living room on the left, dining room through the arch, kitchen with a sloped skylight on the right — not a copy of any reference photo.

There is no recorded music or voices, only little beeps the browser makes itself.

## A note on the code

Open `index.html`. There is no build step and no extra tools to run. The JavaScript files in `js/` are plain scripts (not a bundler), so the game still works if you just double-click the file.
