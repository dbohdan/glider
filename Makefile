# Build, check, and test the Glider 4 port.
# Requires GNU Make, Node.js 24 or later, and npm (for the pinned tools in package-lock.json).

NODE ?= node
NPM ?= npm
BIN := node_modules/.bin
DIST := dist

.PHONY: all check lint test build resources serve oracle oracle-shots clean distclean node-version

all: check lint test

node-version:
	@$(NODE) -e 'const v = +process.versions.node.split(".")[0]; if (v < 24) { console.error(`Node.js 24 or later is required (found $${process.version}).`); process.exit(1); }'

node_modules/.installed: package.json package-lock.json | node-version
	$(NPM) ci --no-audit --no-fund
	touch $@

check: node_modules/.installed
	$(BIN)/tsc -p tsconfig.json

lint: node_modules/.installed
	$(BIN)/oxlint --type-aware --deny-warnings src tools test oracle

test: node_modules/.installed
	$(NODE) --test 'test/**/*.test.ts'

resources: node_modules/.installed
	$(NODE) tools/build-resources.ts $(DIST)/data

build: node_modules/.installed resources
	$(BIN)/tsc -p tsconfig.build.json
	cp -R web/. $(DIST)/

serve: build
	$(NODE) tools/serve.ts $(DIST)

# The oracle (see oracle/README.md) also needs gcc, git, and hfsutils.
oracle: node_modules/.installed
	$(NODE) oracle/main.ts setup

oracle-shots: oracle
	$(NODE) oracle/main.ts shoot

clean:
	rm -rf $(DIST) build

distclean: clean
	rm -rf node_modules
