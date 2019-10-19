export default (arr, rank) => {
  while (rank) {
    let spliced
    do {
      spliced = arr.splice(rank, 1)
    } while (arr.length && spliced === arr[0])
    rank > 0 ? rank-- : rank++
  }
}
