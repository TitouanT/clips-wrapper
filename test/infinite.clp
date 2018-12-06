(deffacts num
	(num 0)
)

(defrule add
	(num ?x)
	=>
	(printout t ?x crlf)
	(assert (num (+ ?x 1)))
)
