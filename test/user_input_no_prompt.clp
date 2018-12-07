; source: https://stackoverflow.com/questions/27162578/how-do-i-have-a-program-in-clips-assert-user-input-without-having-the-user-type

(deffacts start
	(get-next-input)
)

(defrule get-input
	?f <- (get-next-input)
	=>
	(bind ?input (readline))
	(if (neq ?input "end")
		then (retract ?f)
		(assert (get-next-input))
		(assert (user-input ?input))
	)
)
	
