export function pack () {
  return `${this.contest}.${this.judge}.${this.candidate}.${this.evaluation}`
}
