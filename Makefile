.PHONY: run rundev install

run:
	NODE_ENV=production node app.js

rundev:
	node app.js

install:
	npm -d install
