workflow "Rebuild Site" {
  on = "push"
  resolves = ["Build for Github Pages"]
}

action "GitHub Action for npm" {
  uses = "actions/npm@de7a3705a9510ee12702e124482fad6af249991b"
  runs = "install"
}

action "Set Credentials" {
  uses = "actions/npm@de7a3705a9510ee12702e124482fad6af249991b"
  needs = ["GitHub Action for npm"]
  runs = "setcreds"
  secrets = ["SPOTIFYID", "YOUTUBE_API_KEY"]
}

action "Build for Github Pages" {
  uses = "actions/npm@de7a3705a9510ee12702e124482fad6af249991b"
  needs = ["Set Credentials"]
  runs = "deploy:prod"
}
