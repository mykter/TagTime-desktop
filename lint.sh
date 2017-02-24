#!/bin/bash
# Lint all sources separately, as closure doesn't understand node modules so detects false collisions
# This makes it sloooow
# TODO with the feb version of closure, can use --module_resolution=node
for f in src/*.js test/*.js
do
  echo $f
  java -jar ./node_modules/google-closure-compiler/compiler.jar --jscomp_warning=lintChecks --checks_only --language_out=ES5 $f
done
