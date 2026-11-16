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

Early development — System foundation v0.1.0.

Current foundation includes:
- Modular system lifecycle
- Event bus for module communication
- Browser environment detection
- Initial responsive dark interface

Next milestones:
1. Audio Engine
2. Library and metadata
3. IndexedDB storage
4. Playlists and queue
5. Raspberry Pi server integration