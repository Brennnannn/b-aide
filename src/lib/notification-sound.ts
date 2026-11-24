/**
 * The sound played with a notification (Settings > Notifications), as an object URL.
 * TEMPORARY: once the API exists, the chosen file is copied into `~/.b-aide/sounds/` and played
 * from there; until then it lasts only until the app reloads.
 */
let soundUrl: string | null = null

export function getNotificationSound() {
  return soundUrl
}

export function setNotificationSound(file: File) {
  if (soundUrl) URL.revokeObjectURL(soundUrl)
  soundUrl = URL.createObjectURL(file)
}

export function playNotificationSound() {
  if (soundUrl) void new Audio(soundUrl).play()
}
