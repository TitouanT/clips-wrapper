# NodeJs wrapper around the CLIPS interpreter

The CLIPS interpreter lacks basic fonctionalities like historic and tab completion.
This project provides:
	+ historic
	+ common CLIPS words completion
	+ "whatever you typed before" completion
	+ clips files completion
	+ no need for the first and last parenthesis (if you put them anyway its fine too)
	+ some macros and aliases:
		+ `init <filename>` <=> `(clear)\n(load "<filename>")\n(reset)`
		+ vim like quit `:q`<=> `(exit)`
