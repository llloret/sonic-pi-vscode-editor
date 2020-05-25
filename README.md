# sonicpieditor README

This is an extension to work with Sonic Pi within vscode. It will launch Sonic Pi's backend when you open
a ruby file.

At the moment this is run as an extension in development, so see the Requirements section below for instructions
on how to run it.

## Features

This is just starting, so there are not many features yet, but enough to have some fun!
- Will launch Sonic Pi backend when opening a ruby file
- Can run code pressing Alt-R (just like in Sonic Pi's editor) or with command palette "Sonic Pi: Run" (see [Screenshot](image/command-palette.png))
- Can stop running audio with Alt-S or "Sonic Pi: Stop"
- Shows logs and cues in the output panel (see [logs](image/output-pane.png) and [cues](image/output-pane-cues.png))
- Some basic snippets (well, just one for now - as a test): live_loop. Will add more shortly. See snippets directory
- And of course, you have syntax highlighting, autoformatting, all the goodies that you usually have with vscode!

* See a very short video of Robin Newman's arrangement of "Pase El Agua" launched from this extension, showing
the thing working, logs, etc: [Video](image/sonicpi-vscode.mp4)


(You can find Robin's original work here: https://in-thread.sonic-pi.net/t/three-more-pieces-for-sonic-pi/2434).

## Requirements

The extension runs in development mode. Follow these steps:
- Go to the extension directory (where this file is located)
- run "npm update", to install the necessary node dependencies
- run "code .", to open the extension directory in vscode
- press F5 to run the extension
- open a ruby file, which will launch Sonic Pi backend

If you run into problems, let me know, and I'll do my best to help you set this up.

**Make sure you configure the paths in main.ts (rootPath and rubypath) to match your own system.** This will
be automated in the future.

## Known Issues

I have not tested this in Linux or Mac yet. Works nicely in Windows.


## Open questions
- Is it ok to start the backend when opening a ruby file, or should we add a new command in vscode to start / stop it?
Or start it when loading the extension (i.e. always)?

