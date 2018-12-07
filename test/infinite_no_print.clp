(deffacts num
	(num 0)
)

(defrule add
	(num ?x)
	=>
	(assert (num (+ ?x 1)))
)
