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

import * as vscode from 'vscode';
import { TextDecoder } from 'util';
const fs = require('fs');
const os = require('os');
const path = require('path');
const child_process = require('child_process');
import { OscSender } from './oscsender';
const OSC = require('osc-js');
const utf8 = require('utf8');
const { v4: uuidv4 } = require('uuid');
import { Config } from './config';
// eslint-disable-next-line no-unused-vars
import { Range, TextEditor, window } from 'vscode';


export class Main {
    rootPath: string;
    rubyPath: string;
    rubyServerPath: string;

    portDiscoveryPath: string;
    fetchUrlPath: string;
    samplePath: string;

    spUserPath: string;
    spUserTmpPath: string;

    logPath: string;
    serverErrorLogPath: string;
    serverOutputLogPath: string;
    guiLogPath: string;
    processLogPath: string;
    scsynthLogPath: string;

    initScriptPath: string;
    exitScriptPath: string;

    qtAppThemePath: string;
    qtBrowserDarkCss: string;
    qtBrowserLightCss: string;
    qtBrowserHcCss: string;

    guiSendToServerPort: number;
    guiListenToServerPort: number;
    serverListenToGuiPort: number;
    serverOscCuesPort: number;
    serverSendToHuiPort: number;
    scsynthPort: number;
    scsynthSendPort: number;
    erlangRouterPort: number;
    oscMidiOutPort: number;
    oscMidiInPort: number;
    websocketPort: number;

    logOutput: vscode.OutputChannel;
    cuesOutput: vscode.OutputChannel;

    oscSender: OscSender;

    serverStarted: boolean;

    platform: string;
    guiUuid: any;
    config: any;

    runOffset: number;

    errorHighlightDecorationType = vscode.window.createTextEditorDecorationType({
        border: '2px solid red'
    });


    constructor() {
        this.config = new Config();

        // Get platform
        this.platform = os.platform();

        // Determine root path, if it exists.
        this.rootPath = this.config.sonicPiRootDirectory() || "";
        if (!this.rootPath) {
            switch (this.platform) {
            case 'win32':   this.rootPath = "C:/Program Files/Sonic Pi";    break;
            case 'darwin':  this.rootPath = "C:/Program Files/Sonic Pi";    break;
            }
        }

        // Determine ruby path based on root path, or just use the ruby on PATH.
        this.rubyPath = this.config.commandPath() || "";
        if (!this.rubyPath) {
            switch (this.platform) {
            case 'win32':   this.rubyPath = path.resolve(this.rootPath, "app/server/native/ruby/bin/ruby.exe"); break;
            case 'darwin':  this.rubyPath = path.resolve(this.rootPath, "app/server/native/ruby/bin/ruby");     break;
            default:        this.rubyPath = "ruby"; break;
            }
        }

        // Collect relative config paths
        let relativeServerBin = this.config.relativeServerBin() || 'app/server/ruby/bin';
        let relativeQtThemePath = this.config.relativeQtThemePath() || 'app/gui/qt/theme';
        let relativeSamplesPath = this.config.relativeSamplesPath() || 'etc/samples';

        if (!this.rootPath) {
            // If root path is not defined, this is a special system. It's linux, and Sonic Pi could be in a variety of spots.

            // Function to get the current linux distribution. Useful for anyone needing debian specific stuff

            // e.g., this makes "distro" be the base distro of "debian", "arch", or others, instead of just "linux"
            // let distro = ''
            // if (this.platform == "linux") {
            //     // Here, we loop over the os-release ini file and look for the line ID_LIKE='distro'
            //     const releaseDetals = fs.readFileSync('/etc/os-release').toString().split("\n")
            //     for (const detailLine of releaseDetals) {
            //         const detail = detailLine.split("=");
            //         if (detail[0].toLowerCase() == "id_like") {
            //             // Once we find the line, the part after the = sign is the distro name
            //             // Also trim non-alphanumeric characters just to be safe
            //             distro = detail[1].replace(/\W+/g, '')
            //         }
            //     }
            // }

            // FIXME: Add more paths. These are the paths for an Arch Linux distribution.
            relativeServerBin = '/usr/lib/sonic-pi/server/bin/';
            relativeQtThemePath = '/usr/share/sonic-pi/theme/';
            relativeSamplesPath = '/usr/share/sonic-pi/samples/';
        }

        // path.resolve() handles absolute paths fine. Think of it as cd-ing into the first folder, than into the next sequentially.
        const serverBin = path.resolve(this.rootPath, relativeServerBin);
        const qtThemePath = path.resolve(this.rootPath, relativeQtThemePath);
        this.samplePath = path.resolve(this.rootPath, relativeSamplesPath);

        console.log('Using Sonic Pi server bin: ' + serverBin);
        console.log('Using ruby: ' + this.rubyPath);

        this.rubyServerPath      = path.join(serverBin, "sonic-pi-server.rb");
        this.portDiscoveryPath   = path.join(serverBin, "port-discovery.rb");
        this.fetchUrlPath        = path.join(serverBin, "fetch-url.rb");

        this.spUserPath          = path.join(this.sonicPiHomePath(), "/.sonic-pi");
        this.spUserTmpPath       = path.join(this.spUserPath, "/.writableTesterPath");

        this.logPath             = path.join(this.spUserPath, "/log");
        this.serverErrorLogPath  = path.join(this.logPath, "server-errors.log");
        this.serverOutputLogPath = path.join(this.logPath, "server-output.log");
        this.guiLogPath          = path.join(this.logPath, "gui.log");
        this.processLogPath      = path.join(this.logPath, "processes.log");
        this.scsynthLogPath      = path.join(this.logPath, "scsynth.log");

        this.initScriptPath      = path.join(serverBin, "init-script.rb");
        this.exitScriptPath      = path.join(serverBin, "exit-script.rb");

        this.qtAppThemePath      = path.join(qtThemePath, "app.qss");
        this.qtBrowserDarkCss    = path.join(qtThemePath, "dark/doc-styles.css");
        this.qtBrowserLightCss   = path.join(qtThemePath, "light/doc-styles.css");
        this.qtBrowserHcCss      = path.join(qtThemePath, "high_contrast/doc-styles.css");

        this.guiSendToServerPort = -1;
        this.guiListenToServerPort = -1;
        this.serverListenToGuiPort = -1;
        this.serverOscCuesPort = -1;
        this.serverSendToHuiPort = -1;
        this.scsynthPort = -1;
        this.scsynthSendPort = -1;
        this.erlangRouterPort = -1;
        this.oscMidiOutPort = -1;
        this.oscMidiInPort = -1;
        this.websocketPort = -1;

        this.runOffset = 0;

        // attempt to create log directory
        if (!fs.existsSync(this.logPath)) {
            fs.mkdirSync(this.logPath, { recursive: true });
        }

        this.cuesOutput = vscode.window.createOutputChannel('Cues');
        this.logOutput = vscode.window.createOutputChannel('Log');
        this.cuesOutput.show();
        this.logOutput.show();

        this.serverStarted = false;

        this.oscSender = new OscSender();

        // create an uuid for the editor
        this.guiUuid = uuidv4();

        // watch to see if the user opens a ruby or custom file and we need to start the server
        vscode.window.onDidChangeVisibleTextEditors((editors) => {
            let launchAuto = this.config.launchSonicPiServerAutomatically();
            for (let i = 0; i < editors.length; i++) {
                if (launchAuto === 'ruby' && editors[i].document.languageId === 'ruby' && !this.serverStarted) {
                    this.startServer();
                    break;
                }
                if (launchAuto === 'custom') {
                    let customExtension = this.config.launchSonicPiServerCustomExtension();
                    if (!customExtension) {
                        vscode.window.showErrorMessage(
                            "Launch is set to custom, but custom extension is empty.",
                            "Go to settings"
                        ).then( item => {
                            if (item) {
                                vscode.commands.executeCommand('workbench.action.openSettings', 'sonicpieditor.launchSonicPiServerCustomExtension');
                            }
                        });
                    }
                    else if (editors[i].document.fileName.endsWith(customExtension) && !this.serverStarted) {
                        this.startServer();
                        break;
                    }
                }
            }
        });

        // Update the mixer on the server if there are configuration changes
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('sonicpieditor')) {
                this.updateMixerSettings();
            }
        });
    }

    checkSonicPiPath() {
        if (!fs.existsSync(this.rubyServerPath)) {
            vscode.window.showErrorMessage(
                "The Sonic Pi root path is not properly configured.",
                "Go to settings"
            ).then( item => {
                if (item) {
                    // FIXME: should this in actuality be vscode-sonic-pi.sonicPiRootDirectory, or is that linux specific?
                    vscode.commands.executeCommand('workbench.action.openSettings', 'sonicpieditor.sonicPiRootDirectory');
                }
            });
        }
    }

    sonicPiHomePath() {
        return os.homedir();
    }

    startServer() {
        if (!this.serverStarted) {
            // Initialise the Sonic Pi server
            vscode.window.setStatusBarMessage("Starting Sonic Pi server");
            vscode.window.showInformationMessage("Starting Sonic Pi server");
            this.initAndCheckPorts();
            this.setupOscReceiver();
            this.startRubyServer();
            this.serverStarted = true;
        }
    }

    log(str: string) {
        this.logOutput.appendLine(str);
    }

    cueLog(str: string) {
        this.cuesOutput.appendLine(str);
    }

    // This is where the incoming OSC messages are processed.
    // We are processing most of the incoming OSC messages, but not everything yet.
    setupOscReceiver() {
        let osc = new OSC({
            plugin: new OSC.DatagramPlugin({ open: { port: this.guiListenToServerPort, host: '127.0.0.1' } })
        });
        osc.open();
        osc.on('/log/info', (message: { args: any; }) => {
            console.log("Got /log/info" + " -> " + message.args[0] + ", " + message.args[1]);
            this.log(message.args[1]);
        });

        osc.on('/incoming/osc', (message: { args: any; }) => {
            console.log("Got /incoming/osc" + " -> " + message.args[0] + ", " + message.args[1] + ", " +
                message.args[2] + ", " + message.args[3]);
            this.cueLog(message.args[2] + ": " + message.args[3]);
        });

        osc.on('/log/multi_message', (message: any) => {
            console.log("Got /log/multi_message");
            this.processMultiMessage(message);
        });

        osc.on('/syntax_error', (message: { args: any; }) => {
            console.log("Got /syntax_error" + message.args[0] + ", " + message.args[1] + ", " +
                message.args[2] + ", " + message.args[3] + ", " + message.args[4]);
            this.processSyntaxError(message);
        });

        osc.on('/error', (message: any) => {
            console.log("Got /error");
            this.processError(message);
        });

        /*        osc.on('*', (message: {address: string}) => {
                    console.log("Got message of type: " + message.address);
                });
        */
    }

    // Show information about the syntax error to the user
    processSyntaxError(message: { args: any }) {
        let job_id = message.args[0];
        let desc = message.args[1];
        let error_line = message.args[2];
        let line = message.args[3] + this.runOffset;

        vscode.window.showErrorMessage('Syntax error on job ' + job_id + ': ' + desc + '\nLine ' + line + ': ' + error_line, 'Goto error').then(
            item => {
                if (item) {
                    let errorHighlight: vscode.DecorationOptions[] = [];
                    let editor = vscode.window.activeTextEditor!;
                    let range = editor.document.lineAt(line - 1).range;
                    editor.selection = new vscode.Selection(range.start, range.end);
                    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                    errorHighlight.push({ range });
                    editor.setDecorations(this.errorHighlightDecorationType, errorHighlight);
                }
            }
        );
    }

    // Show information about the error to the user
    processError(message: { args: any }) {
        let job_id = message.args[0];
        let desc = message.args[1];
        let backtrace = message.args[2];
        let line = message.args[3] + this.runOffset;

        vscode.window.showErrorMessage('Error on job ' + job_id + ': ' + desc + '\nLine ' + line + ': ' + backtrace, 'Goto error').then(
            item => {
                if (item) {
                    let errorHighlight: vscode.DecorationOptions[] = [];
                    let editor = vscode.window.activeTextEditor!;
                    let range = editor.document.lineAt(line - 1).range;
                    editor.selection = new vscode.Selection(range.start, range.end);
                    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                    errorHighlight.push({ range });
                    editor.setDecorations(this.errorHighlightDecorationType, errorHighlight);
                }
            }
        );
    }


    // Process an incoming multi-message
    processMultiMessage(message: { args: any }) {
        let job_id = message.args[0];
        let thread_name = message.args[1];
        let runtime = message.args[2];
        let count = message.args[3];

        let toShow = "{run: " + job_id + ", time: " + runtime;
        if (thread_name) {
            toShow += ", thread: " + thread_name;
        }
        toShow += "}";
        this.logOutput.appendLine(toShow);

        toShow = "";
        for (let i = 0; i < count; i++) {
            //let type = message.args[4 + (2*i)];
            let str = message.args[4 + 1 + (2 * i)];
            let lines = str.split(/\r?\n/);
            if (!str) {
                toShow = " |";
            }
            else if (i === (count - 1)) {
                toShow = " └─ ";
            }
            else {
                toShow = " ├─ ";
            }
            this.logOutput.append(toShow);

            lines.forEach((line: string) => {
                this.logOutput.appendLine(line);
            });
        }
    }

    // This is where we see what ports to use, calling a ruby script
    initAndCheckPorts() {
        // Clear out old tasks from previous sessions if they still exist
        // in addtition to clearing out the logs
        this.log("[GUI] - Cleaning old sessions...");
        child_process.spawnSync(this.rubyPath, [this.initScriptPath]);

        // Discover the port numbers
        let port_map = new Map<string, number>();
        this.log("[GUI] - Discovering port numbers...");

        let determinePortNumbers = child_process.spawnSync(this.rubyPath, [this.portDiscoveryPath]);
        determinePortNumbers.output.forEach((item: any) => {
            let itemStr = this.ua82str(item);
            let port_strings = itemStr.split(/\r?\n/);
            port_strings.forEach((port_string) => {
                let tokens = port_string.split(':');
                port_map.set(tokens[0], +tokens[1]);
            });
        });

        this.guiSendToServerPort    = port_map.get("gui-send-to-server")!;
        this.guiListenToServerPort  = port_map.get("gui-listen-to-server")!;
        this.serverListenToGuiPort  = port_map.get("server-listen-to-gui")!;
        this.serverOscCuesPort      = port_map.get("server-osc-cues")!;
        this.serverSendToHuiPort    = port_map.get("server-send-to-gui")!;
        this.scsynthPort            = port_map.get("scsynth")!;
        this.scsynthSendPort        = port_map.get("scsynth-send")!;
        this.erlangRouterPort       = port_map.get("erlang-router")!;
        this.oscMidiOutPort         = port_map.get("osc-midi-out")!;
        this.oscMidiInPort          = port_map.get("osc-midi-in")!;
        this.websocketPort          = port_map.get("websocket")!;

        // FIXME: for now, we assume all ports are available.
        /*
        bool glts_available = checkPort(gui_listen_to_server_port);
        bool sltg_available = checkPort(server_listen_to_gui_port);
        bool soc_available = checkPort(server_osc_cues_port);
        bool s_available = checkPort(scsynth_port);
        bool sstg_available = checkPort(server_send_to_gui_port);
        bool gsts_available = checkPort(gui_send_to_server_port);
        bool ss_available = checkPort(scsynth_send_port);
        bool er_available = checkPort(erlang_router_port);
        bool omo_available = checkPort(osc_midi_out_port);
        bool omi_available = checkPort(osc_midi_in_port);
        bool ws_available = checkPort(websocket_port);
        if(!(glts_available && sltg_available && soc_available && s_available && sstg_available && gsts_available && ss_available &&
                    er_available && omo_available && omi_available && ws_available)){
            std::cout << "[GUI] - Critical Error. One or more ports is not available." << std::endl;
            startupError("One or more ports is not available. Is Sonic Pi already running? If not, please reboot your machine and try again.");
            return false;

        } else {
            std::cout << "[GUI] - All ports OK" << std::endl;
            return true;
        }
 */
    }

    // This is the main part of launching Sonic Pi's backend
    startRubyServer() {
        let args = ["--enable-frozen-string-literal", "-E", "utf-8", this.rubyServerPath, "-u",
            this.serverListenToGuiPort, this.serverSendToHuiPort, this.scsynthPort,
            this.scsynthSendPort, this.serverOscCuesPort, this.erlangRouterPort,
            this.oscMidiOutPort, this.oscMidiInPort, this.websocketPort];

        let ruby_server = child_process.spawn(this.rubyPath, args);
        ruby_server.stdout.on('data', (data: any) => {
            console.log(`stdout: ${data}`);
            this.log(`stdout: ${data}`);
            if (data.toString().match(/.*Sonic Pi Server successfully booted.*/)) {
                vscode.window.setStatusBarMessage("Sonic Pi server started");
                vscode.window.showInformationMessage("Sonic Pi server started");
                this.updateMixerSettings();
            }
        });

        ruby_server.stderr.on('data', (data: any) => {
            console.log(`stderr: ${data}`);
            this.log(`stderr: ${data}`);
        });
    }

    updateMixerSettings() {
        let invert_stereo = this.config.invertStereo();
        let force_mono = this.config.forceMono();
        if (invert_stereo) {
            this.mixerInvertStereo();
        } else {
            this.mixerStandardStereo();
        }

        if (force_mono) {
            this.mixerMonoMode();
        } else {
            this.mixerStereoMode();
        }
    }

    sendOsc(message: any) {
        this.oscSender.send(message);
    }

    runCode(code: string, offset: number = 0) {
        // The offset represents the line number of the selection, so we can apply it when we just send a
        // selection to Sonic Pi. If we send the full buffer, then this is 0.
        this.runOffset = offset;
        if (this.config.logClearOnRun()) {
            this.logOutput.clear();
        }
        if (this.config.safeMode()) {
            code = "use_arg_checks true #__nosave__ set by Qt GUI user preferences.\n" + code;
        }
        code = utf8.encode(code);
        this.clearErrorHighlight();
        let message = new OSC.Message('/run-code', this.guiUuid, code);
        this.sendOsc(message);
    }

    flashCode(editor: TextEditor, isWhole: boolean) {
        const range = isWhole ? this.getWholeRange(editor) : this.getSelectedRange(editor);
        const flashDecorationType = window.createTextEditorDecorationType({
            backgroundColor: this.config.flashBackgroundColor(),
            color: this.config.flashTextColor()
        });
        editor.setDecorations(flashDecorationType, [range]);
        setTimeout(function () {
            flashDecorationType.dispose();
        }, 250);
    }
    private getWholeRange(editor: TextEditor): Range {
        let startPos = editor.document.positionAt(0);
        let endPos = editor.document.positionAt(editor.document.getText().length - 1);
        return new Range(startPos, endPos);
    }
    private getSelectedRange(editor: TextEditor): Range {
        return new Range(editor.selection.anchor, editor.selection.active);
    }

    stopAllJobs() {
        var message = new OSC.Message('/stop-all-jobs', this.guiUuid);
        this.sendOsc(message);
    }

    startRecording() {
        let message = new OSC.Message('/start-recording', this.guiUuid);
        this.sendOsc(message);
    }

    stopRecording() {
        let message = new OSC.Message('/stop-recording', this.guiUuid);
        this.sendOsc(message);
    }

    saveRecording(path: string) {
        let message = new OSC.Message('/save-recording', this.guiUuid, path);
        this.sendOsc(message);
    }

    deleteRecording() {
        let message = new OSC.Message('/delete-recording', this.guiUuid);
        this.sendOsc(message);
    }

    mixerInvertStereo() {
        let message = new OSC.Message('/mixer-invert-stereo', this.guiUuid);
        this.sendOsc(message);
    }

    mixerStandardStereo() {
        let message = new OSC.Message('/mixer-standard-stereo', this.guiUuid);
        this.sendOsc(message);
    }

    mixerMonoMode() {
        let message = new OSC.Message('/mixer-mono-mode', this.guiUuid);
        this.sendOsc(message);
    }

    mixerStereoMode() {
        let message = new OSC.Message('/mixer-stereo-mode', this.guiUuid);
        this.sendOsc(message);
    }

    // Remove the error highlight
    clearErrorHighlight() {
        vscode.window.activeTextEditor?.setDecorations(this.errorHighlightDecorationType, []);
    }

    // Convert a uint array to a string
    ua82str(buf: Uint8Array): string {
        if (!buf) {
            return "";
        }
        let str = new TextDecoder().decode(buf);
        return str;
    }


}