// MIT License

// Copyright (c) 2020 Luis Lloret

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Important!! Note that for now, the code is sent as "workspace_nine", so this will overwrite
// what you have in tab 9 on your Sonic Pi session. This should be smarter in the future, and
// I think there are plans to make this more flexible on Sonic Pi's side

// At the moment this has been tested on Windows... my Linux VM with Linux Mint refuses to 
// start Supercollider. Something to do with jackd and pulseaudio. Will investigate later.
// It would be great if someone can check if it works in Linux, and provide a PR if it doesn't.

import * as vscode from 'vscode';
const { v4: uuidv4 } = require('uuid');
const OSC = require('osc-js');

import { Main } from './main';

export function activate(context: vscode.ExtensionContext) {
	console.log('Ruby detected. Sonic Pi editor extension active!');

	// create an uuid for the editor
	let guiUuid = uuidv4();

	let main = new Main();
	let config = vscode.workspace.getConfiguration('sonicpieditor');
	if (config.launchSonicPiServerAutomatically === 'always'){
		main.startServer();
	}

	let isRecording = false;
	
	// Register the editor commands. For now, run, stop and recording. Those should be enough for
	// some initial fun...
	let disposable = vscode.commands.registerCommand('sonicpieditor.startserver', () => {		
		main.startServer();
	});

	disposable = vscode.commands.registerTextEditorCommand('sonicpieditor.run', (textEditor) => {		
		let doc = textEditor.document;
		// If the focus is on something that is not ruby (i.e. something on the output pane), 
		// run the first found open ruby editor instead
		if (doc.languageId !== 'ruby'){
			let textEditors = vscode.window.visibleTextEditors;
			let rubyEditors = textEditors.filter((editor) => {
				return editor.document.languageId === 'ruby';
			});

			if (!rubyEditors.length){
				return;
			}
			doc = rubyEditors[0].document;
		}
		let code = doc.getText();
		var message = new OSC.Message('/run-code', guiUuid, code);
		main.sendOsc(message);
	});

	disposable = vscode.commands.registerCommand('sonicpieditor.stop', () => {
		var message = new OSC.Message('/stop-all-jobs', guiUuid);
		main.sendOsc(message);
	});

	disposable = vscode.commands.registerCommand('sonicpieditor.togglerecording', () => {
		isRecording = !isRecording;
		if (isRecording){
			var message = new OSC.Message('/start-recording', guiUuid);
			main.sendOsc(message);
        }
        else{
			var message = new OSC.Message('/stop-recording', guiUuid);
            main.sendOsc(message);
            vscode.window.showSaveDialog({filters: {'Wave file': ['wav']}}).then(uri => {
                if (uri){
                    var message = new OSC.Message('/save-recording', guiUuid, uri.fsPath);
                    main.sendOsc(message);            
                }
                else{
                    var message = new OSC.Message('/delete-recording', guiUuid);
                    main.sendOsc(message);            
                }
            });
        }
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
