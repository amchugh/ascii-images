
.PHONY: dev
dev: 
	python3 -m http.server -d public 3000

.PHONY: gen
gen:
	tsc -p ./tsconfig.json
	sass src/main.sass public/index.css --no-source-map -s compressed

.PHONY: watch-sass
watch-sass:
	sass src/main.sass public/index.css --no-source-map -w

.PHONY: watch-ts
watch-ts:
	# tsc --allowSyntheticDefaultImports --outFile public/index.js src/*.ts
	tsc --watch -p ./tsconfig.json
