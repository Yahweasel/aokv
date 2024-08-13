all: dist/aokv.js dist/aokv.min.js

dist/aokv.js dist/aokv.min.js: src/*.ts node_modules/.bin/rollup
	npm run build

node_modules/.bin/rollup:
	npm install

clean:
	rm -rf dist
