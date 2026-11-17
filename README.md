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
| Future server | Python, FastAPI, SQLite |

## Music policy

MUSIO is intended for music created by the user, AI-generated music, and music that is free to use under its applicable license. Always check each track's license and attribution requirements.

## License

The MUSIO software is licensed under GNU GPL v3. See [LICENSE](./LICENSE).

Music files imported into MUSIO are separate works and are not automatically covered by the software license.

## Status

Early development — Library v0.1.0.

Current foundation includes:
- Modular system lifecycle and event bus
- Browser environment detection
- Local audio playback with queue, previous/next, seek, and volume
- IndexedDB music library that persists imported audio files and track information
- Library search and favorites
- Playlist creation and adding tracks to playlists
- Responsive dark player interface

Notes:
- Imported audio files are stored in the browser's local IndexedDB storage. They are not uploaded to a server.
- Browser storage is subject to the browser's quota and may be cleared by the user or browser settings.
- Supported audio formats depend on the browser and its available codecs.
- Track artist metadata is currently a placeholder; metadata extraction is a future milestone.

Next milestones:
1. Folder access and automatic library scanning
2. Audio metadata extraction (title, artist, album, cover art)
3. Playlist editing and queue persistence
4. Improved library organization and album views
5. Raspberry Pi server integration
