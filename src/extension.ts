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

import { Main } from './main';
import { Config } from './config';

export function activate(context: vscode.ExtensionContext) {
    console.log('Ruby detected. Sonic Pi editor extension active!');

    let main = new Main();

    main.checkSonicPiPath();

    let config = new Config();
    if (config.launchSonicPiServerAutomatically() === 'start'){
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

            // TODO: if no ruby editors, show a warning to indicate that this will not have effect
            if (!rubyEditors.length){
                return;
            }
            doc = rubyEditors[0].document;
        }
        let code = doc.getText();
        main.flashCode(textEditor, true);
        main.runCode(code);
    });


    disposable = vscode.commands.registerTextEditorCommand('sonicpieditor.runselected', (textEditor) => {
        let doc = textEditor.document;
        // If the focus is on something that is not ruby (i.e. something on the output pane),
        // run the first found open ruby editor instead
        if (doc.languageId !== 'ruby'){
            let textEditors = vscode.window.visibleTextEditors;
            let rubyEditors = textEditors.filter((editor) => {
                return editor.document.languageId === 'ruby';
            });

            // TODO: if no ruby editors, show a warning to indicate that this will not have effect
            if (!rubyEditors.length){
                return;
            }
            doc = rubyEditors[0].document;
        }
        let code = doc.getText(textEditor.selection);
        if (!code){
            let runFileWhenRunSelectedIsEmpty =  config.runFileWhenRunSelectedIsEmpty();
            if (!runFileWhenRunSelectedIsEmpty){
                vscode.window.showWarningMessage('You tried to Run selected code with no code selected.' +
                'Do you want to run the whole file when this happens?', 'Yes, once', 'Yes, always', 'No, never').then(
                    item => {
                        if (item === 'Yes, once'){
                            code = doc.getText();
                            main.flashCode(textEditor, true);
                            main.runCode(code);
                        }
                        else if (item === 'Yes, always'){
                            config.updateRunFileWhenRunSelectedIsEmpty('always');
                            code = doc.getText();
                            main.flashCode(textEditor, true);
                            main.runCode(code);
                        }
                        else if (item === 'No, never'){
                            config.updateRunFileWhenRunSelectedIsEmpty('never');
                        }
                    }
                );
                return;
            }
            else if (runFileWhenRunSelectedIsEmpty === 'never'){
                return;
            }
            else if (runFileWhenRunSelectedIsEmpty === 'always'){
                code = doc.getText();
                main.flashCode(textEditor, true);
                main.runCode(code);
            }

        }
        main.flashCode(textEditor, false);
        main.runCode(code, textEditor.selection.start.line);
    });


    disposable = vscode.commands.registerCommand('sonicpieditor.stop', () => {
        main.stopAllJobs();
    });

    disposable = vscode.commands.registerCommand('sonicpieditor.togglerecording', () => {
        isRecording = !isRecording;
        if (isRecording){
            main.startRecording();
        }
        else{
            main.stopRecording();
            vscode.window.showSaveDialog({filters: {'Wave file': ['wav']}}).then(uri => {
                if (uri){
                    main.saveRecording(uri.fsPath);
                }
                else{
                    main.deleteRecording();
                }
            });
        }
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
