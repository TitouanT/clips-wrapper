// ################
// Global constants
// ################

const spawn = require("child_process").spawn;

const Clips_Prompt = "CLIPS> ";
// made it global because otherwise it would be generated for each datachunks
const Clips_Subs = Clips_Prompt.split("")
	.map((char, index, chars) =>
		chars.slice(0, index+1).join("")
	)

// global constants:
const completions = [
	'load', 'save', 'bload', 'bsave', 'load-facts', 'save-facts', 'clear', 'run', 'reset', 'exit', 'assert', 'retract', 'agenda', 'ppdefrule', 'declare', 'salience', 'defrule', 'deffacts',
	
	// everything you can watch
	'watch', 'unwatch', 'facts', 'instances', 'slots', 'rules', 'activations', 'messages', 'message-handlers', 'generic-functions', 'methods', 'deffunctions', 'compilations', 'statistics', 'globals', 'focus', 'all',

	// macros
	'init', ':q', 'runfast'
];




// #########################################
// defines the global state of the programm.
// #########################################

const global_state = {
	clips_process: null,
	line_reader:  require("readline").createInterface({
		input: process.stdin,
		output: process.stdout,
		completer: onTab,
		removeHistoryDuplicates: true,
	}),
	run_cmd_activated: false,
	data_read_since_last_prompt: false,
	display_clips_output: true,
}



// start the clips function and wire the handlers
function start() {
	// start the clips process
	global_state.clips_process = spawn("clips");

	// wire handlers for clips process
	global_state.clips_process.on('exit', () => {
		process.stdout.write("\x1b[0m\n");
		process.exit()
	});
	global_state.clips_process.stdout.on('data', ondata_handler());

	// wire handlers for the line reader
	global_state.line_reader.on("line", sendClips);
	global_state.line_reader.on('SIGINT', () => {
		if (global_state.run_cmd_activated) {
			global_state.run_cmd_activated = false;
			return;
		}
		global_state.clips_process.kill('SIGINT');
	});
}

// handle clips data output and decide when to send back data to clips
function ondata_handler(){
	let buffer = "";
	const sendNextLine = inputDispatcher();
	return chunk => {
		buffer += chunk;
		buffer = consumeClipsOutput(buffer);

		if (buffer == Clips_Prompt) {
			buffer = "";
			sendNextLine();
		}
	};
}

// send outputs from commands back to the user
// TODO: add coloring
function consumeClipsOutput(rawoutput) {
	const lines = rawoutput.split("\n");
	const lastLine = lines.pop();

	if (lines.length > 0) {
		global_state.data_read_since_last_prompt = true;
		if (global_state.display_clips_output)
			lines.forEach(line => process.stdout.write(line + "\n"));
	}

	const sub_of_clp_prpt = endsWithPartOfClipsPrompt(lastLine);

	if (sub_of_clp_prpt) {
		const data_before_len = lastLine.length - sub_of_clp_prpt.length;
		if (data_before_len > 0) {
			global_state.data_read_since_last_prompt = true;
			if (global_state.display_clips_output)
				process.stdin.write(lastLine.slice(0, data_before_len));
		}
		return sub_of_clp_prpt;
	}
	// if last line is intended to be a prompt then on edits it will be seen as a prompt
	// try editing a line when asked for data in a clips programm with and without this line to see the effect
	if (global_state.display_clips_output) {
		global_state.line_reader.setPrompt(lastLine);
		process.stdin.write(lastLine);
	}
	global_state.data_read_since_last_prompt = true;

	return "";
}

function endsWithPartOfClipsPrompt(str) {
	for (sub of Clips_Subs) {
		if (str.endsWith(sub)) return sub;
	}
	return null;
}

// choose between sending user specified commands or expands macros
function inputDispatcher() {
	const queue = [];
	// this way everything the user types when not asked for input is sent to clips
	return async () => {
		// if we don't already know what to do then find something
		if (queue.length == 0) {
			global_state.display_clips_output = true;
			// if the run cmd is activated and should be continued then continue it
			if (global_state.run_cmd_activated && global_state.data_read_since_last_prompt) {
				runCmdIter(queue);
			} else {
				global_state.run_cmd_activated = false;
				while (queue.length == 0) {
					const userLine = await userInput();
				
					// remove unnecessary caracters from the userLine
					const userCmd = cleanLine(userLine);
					expandMacros(queue, userCmd);
				}
			}
		} else if (global_state.run_cmd_activated) {
			global_state.display_clips_output = false;
		}

		// send to clips the oldest element from the queue
		global_state.data_read_since_last_prompt = false;
		sendClips(queue.shift());
	};
}

function userInput() {
	return new Promise((resolve, reject) => {
		global_state.line_reader.question("\x1b[36m\n#> ", userline => {
			process.stdin.write("\x1b[0m");
			resolve(userline);
		});
	});
}

function cleanLine(line) {
	line = line.trim();
	if (line[0] == "(") {
		line = line.slice(1, line.length);
		if (line[line.length - 1] == ")") line = line.slice(0, line.length - 1);
		line = line.trim();
	}
	return line;
}

function expandMacros(queue, line) {
	let words = line.split(" ");
	if (words.length == 0) return;

	const error = msg => process.stderr.write("\x1b[35m" + msg + "\x1b[0m\n");

	// "init" macros
	const fst = words[0];
	switch (true) {
		case fst.endsWith(".clp"): words.push(fst);
		case fst == "init": {
			if (words.length == 2) {
				const filename = words[1].replace(/"/g, "");
				queue.push("(clear)");
				queue.push('(load "' + filename + '")');
				queue.push("(reset)");
			} else {
				error("usage: init <filename>");
				error("       <=> (clear) (load <filename>) (reset)");
			}
			return;
		}
		case fst == "load": {
			// useful if you are working whith a clips program whithout the .clp extension
			if (words.length == 2) {
				const filename = words[1].replace(/"/g, "");
				queue.push('(load "' + filename + '")');
			}
			return;
		}
		case fst == ":q" : {
			queue.push("(exit)");
			return;
		}

		case fst == "run": {
			if (words.length != 1) break;
			global_state.run_cmd_activated = true;
			runCmdIter(queue);
			return;
		}

		case fst == "forest":
		case fst == "gump":
		case fst == "forestgump":
		case fst == "runfast":
			queue.push("(run)");
			return;
	}

	addToCompletion(words);
	words = words.map(w => {
		if (w.indexOf(".clp") != -1) {
			const filename = w.replace(/"/g, "");
			return '"'+filename+'"';
		}
		return w;
	});
	// basic commands
	queue.push("(" + words.join(" ") + ")");
}

function runCmdIter(queue) {
	queue.push("(run 100)");
	queue.push("(agenda)");
}

function sendClips(line) {
	// console.log("sending: " + line + " to clips");
	global_state.clips_process.stdin.write(line + "\n");
}

// completion helpers:

function onTab(line) {
	const lastw = line.split(" ").pop();
	const hits = completions.filter((c) => c.startsWith(lastw));
	//const quoteHits = completions.filter((c) => c.startsWith('"'+lastw));
	// show all completions if none found
	return [hits, lastw];
	// return [hits.concat(quoteHits), lastw];
}

function addToCompletion(words) {
	for (w of words) {
		if (completions.indexOf(w) == -1) completions.push(w);
	}
}
function addCurDirClipsFiles() {
	const fs = require("fs");
	fs.readdir(".", (err, files) => {
		if (!err) {
			for (f of files) {
				if (f.endsWith(".clp") && completions.indexOf(f) == -1) {
					completions.push(f);
					completions.push('"'+f+'"');
				}
			}
		}
	});
	
}

// begining of the program
addCurDirClipsFiles();
start();

/* vim: set nowrap: */
