.PHONY: test bump build

test:
	npm test

bump:
	./bump-version.sh

build:
	./build.sh
