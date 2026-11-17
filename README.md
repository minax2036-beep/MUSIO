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

Early development — Tag Reader v0.1.

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
- Audio tags: MP3 ID3v2.3/2.4 and ID3v1, FLAC Vorbis Comment and embedded picture, and WAV INFO tags.
- Imported tracks are tagged automatically; use “タグを解析” to re-read metadata for tracks already in the library.
- Unsupported formats or missing tags keep the filename as the title.

Next milestones:
1. Playlist editing and queue persistence
2. Improved library organization and album views
3. Direct folder playback and storage optimization
4. Additional metadata formats (MP4/M4A, Ogg)
5. Raspberry Pi server integration


## Video Library v0.1

- Separate IndexedDB `videos` store; existing music tracks and playlists are preserved.
- Add individual video files or recursively scan a selected folder.
- Remember the selected video folder handle and offer rescanning when permission remains available.
- Play locally stored videos in the built-in HTML video player.
- Initial extension filter: MP4, WebM, MOV, MKV, AVI. Actual playback depends on browser codec support.
- Video files are stored separately from audio tracks; video metadata, thumbnails, history, and unified search are future milestones.
