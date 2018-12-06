const exec = require("child_process").exec;
const line_reader = require("readline").createInterface({
	input: process.stdin,
	output: process.stdout,
	completer: onTab,
	removeHistoryDuplicates: true,
});
// globals definitions
let clips;
const completions = [
	'load', 'save', 'bload', 'bsave', 'load-facts', 'save-facts', 'clear', 'run', 'reset', 'exit', 'assert', 'retract', 'agenda', 'ppdefrule', 'declare', 'salience', 'defrule', 'deffacts',
	
	// everything you can watch
	'watch', 'unwatch', 'facts', 'instances', 'slots', 'rules', 'activations', 'messages', 'message-handlers', 'generic-functions', 'methods', 'deffunctions', 'compilations', 'statistics', 'globals', 'focus', 'all',

	// macros
	'init', ':q',
];

const Clips_Prompt = "CLIPS> ";
// made it global because otherwise it would be generated for each datachunks
const Clips_Subs = Clips_Prompt.split("")
	.map((char, index, chars) =>
		chars.slice(0, index+1).join("")
	)

function start() {
	// start the clips process
	clips = exec("clips", () => {process.exit()});
	let rawoutput = "";

	// setting listening for data on the standard output of clips
	clips.stdout.on('data', ondata_handler());
}

// handle clips data output and decide when to send back data to clips
function ondata_handler(){
	let buffer = "";
	const sendNextLine = inputDispatcher();
	return chunk => {
		buffer += chunk;
		// console.log("received: " + chunk + "\nend receive");
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
	const clipsPromt = "CLIPS> ";
	const lines = rawoutput.split("\n");
	const lastLine = lines.pop();
	lines.forEach(line => process.stdout.write(line + "\n"));

	const sub_of_clp_prpt = endsWithPartOfClipsPrompt(lastLine);
	if (sub_of_clp_prpt) {
		process.stdin.write(
			lastLine.slice(0, lastLine.length - sub_of_clp_prpt.length)
		);
		return sub_of_clp_prpt;
	}
	// line_reader.setPrompt("\x1b[36m"+ lastLine + "\x1b[0m");
	line_reader.setPrompt(lastLine);

	process.stdin.write(lastLine);

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
	line_reader.on("line", sendClips);
	return async () => {
		while (queue.length == 0) {
			// process.stdin.write("\x1b[36m#> ");
			const userLine = await userInput();
			
			// remove unnecessary caracters from the userLine
			const userCmd = cleanLine(userLine);
			expandMacros(queue, userCmd);
		}
		sendClips(queue.shift());
	};
}

function userInput() {
	return new Promise((resolve, reject) => {
		line_reader.question("\x1b[36m\n#> ", userline => {
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
	switch (words[0]) {
		case "init": {
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
		case "load": {
			// useful if you are working whith a clips program whithout the .clp extension
			if (words.length == 2) {
				const filename = words[1].replace(/"/g, "");
				queue.push('(load "' + filename + '")');
			}
			return;
		}
		case ":q" : {
			queue.push("(exit)");
			return;
		}
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

function sendClips(line) {
	// console.log("sending: " + line + " to clips");
	clips.stdin.write(line + "\n");
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
