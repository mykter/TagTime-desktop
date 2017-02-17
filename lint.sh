#!/bin/bash
# Lint them separately, as closure doesn't understand node modules so detects false collisions
for sources in "*.js" "test/*.js"
do
  java -jar ./node_modules/google-closure-compiler/compiler.jar --jscomp_warning=lintChecks --checks_only $sources
done
