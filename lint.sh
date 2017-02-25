#!/bin/bash
# Lint all sources separately, as closure doesn't understand node modules so detects false collisions
# This makes it sloooow
# TODO with the feb version of closure, can use --module_resolution=node

LINT_CMD="java -jar ./node_modules/google-closure-compiler/compiler.jar --jscomp_warning=lintChecks --checks_only --language_out=ES5"

if [ $# -eq 1 ]
then
  echo $1;
  $LINT_CMD $1;
else
  for f in src/*.js test/*.js
  do
    echo $f;
    $LINT_CMD $f;
  done
fi
