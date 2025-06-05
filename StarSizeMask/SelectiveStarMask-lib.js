function roundUp(num, precision) {
    precision = Math.pow(10, precision)
    return Math.ceil(num * precision) / precision
}

function roundDown(num, precision) {
    precision = Math.pow(10, precision)
    return Math.floor(num * precision) / precision
}