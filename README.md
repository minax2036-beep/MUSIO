# MUSIO

**YOUR MUSIC. YOUR SYSTEM.**

MUSIO is an open-source music system focused on managing and playing music from sources chosen by the user.

## Project direction

- Browser-first application
- Local music library and playback
- Future Raspberry Pi home-server integration
- Modular core designed to keep the interface separate from system logic

## Technology

| Area | Technology |
|---|---|
| Client | HTML5, CSS3, Vanilla JavaScript |
| Playback | HTMLAudioElement, Web Audio API |
| Local database | IndexedDB |
| Folder access | File System Access API |
| Future server | Python, FastAPI, SQLite |

## Music policy

MUSIO is intended for music created by the user, AI-generated music, and music that is free to use under its applicable license. Always check each track's license and attribution requirements.

## License

The MUSIO software is licensed under GNU GPL v3. See [LICENSE](./LICENSE).

Music files imported into MUSIO are separate works and are not automatically covered by the software license.

## Status

Early development — Folder Access v0.1.

Current foundation includes:
- Modular system lifecycle and event bus
- Local audio playback with queue, previous/next, seek, and volume
- IndexedDB music library with saved audio files, favorites, and playlists
- Library search
- Browser folder selection, recursive audio scanning, and repeat-scan duplicate detection
- Responsive dark player interface

Notes:
- Folder access uses the browser File System Access API and requires a supported Chromium-based browser in a secure context (such as GitHub Pages HTTPS).
- The selected folder handle is stored in IndexedDB. Browsers may still ask for permission again.
- Folder scanning imports audio file data into IndexedDB; it does not stream directly from the original folder.
- Imported audio files are not uploaded to a server.
- Browser storage is subject to quota limits and may be cleared by browser settings.
- Supported audio formats depend on the browser and its codecs.
- Track artist metadata is currently a placeholder.

Next milestones:
1. Audio metadata extraction (title, artist, album, cover art)
2. Playlist editing and queue persistence
3. Improved library organization and album views
4. Direct folder playback and storage optimization
5. Raspberry Pi server integration
