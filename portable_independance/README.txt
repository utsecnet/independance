independance — portable build
==============================

To run: double-click independance.bat. It starts the local server (a
minimized console window — closing it stops the app) and opens the app in
your default browser at http://localhost:5175.

No installation, no admin rights, no internet access needed. Your data
(the dependency map, types/statuses, and app settings) lives entirely in
the data\ folder next to this file — back that folder up if you want to
keep a copy, and it's safe to copy this whole portable_independance folder
(including data\) to another machine to bring everything with it.

Rebuilding this folder (via build-portable.mjs) never touches data\ — only
the node\, server\, and client\ folders and this launcher get replaced.
