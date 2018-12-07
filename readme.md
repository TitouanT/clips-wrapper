# NodeJs wrapper around the CLIPS interpreter

The CLIPS interpreter lacks basic fonctionalities like historic and tab completion.
This project provides:

- historic
- completion
	+ common CLIPS words completion
	+ "whatever you typed before" completion
	+ clips files completion
- no need for the first and last parenthesis (if you put them anyway its fine too)
- you can stop the `run` command with `ctrl+c`
- some macros and aliases:
	+ `init <filename>` <=> `(clear)\n(load "<filename>")\n(reset)`
	+ `filename.clp` <=> `init filename.clp` (notice the extension)
	+ vim like quit `:q`<=> `(exit)`
	+ `runfast` <=> `(run)` (you can't stop it, `ctrl+c` terminates the programm)

## install

The simplest way is to add an alias somewhere in your config (`~/.bashrc` or `~/.zshrc` for example)

```bash
alias clp="node ~/path/to/this/repos/clips_wrap.js"
```
Once you've done that it might not work yet because you need to have `clips` in your `$PATH`.

## dependencies
You need [NodeJs](https://nodejs.org/) and [CLIPS](http://www.clipsrules.net/)

