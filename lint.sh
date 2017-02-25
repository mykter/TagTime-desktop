#!/bin/bash
# Lint all sources separately, as closure doesn't understand node modules so detects false collisions
# This makes it sloooow
# TODO with the feb version of closure, can use --module_resolution=node

LINT_CMD="java -jar ./node_modules/google-closure-compiler/compiler.jar --jscomp_warning=lintChecks --checks_only --language_out=ES5"

if [ $# -gt 0 ]
then
  for f in $*
  do
    echo $f;
    $LINT_CMD $f;
  done
else
  for f in src/*.js test/*.js
  do
    echo $f;
    $LINT_CMD $f;
  done
fi
