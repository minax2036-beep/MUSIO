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

Early development — Audio Engine v0.1.0.

Current foundation includes:
- Modular system lifecycle and event bus
- Browser environment detection
- Local audio file import (temporary browser session)
- Playback, pause, previous/next, seek, and volume controls
- Responsive dark player interface

Notes:
- Imported files are held in memory as browser file references; they are not uploaded or copied to a server.
- The current library is temporary and must be selected again after a page reload.
- Supported audio formats depend on the browser and its available codecs.

Next milestones:
1. Folder access and persistent library
2. Track metadata and search
3. IndexedDB storage
4. Playlists and queue persistence
5. Raspberry Pi server integration
