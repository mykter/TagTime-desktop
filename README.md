# TagTime-desktop

[![Linux & macOS Build Status](https://travis-ci.org/mykter/TagTime-desktop.svg?branch=master)](https://travis-ci.org/mykter/TagTime-desktop)
![Greenkeeper Badge](https://badges.greenkeeper.io/mykter/TagTime-desktop.svg)
[![bitHound Overall Score](https://www.bithound.io/github/mykter/TagTime-desktop/badges/score.svg)](https://www.bithound.io/github/mykter/TagTime-desktop)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/mykter/TagTime-desktop.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/mykter/TagTime-desktop/alerts/)

[![Windows Build status](https://ci.appveyor.com/api/projects/status/vo15dgoqrb6k4fc4?svg=true)](https://ci.appveyor.com/project/mykter/tagtime-desktop)
[![AppVeyor tests](https://img.shields.io/appveyor/tests/mykter/TagTime-desktop.svg?logo=appveyor)](https://ci.appveyor.com/project/mykter/tagtime-desktop/build/tests)

[![Latest (pre)release](https://img.shields.io/github/release/mykter/TagTime-desktop/all.svg)](https://github.com/mykter/TagTime-desktop/releases)

This is a cross-platform desktop GUI implementation of [TagTime](https://github.com/dreeves/TagTime).

To determine how you spend your time, TagTime literally randomly samples you. At random times it pops up and asks what you're doing right at that moment. You answer with tags.

See http://messymatters.com/tagtime for the whole story.

Here's a clip of an intrepid user getting pinged by TagTime whilst job hunting. As well as what "project" they're working on, they're also using TagTime to record what tools they're using - in this case, emails. Later, they'll be able to analyze their tags to see how they spend their time on the computer.
![cast](https://user-images.githubusercontent.com/1424497/38167891-69506068-3536-11e8-86d5-5962e053a84e.gif)

Inspired by [alice0meta](https://github.com/alice0meta/TagTime).

# Installation and Quick Start

Download the latest installer from [Releases](https://github.com/mykter/TagTime-desktop/releases) and run it.

The application will automatically launch in the background on system startup. Preferences can be set via the tray icon.

To view and edit your past pings, right click the tray icon and choose Edit Pings.

To analyze where your time is being spent, check out this [Visualizer](https://alexschell.shinyapps.io/tagtime-vis/) or use the perl scripts from the [original TagTime implementation](https://github.com/tagtime/TagTime). At some point you'll be able to analyze your time usage directly from within the app.

# Contributing

Contributions welcome! This is a fun side-project, there's lots to do, and your use-case might be different to mine.
Please see the CONTRIBUTING.md file for design and development info.

## Beeminder

I don't use [Beeminder](https://beeminder.com), so haven't implemented support. Pull requests welcome.
