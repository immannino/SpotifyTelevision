## TODO

- login Componeont
    - If not logging in through spotify, Auth using my user and display 'browse' and 'demo' playlists. 
    - Completed:
    - Add Spotify auth.
- Spotify Service
    - Kinda done..... like some playlists just cant be found. Add error handling. 
    - Spotify Search & Load playlist data services.
        - Consume user token & load playlists. 
- Display Videos on Main Screen
    - Convert current sidebar to a sidebar of accordian components. 
        - Each accordian titled to the name of the playlist, then on click of the accordion, extend out to show the songs. Add css:hover to let the user know which song/playlist they are currently about to select. 
        - When openning a new playlist, collapse the currently openned accordian. 
        - i.e. find a sidebar accordian, or make my own component. We'll see I guess. Material.angular.io is confusing. 
- QOL / Future
    - On load of videos, we can pass all the iframe urls into the iframe youtube url template using the '?playlist=' parameter, and have all the videos autoplay. 

- Long Term: 
    - Styling. Still working on ideas. 
    - Name for app. 
    - Logo design.
    - Dockerize app.
    - Unit testing.
    - Auth token caching.
    - CICD 