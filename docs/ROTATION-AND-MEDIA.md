# Rotation, quick slide control, and media links

In display modes, enable **التناوب بين الصور ولوحة التميز** and choose the normal view (daily screen, photos, clock/layout, or media). Set both durations, then save/publish. The display repeats normal → leaderboard → normal; the leaderboard uses the saved recognition source. Photo rotation uses the photo playlist, falling back to the main photo. PowerPoint keeps manual slide control and does not rotate away.

PowerPoint keyboard/pointer and phone controls update their own view immediately. One request is sent at a time; rapid presses coalesce into the latest absolute slide and blackout state. Older responses do not roll the view back. Temporary failures retry the same target. Other devices update after the server accepts the target and signals them; network latency still applies between devices.

In media mode, paste a public Google Drive link or a direct HTTPS video/audio URL and choose **استخدام رابط الوسائط**. MP4/WebM links play as video; MP3/M4A/WAV/OGG links play as audio. For extensionless URLs or Drive files, choose the media type. Background music also accepts direct audio links. Signed query strings are preserved. Links must return playable media, rather than an HTML player page; access and browser format support still apply. Drive video buffering/cache options remain available. Browser sound permission may require a click on the display.

Validation: unit tests, production/local builds, delayed-network presenter browser test, normal/photo ↔ leaderboard rotation and direct video/MP3 playback browser test, and Drive cache/playback regression test. Fixtures and temporary servers do not alter school data.
