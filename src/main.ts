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

// Important!!
// At the moment some paths are hardcoded below, please make sure that this.rootPath is
// the directory where Sonic Pi is installed, and that this.rubyPath points to where ruby is located,
// or just "ruby" in Linux

// We are processing some of the incoming OSC messages, but not everything yet. See setupOscReceiver() below
// for the ones we are doing.

// We are showing logs and cues in the Output panel, select the "logs" or "cues" on the dropdown. Is there a way to show
// both of them? Do we want to?

import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { IncomingHttpStatusHeader } from 'http2';
const path = require('path');
const fs = require('fs');
const os = require('os');
const child_process = require('child_process');
import { OscSender } from './oscsender';
const OSC = require('osc-js');


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

    constructor(){
        // FIXME: these 2 should not be hardcoded. For now, make sure that they are set to the correct values for your system
        this.rootPath = "C:/Program Files/Sonic Pi";    
        this.rubyPath = this.rootPath + "/app/server/native/ruby/bin/ruby.exe";


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
    
        this.oscSender = new OscSender();

        this.setupOscReceiver();
    

        // attempt to create log directory
        if (!fs.existsSync(this.logPath)){
            fs.mkdirSync(this.logPath);
        }

        this.cuesOutput = vscode.window.createOutputChannel('Cues');	
        this.logOutput = vscode.window.createOutputChannel('Log');
        this.cuesOutput.show();
        this.logOutput.show();
    }

    sonicPiHomePath(){
        return os.homedir();
    }

    log(str: string){
        this.logOutput.appendLine(str);        
    }

    ab2str(buf: Uint8Array) {
        if (!buf){
            return "";
        }
        let str = new TextDecoder().decode(buf);
        return str;
    }

    sendOsc(message: any){
        this.oscSender.send(message);
    }

    // This is where the incoming OSC messages are processed
    setupOscReceiver(){
        let osc = new OSC({
			plugin: new OSC.DatagramPlugin({ open: { port: 51236, host: '127.0.0.1' } })
        });
        osc.open();
        osc.on('/log/info', (message: { args: any; }) => {
            console.log("Got /log/info" + " -> " + message.args[0] + ", " + message.args[1]);
            this.logOutput.appendLine(message.args[1]);
        });

        osc.on('/incoming/osc', (message: { args: any; }) => {
            console.log("Got /incoming/osc" + " -> " + message.args[0] + ", " + message.args[1] + ", " +
                message.args[2] + ", " + message.args[3]);
            this.cuesOutput.appendLine(message.args[2] + ": " + message.args[3]);
        });

        osc.on('/log/multi_message', (message: any) => {
            console.log("Got /log/multi_message");
            this.processMultiMessage(message);            
        });

/*        osc.on('*', (message: {address: string}) => {
            console.log("Got message of type: " + message.address);
        });
*/
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
            let type = message.args[4 + (2*i)];
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
            let itemStr = this.ab2str(item);
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
            }

          });
          
          ruby_server.stderr.on('data', (data: any) => {
            this.log(`stderr: ${data}`);
          });
    }    
}