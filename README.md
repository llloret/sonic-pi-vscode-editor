[![Build Status](https://dev.azure.com/luislloret/sonic-pi-vscode-editor/_apis/build/status/llloret.sonic-pi-vscode-editor?branchName=master)](https://dev.azure.com/luislloret/sonic-pi-vscode-editor/_build/latest?definitionId=1&branchName=master)

# sonicpieditor README

This is an extension to work with Sonic Pi within vscode. It will launch Sonic Pi's backend when you open
a ruby file.

At the moment this is run as an extension in development, so see the Requirements section below for instructions
on how to run it.

**Please feel free to contribute with your Pull Requests. Any help is welcome!**

Also, if you like this project or are interested in its progress, it would be great if you star it in github to help spread the word! Thank you!

## Features

This is just starting, but we already have enough features to have some fun!
- Configurable Sonic Pi server launch options. Now you can choose between:
    - always: launches the server when vscode starts
    - ruby: launches the server when there is a ruby file visible in vscode (this is the default)
    - custom: launches the server when there is a file with your given custom extension visible in vscode
    - never: do not launch the server automatically (use the Sonic Pi: Start Server command)
- Can run code pressing Alt-R (or Cmd-R on Mac, just like in Sonic Pi's editor) or with command palette "Sonic Pi: Run" (see [Screenshot](image/command-palette.png))
- Can stop running audio with Alt-S (or Cmd-S on Mac) or "Sonic Pi: Stop"
- Shows logs and cues in the output panel (see [logs](image/output-pane.png) and [cues](image/output-pane-cues.png))
- Some snippets like live_loop, effects, synths, samples, and possibly more coming soon. See the snippets directory for the full list, and contribute new ones if you feel like it!
    - fx -> instantiate effect with automcomplete list chooser
    - fx x (where x is a letter) -> effect instantiation
    - us -> instantiate synth with autocomplete list chooser
    - us x (where x is a letter) -> specific synth instantiation
    - sa -> instantiate sample with automcomplete list chooser
- And of course, you have syntax highlighting, autoformatting, all the goodies that you usually have with vscode!

* See a very short video of Robin Newman's arrangement of "Pase El Agua" launched from this extension, showing
the thing working, logs, etc: [Video](image/sonicpi-vscode.mp4)


(You can find Robin's original work here: https://in-thread.sonic-pi.net/t/three-more-pieces-for-sonic-pi/2434).

## Requirements

The extension runs in development mode. Follow these steps:
- Go to the extension directory (where this file is located)
- run "npm install", to install the necessary node dependencies
- run "code .", to open the extension directory in vscode
- press F5 to run the extension
- (optional) see the Sonic Settings in vscode and configure how you want to start the server, by default it will launch when there is a ruby file visible in the editor

If you run into problems, let me know, and I'll do my best to help you set this up.

**Make sure you configure the paths in main.ts (rootPath and rubypath) to match your own system.** This will
be automated or offer better configuration / platform dependent defaults in the future.

## Known Issues

I have not tested this in Linux yet. Works nicely in Windows and Mac.


## Open questions

