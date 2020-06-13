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

type Maybe<T> = T | null;

/**
 * Attempts to find the first open Ruby document, returns null if not found
 */
function tryGetFirstRubyDocument(): Maybe<vscode.TextDocument> {
    let textEditors = vscode.window.visibleTextEditors;
    let rubyEditors = textEditors.filter((editor) => {
        return editor.document.languageId === 'ruby';
    });
    if (!rubyEditors.length){
        vscode.window.showWarningMessage('No open Ruby editors were found, attempting to run Sonic Pi code will have no effect. Please open a Ruby file and try again.');
        return null;
    }
    return rubyEditors[0].document;
}

/**
 * Runs the code from a TextEditor document
 *
 * @param main the instance of the Main class, used for context to keep this function out of the module body scope
 * @param textEditor an instance of a TextEditor from a registerTextEditorCommand callback
 */
function runTextEditorCode(main: Main, textEditor: vscode.TextEditor) {
    let doc = textEditor.document;
    if (doc.languageId !== 'ruby') {
        let maybeRubyDoc = tryGetFirstRubyDocument();
        if (maybeRubyDoc) { main.runCode(maybeRubyDoc.getText()); }
    } else {
        main.runCode(doc.getText());
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Ruby detected. Sonic Pi editor extension active!');

    let main = new Main();

    main.checkSonicPiPath();

    let config = vscode.workspace.getConfiguration('sonicpieditor');
    if (config.launchSonicPiServerAutomatically === 'start'){
        main.startServer();
    }

    let isRecording = false;

    // Register the editor commands. For now, run, stop and recording. Those should be enough for
    // some initial fun...
    let disposable = vscode.commands.registerCommand('sonicpieditor.startserver', () => {
        main.startServer();
    });

    disposable = vscode.commands.registerTextEditorCommand('sonicpieditor.run', (textEditor) => {
        runTextEditorCode(main, textEditor);
    });


    disposable = vscode.commands.registerTextEditorCommand('sonicpieditor.runselected', (textEditor) => {
        // If the focus is on something that is not ruby (i.e. something on the output pane),
        let doc = textEditor.document;
        if (doc.languageId !== 'ruby') {
            let maybeRubyDoc = tryGetFirstRubyDocument();
            if (maybeRubyDoc) { doc = maybeRubyDoc; }
        }
        // run the first found open ruby editor instead
        let code = doc.getText(textEditor.selection);
        if (!code) {
            let runFileWhenRunSelectedIsEmpty = vscode.workspace.getConfiguration('sonicpieditor').runFileWhenRunSelectedIsEmpty;
            if (!runFileWhenRunSelectedIsEmpty){
                vscode.window.showWarningMessage('You tried to Run selected code with no code selected.' +
                'Do you want to run the whole file when this happens?', 'Yes, once', 'Yes, always', 'No, never').then(
                    item => {
                        if (item === 'Yes, once'){
                            code = doc!.getText();
                            main.runCode(code);
                        }
                        else if (item === 'Yes, always'){
                            vscode.workspace.getConfiguration('sonicpieditor').update('runFileWhenRunSelectedIsEmpty', 'always', true);
                            code = doc.getText();
                            main.runCode(code);
                        }
                        else if (item === 'No, never'){
                            vscode.workspace.getConfiguration('sonicpieditor').update('runFileWhenRunSelectedIsEmpty', 'never', true);
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
                main.runCode(code);
            }

        }
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

    let liveReload = false;
    let onSaveSubscription: vscode.Disposable;

    disposable = vscode.commands.registerTextEditorCommand('sonicpieditor.livereload', (textEditor) => {
        liveReload = !liveReload;
        // If enabling
        if (liveReload) {
            // Initially run the code
            runTextEditorCode(main, textEditor);
            // Then set up the on-save subscription
            onSaveSubscription = vscode.workspace.onDidSaveTextDocument((doc) => {
                if (doc.languageId === 'ruby') { main.runCode(doc.getText()); }
            });
            // Display notifications
            vscode.window.setStatusBarMessage("Sonic Pi [Live-Reload]");
            vscode.window.showInformationMessage("Sonic Pi Live-Reload Enabled");
        }
        // If disabling
        else {
            // Dispose of the on-save subscription
            onSaveSubscription.dispose();
            // Display notifications
            vscode.window.showInformationMessage("Sonic Pi Live-Reload Disabled");
            vscode.window.setStatusBarMessage("Sonic Pi server started");
        }
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
