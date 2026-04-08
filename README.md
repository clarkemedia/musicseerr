MusicSeerr (Alpha)
A music request and discovery fork of Overseerr, specifically tailored for Lidarr and MusicBrainz.

Project Intent
Overseerr/Jellyseerr is built for movies and television. MusicSeerr adapts that framework to handle the specific metadata requirements of music—focusing on artists, albums, and discographies rather than titles and seasons. It is a request manager, not a media player.

Current Status: Alpha
Functional
MusicBrainz Search: Native search bar and browse pages for artists and albums.

Discography Views: Artist detail pages showing full release history.

Lidarr Integration: Connectivity testing and server configuration storage.

Theming: Custom green interface and music-specific sidebar navigation.

Immediate Requirements (Fixes Needed)
Request Payload: Debugging the API modal to ensure the MusicBrainz ID is passed correctly to Lidarr.

Metadata Logic: Implementing filters to separate studio albums from bootlegs, singles, and live recordings.

UI Labels: Replacing hardcoded "Series/Season" strings with "Artist/Album" context.

Art Fetching: Integrating Cover Art Archive for release group imagery.

Technical Setup
Development Environment
Clone the repository.

Install dependencies: yarn install

Start development server: yarn dev

Configure Lidarr via Settings > Services.

Contribution Guidelines
Fork and Branch: Create a specific branch for any bug fix or feature.

Pull Requests: All code must be submitted via PR. Direct pushes to main are restricted to maintain stability.

Issue Tracking: Use the GitHub Issues tab to report bugs or claim active development tasks.

License
Distributed under the MIT License. Derived from Overseerr.
