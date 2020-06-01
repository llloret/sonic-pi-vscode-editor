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
const child_process = require('child_process');
import { OscSender } from './oscsender';
const OSC = require('osc-js');
const { v4: uuidv4 } = require('uuid');


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

    runOffset: number;

    errorHighlightDecorationType = vscode.window.createTextEditorDecorationType({
        border: '2px solid red'
    });


    constructor(){
        // Set up path defaults based on platform
        this.platform = os.platform();
        if (this.platform === 'win32'){
            this.rootPath = "C:/Program Files/Sonic Pi";
            this.rubyPath = this.rootPath + "/app/server/native/ruby/bin/ruby.exe";
        }
        else if (this.platform === 'darwin'){
            this.rootPath = "/Applications/Sonic Pi.app/Contents/Resources";
            this.rubyPath = this.rootPath + "/app/server/native/ruby/bin/ruby";
        }
        else{
            this.rootPath = "/home/user/sonic-pi";
            this.rubyPath = "ruby";
        }

        // Override default root path if found in settings
        if (vscode.workspace.getConfiguration('sonicpieditor').sonicPiRootDirectory){
            this.rootPath = vscode.workspace.getConfiguration('sonicpieditor').sonicPiRootDirectory;
        }

        console.log('Using Sonic Pi root directory: ' + this.rootPath);
        console.log('Using ruby: ' + this.rubyPath);

        this.rubyServerPath = this.rootPath + "/app/server/ruby/bin/sonic-pi-server.rb";
        this.portDiscoveryPath = this.rootPath + "/app/server/ruby/bin/port-discovery.rb";
        this.fetchUrlPath = this.rootPath + "/app/server/ruby/bin/fetch-url.rb";
        this.samplePath = this.rootPath + "/etc/samples";
        this.spUserPath = this.sonicPiHomePath() + "/.sonic-pi";
        this.spUserTmpPath = this.spUserPath + "/.writableTesterPath";
        this.logPath = this.spUserPath + "/log";
        this.serverErrorLogPath = this.logPath + "/server-errors.log";
        this.serverOutputLogPath = this.logPath + "/server-output.log";
        this.guiLogPath = this.logPath + "/gui.log";
        this.processLogPath = this.logPath + "/processes.log";
        this.scsynthLogPath = this.logPath + "/scsynth.log";
        this.initScriptPath = this.rootPath + "/app/server/ruby/bin/init-script.rb";
        this.exitScriptPath = this.rootPath + "/app/server/ruby/bin/exit-script.rb";
        this.qtAppThemePath = this.rootPath + "/app/gui/qt/theme/app.qss";
        this.qtBrowserDarkCss = this.rootPath + "/app/gui/qt/theme/dark/doc-styles.css";
        this.qtBrowserLightCss = this.rootPath + "/app/gui/qt/theme/light/doc-styles.css";
        this.qtBrowserHcCss = this.rootPath + "/app/gui/qt/theme/high_contrast/doc-styles.css";

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
        if (!fs.existsSync(this.logPath)){
            fs.mkdirSync(this.logPath);
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
            let launchAuto = vscode.workspace.getConfiguration('sonicpieditor').launchSonicPiServerAutomatically;
            for (let i = 0; i < editors.length; i++){
                if (launchAuto === 'ruby' && editors[i].document.languageId === 'ruby' && !this.serverStarted) {
                    this.startServer();
                    break;
                }
                if (launchAuto === 'custom'){
                    let customExtension = vscode.workspace.getConfiguration('sonicpieditor').launchSonicPiServerCustomExtension;
                    if (!customExtension){
                        vscode.window.showErrorMessage("Launch is set to custom, but custom extension is empty.",
                            "Go to settings").then(
                            item => { if (item) {
                                vscode.commands.executeCommand('workbench.action.openSettings', 'sonicpieditor.launchSonicPiServerCustomExtension');
                            }});
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
            if (event.affectsConfiguration('sonicpieditor')){
                this.updateMixerSettings();
            }
        });
    }

    checkSonicPiPath() {
        if (!fs.existsSync(this.rubyServerPath)){
            vscode.window.showErrorMessage("The Sonic Pi root path is not properly configured.",
                "Go to settings").then(
                item => { if (item) {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'sonicpieditor.sonicPiRootDirectory');
                }});
        }
    }

    sonicPiHomePath(){
        return os.homedir();
    }

    startServer(){
        if (!this.serverStarted){
            // Initialise the Sonic Pi server
            vscode.window.setStatusBarMessage("Starting Sonic Pi server");
            vscode.window.showInformationMessage("Starting Sonic Pi server");
            this.initAndCheckPorts();
            this.setupOscReceiver();
            this.startRubyServer();
            this.serverStarted = true;
        }
    }

    log(str: string){
        this.logOutput.appendLine(str);
    }

    cueLog(str: string){
        this.cuesOutput.appendLine(str);
    }

    // This is where the incoming OSC messages are processed.
    // We are processing most of the incoming OSC messages, but not everything yet.
    setupOscReceiver(){
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

        osc.on('/syntax_error', (message: { args: any;}) => {
            console.log("Got /syntax_error" + message.args[0] + ", " + message.args[1] +  ", " +
            message.args[2] + ", " + message.args[3]  + ", " + message.args[4]);
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
    processSyntaxError(message: {args: any }){
        let job_id = message.args[0];
        let desc = message.args[1];
        let error_line = message.args[2];
        let line = message.args[3] + this.runOffset;

        vscode.window.showErrorMessage('Syntax error on job ' + job_id + ': ' + desc + '\nLine ' + line + ': ' + error_line, 'Goto error').then(
            item => { if (item) {
                let errorHighlight: vscode.DecorationOptions[] = [];
                let editor = vscode.window.activeTextEditor!;
                let range = editor.document.lineAt(line - 1).range;
                editor.selection = new vscode.Selection(range.start, range.end);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                errorHighlight.push({range});
                editor.setDecorations(this.errorHighlightDecorationType, errorHighlight);
            }}
        );
    }

    // Show information about the error to the user
    processError(message: {args: any }){
        let job_id = message.args[0];
        let desc = message.args[1];
        let backtrace = message.args[2];
        let line = message.args[3] + this.runOffset;

        vscode.window.showErrorMessage('Error on job ' + job_id + ': ' + desc + '\nLine ' + line + ': ' + backtrace, 'Goto error').then(
            item => { if (item) {
                let errorHighlight: vscode.DecorationOptions[] = [];
                let editor = vscode.window.activeTextEditor!;
                let range = editor.document.lineAt(line-1).range;
                editor.selection = new vscode.Selection(range.start, range.end);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                errorHighlight.push({range});
                editor.setDecorations(this.errorHighlightDecorationType, errorHighlight);
            }}
        );
    }


    // Process an incoming multi-message
    processMultiMessage(message: {args: any }){
        let job_id = message.args[0];
        let thread_name = message.args[1];
        let runtime = message.args[2];
        let count = message.args[3];

        let toShow = "{run: " + job_id + ", time: " + runtime;
        if (thread_name){
            toShow += ", thread: " + thread_name;
        }
        toShow += "}";
        this.logOutput.appendLine(toShow);

        toShow = "";
        for (let i = 0; i < count; i++){
            //let type = message.args[4 + (2*i)];
            let str = message.args[4 + 1 + (2*i)];
            let lines = str.split(/\r?\n/);
            if (!str){
                toShow = " |";
            }
            else if (i === (count - 1)){
                toShow = " └─ ";
            }
            else{
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

        this.guiSendToServerPort   = port_map.get("gui-send-to-server")!;
        this.guiListenToServerPort = port_map.get("gui-listen-to-server")!;
        this.serverListenToGuiPort = port_map.get("server-listen-to-gui")!;
        this.serverOscCuesPort      = port_map.get("server-osc-cues")!;
        this.serverSendToHuiPort   = port_map.get("server-send-to-gui")!;
        this.scsynthPort              = port_map.get("scsynth")!;
        this.scsynthSendPort         = port_map.get("scsynth-send")!;
        this.erlangRouterPort        = port_map.get("erlang-router")!;
        this.oscMidiOutPort         = port_map.get("osc-midi-out")!;
        this.oscMidiInPort          = port_map.get("osc-midi-in")!;
        this.websocketPort            = port_map.get("websocket")!;

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
    startRubyServer(){
        let args = ["--enable-frozen-string-literal", "-E", "utf-8", this.rubyServerPath, "-u",
            this.serverListenToGuiPort, this.serverSendToHuiPort, this.scsynthPort,
            this.scsynthSendPort, this.serverOscCuesPort, this.erlangRouterPort,
            this.oscMidiOutPort, this.oscMidiInPort, this.websocketPort];

        let ruby_server = child_process.spawn(this.rubyPath, args);
        ruby_server.stdout.on('data', (data: any) => {
            console.log(`stdout: ${data}`);
            this.log(`stdout: ${data}`);
            if (data.toString().match(/.*Sonic Pi Server successfully booted.*/)){
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

    updateMixerSettings(){
        let invert_stereo = vscode.workspace.getConfiguration('sonicpieditor').invertStereo;
        let force_mono = vscode.workspace.getConfiguration('sonicpieditor').forceMono;
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

    sendOsc(message: any){
        this.oscSender.send(message);
    }

    runCode(code: string, offset: number = 0){
        // The offset represents the line number of the selection, so we can apply it when we just send a
        // selection to Sonic Pi. If we send the full buffer, then this is 0.
        this.runOffset = offset;
        if (vscode.workspace.getConfiguration('sonicpieditor').logClearOnRun){
            this.logOutput.clear();
        }
        if (vscode.workspace.getConfiguration('sonicpieditor').safeMode){
            code = "use_arg_checks true #__nosave__ set by Qt GUI user preferences.\n" + code ;
        }
        this.clearErrorHighlight();
        let message = new OSC.Message('/run-code', this.guiUuid, code);
        this.sendOsc(message);
    }

    stopAllJobs(){
        var message = new OSC.Message('/stop-all-jobs', this.guiUuid);
        this.sendOsc(message);
    }

    startRecording(){
        let message = new OSC.Message('/start-recording', this.guiUuid);
        this.sendOsc(message);
    }

    stopRecording(){
        let message = new OSC.Message('/stop-recording', this.guiUuid);
        this.sendOsc(message);
    }

    saveRecording(path: string){
        let message = new OSC.Message('/save-recording', this.guiUuid, path);
        this.sendOsc(message);
    }

    deleteRecording(){
        let message = new OSC.Message('/delete-recording', this.guiUuid);
        this.sendOsc(message);
    }

    mixerInvertStereo(){
        let message = new OSC.Message('/mixer-invert-stereo', this.guiUuid);
        this.sendOsc(message);
    }

    mixerStandardStereo(){
        let message = new OSC.Message('/mixer-standard-stereo', this.guiUuid);
        this.sendOsc(message);
    }

    mixerMonoMode(){
        let message = new OSC.Message('/mixer-mono-mode', this.guiUuid);
        this.sendOsc(message);
    }

    mixerStereoMode(){
        let message = new OSC.Message('/mixer-stereo-mode', this.guiUuid);
        this.sendOsc(message);
    }

    // Remove the error highlight
    clearErrorHighlight(){
        vscode.window.activeTextEditor?.setDecorations(this.errorHighlightDecorationType, []);
    }

    // Convert a uint array to a string
    ua82str(buf: Uint8Array): string {
        if (!buf){
            return "";
        }
        let str = new TextDecoder().decode(buf);
        return str;
    }


}